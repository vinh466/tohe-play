// The hub's telemetry collector (ADR 0015, docs/architecture/telemetry.md). Games hand their events to the hub;
// the hub adds its own (errors, load times, plays, sync failures, web vitals), adds them up, and sends small batches
// to the API. Pure apart from what is injected, so tests drive it without a browser.
import type { TelemetryEvent } from '@tohe/contract';
import { describeError, errorFingerprint } from '@tohe/game-sdk';
import type { components } from '../api/schema.gen.ts';

type Schemas = components['schemas'];
export type TelemetryBatch = Schemas['TelemetryBatch'];
export type TelemetryContext = Schemas['TelemetryContext'];
export type TelemetryEventInput = Schemas['TelemetryEventInput'];

/** The game build an event is about. */
export interface Scope {
  gameId: string;
  gameVersion: string;
}

/** Where the collector keeps its queue, the last batch and the device id: localStorage in the browser. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CollectorDeps {
  /** Hands one batch (JSON) to the network; false when it could not even be queued. */
  send(json: string): boolean;
  online(): boolean;
  /** The device and hub context, read when a batch is built. */
  context(): TelemetryContext;
  storage: KeyValue;
  now(): number;
  newId(): string;
}

/** Whether telemetry may be sent: true, false, or null while it is not known yet (before the config loads). */
export type Consent = boolean | null;

export const KEYS = {
  queue: 'tohe:telemetry:queue',
  last: 'tohe:telemetry:last',
  device: 'tohe:telemetry:device',
} as const;

/** The three switches; telemetry is sent only when all are on. */
export interface TelemetrySwitches {
  /** The server's (GET /api/config); null until the config has loaded. */
  server: boolean | null;
  /** The household's, set by a parent; true for guests, who have none. */
  household: boolean;
  /** This device's, on the "Dữ liệu kỹ thuật" page. */
  device: boolean;
}

export function consentOf({ server, household, device }: TelemetrySwitches): Consent {
  return !device || !household ? false : server;
}

/** Which switch keeps telemetry off, if any, for the transparency page. */
export function statusOf(switches: TelemetrySwitches): 'on' | 'device' | 'household' | 'server' | 'unknown' {
  if (!switches.device) return 'device';
  if (!switches.household) return 'household';
  if (switches.server === false) return 'server';
  return switches.server === true ? 'on' : 'unknown';
}

/** A device id lives this long, then a new one is drawn. */
export const DEVICE_ID_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The API takes 200 events and 32 KB; staying well below keeps every batch acceptable. */
const MAX_EVENTS_PER_BATCH = 150;
const MAX_BATCH_BYTES = 16 * 1024;
/** Batches kept while offline; older ones are dropped. */
const MAX_QUEUED = 20;
/** What one flush period may hold before events are only counted as dropped. */
const MAX_DISTINCT = 300;

export interface Collector {
  /** An event a game reported (already validated by the host) or one of the hub's. */
  record(event: TelemetryEvent, source: 'game' | 'hub', scope?: Scope): void;
  count(name: string, scope?: Scope, n?: number): void;
  metric(name: string, value: number, scope?: Scope): void;
  /** An error the hub caught or saw uncaught. */
  error(error: unknown, scope?: Scope): void;
  setConsent(consent: Consent): void;
  readonly consent: Consent;
  /** Send what is waiting (and what was queued offline), or keep it while consent is unknown. */
  flush(): void;
  /** The last batch handed to the network, exactly as sent (for the transparency page). */
  lastBatch(): TelemetryBatch | null;
}

export function createCollector(deps: CollectorDeps): Collector {
  const sessionId = deps.newId();
  let consent: Consent = null;
  /** Counts and errors are added up under a key; metrics and frame summaries are kept one by one. */
  const added = new Map<string, TelemetryEventInput>();
  let listed: TelemetryEventInput[] = [];
  let dropped = 0;

  const room = () => added.size + listed.length < MAX_DISTINCT;

  const addUp = (key: string, input: TelemetryEventInput) => {
    const known = added.get(key);
    if (known) known.count = (known.count ?? 1) + (input.count ?? 1);
    else if (room()) added.set(key, input);
    else dropped++;
  };

  const record = (event: TelemetryEvent, source: 'game' | 'hub', scope?: Scope) => {
    if (consent === false) return;
    const base = { source, ...(scope ? { gameId: scope.gameId, gameVersion: scope.gameVersion } : {}) };
    const where = `${source}|${scope?.gameId ?? ''}|${scope?.gameVersion ?? ''}`;
    switch (event.kind) {
      case 'error':
        return addUp(`${where}|error|${errorFingerprint(event.message, event.stack)}`, {
          ...base,
          kind: 'error',
          message: event.message,
          ...(event.stack ? { stack: event.stack } : {}),
          count: event.count,
        });
      case 'count':
        return addUp(`${where}|count|${event.name}`, {
          ...base,
          kind: 'count',
          name: event.name,
          count: event.count,
        });
      case 'metric':
        if (room()) listed.push({ ...base, kind: 'metric', name: event.name, value: event.value });
        else dropped++;
        return;
      case 'frames':
        if (room()) listed.push({ ...base, ...event });
        else dropped++;
        return;
    }
  };

  const deviceId = (): string => {
    try {
      const stored = JSON.parse(deps.storage.getItem(KEYS.device) ?? 'null') as {
        id: string;
        since: number;
      } | null;
      if (stored && deps.now() - stored.since < DEVICE_ID_DAYS * DAY_MS) return stored.id;
    } catch {
      // A damaged entry is replaced below.
    }
    const fresh = { id: deps.newId(), since: deps.now() };
    deps.storage.setItem(KEYS.device, JSON.stringify(fresh));
    return fresh.id;
  };

  const readQueue = (): string[] => {
    try {
      const queue = JSON.parse(deps.storage.getItem(KEYS.queue) ?? '[]') as unknown;
      return Array.isArray(queue) ? queue.filter((b): b is string => typeof b === 'string') : [];
    } catch {
      return [];
    }
  };
  const writeQueue = (queue: string[]) =>
    queue.length > 0
      ? deps.storage.setItem(KEYS.queue, JSON.stringify(queue.slice(-MAX_QUEUED)))
      : deps.storage.removeItem(KEYS.queue);

  /** Splits events into batches that each stay under the event and size limits. */
  const batches = (events: TelemetryEventInput[]): TelemetryBatch[] => {
    const base = { deviceId: deviceId(), sessionId, context: deps.context() };
    const result: TelemetryBatch[] = [];
    let current: TelemetryEventInput[] = [];
    for (const event of events) {
      const next = [...current, event];
      const tooBig =
        next.length > MAX_EVENTS_PER_BATCH ||
        JSON.stringify({ ...base, events: next }).length > MAX_BATCH_BYTES;
      if (tooBig && current.length > 0) {
        result.push({ ...base, events: current });
        current = [event];
      } else {
        current = next;
      }
    }
    if (current.length > 0) result.push({ ...base, events: current });
    return result;
  };

  return {
    record,
    count(name, scope, n = 1) {
      record({ kind: 'count', name, count: n }, 'hub', scope);
    },
    metric(name, value, scope) {
      if (Number.isFinite(value) && value >= 0) record({ kind: 'metric', name, value }, 'hub', scope);
    },
    error(error, scope) {
      const { message, stack } = describeError(error);
      record({ kind: 'error', message, ...(stack ? { stack } : {}), count: 1 }, 'hub', scope);
    },
    setConsent(next) {
      consent = next;
      if (next === false) {
        added.clear();
        listed = [];
        dropped = 0;
        deps.storage.removeItem(KEYS.queue);
      }
    },
    get consent() {
      return consent;
    },
    flush() {
      if (consent !== true) return;
      if (dropped > 0)
        addUp('hub|||count|hub.telemetry.dropped', {
          source: 'hub',
          kind: 'count',
          name: 'hub.telemetry.dropped',
          count: dropped,
        });
      const events = [...added.values(), ...listed];
      added.clear();
      listed = [];
      dropped = 0;
      const fresh = events.length > 0 ? batches(events).map((batch) => JSON.stringify(batch)) : [];
      const queue = [...readQueue(), ...fresh];
      if (!deps.online()) return writeQueue(queue);
      const unsent: string[] = [];
      for (const json of queue) {
        if (deps.send(json)) deps.storage.setItem(KEYS.last, json);
        else unsent.push(json);
      }
      writeQueue(unsent);
    },
    lastBatch() {
      try {
        return JSON.parse(deps.storage.getItem(KEYS.last) ?? 'null') as TelemetryBatch | null;
      } catch {
        return null;
      }
    },
  };
}

/** Play time as a bucket name: `under-1m`, `1-5m`, `5-15m`, `15-60m` or `over-60m`. */
export function durationBucket(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return 'under-1m';
  if (minutes < 5) return '1-5m';
  if (minutes < 15) return '5-15m';
  if (minutes < 60) return '15-60m';
  return 'over-60m';
}
