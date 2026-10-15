// Game side of telemetry (ADR 0015). Everything is summarised here and handed to the hub in small messages; the
// game itself never makes a request. Dependency-free like the rest of the game side: only `import type` from the
// contract, whose rules (names, limits) are repeated here and checked by the host with the real schemas.
import type { TelemetryEvent } from '@tohe/contract';

/** How smooth a stretch of play was; the kit measures this for every game made with it. */
export interface FrameSummary {
  /** Frames per duration bucket: ≤ 17, 25, 33, 50, 100 ms, then slower. */
  buckets: number[];
  slowestMs: number;
  stepP50Ms?: number;
  stepP95Ms?: number;
  renderer?: 'webgl' | 'canvas';
}

/**
 * Technical telemetry for this session. Every method is a cheap no-op when `enabled` is false, so a game can call
 * them without checking. Names are lower-case words joined by dots (`game.board.full`); a metric's name ends in its
 * unit (`game.level-load-ms`). Never put anything about the player into a name.
 */
export interface Telemetry {
  /** The hub collects telemetry for this session (the household and the device have it on). */
  readonly enabled: boolean;
  /** Something happened `n` times (default 1). Counts are added up until they are sent. */
  count(name: string, n?: number): void;
  /** One measurement, e.g. how long something took. */
  metric(name: string, value: number): void;
  /** An error the game caught but wants known. Uncaught errors are reported without this. */
  error(error: unknown): void;
  /** A stretch of play's frame times (sent by the kit). */
  frames(summary: FrameSummary): void;
  /** Send what is waiting now. The SDK also sends every minute, when the game is paused or hidden, and on exit. */
  flush(): void;
}

export const TELEMETRY_NAME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,5}$/;
const MAX_EVENTS = 50;
const FRAME_BUCKETS = 6;
/** Distinct errors per minute; more are only counted, so an error in a game loop cannot flood the hub. */
const MAX_ERRORS_PER_MINUTE = 10;
const MAX_METRICS = 20;
const MAX_FRAMES = 5;
const FLUSH_MS = 60_000;

export const disabledTelemetry: Telemetry = {
  enabled: false,
  count: () => {},
  metric: () => {},
  error: () => {},
  frames: () => {},
  flush: () => {},
};

/** An error as telemetry reports it: a short message and the top frames of its stack, without addresses' queries. */
export function describeError(error: unknown): { message: string; stack?: string } {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : (() => {
            try {
              return JSON.stringify(error) ?? String(error);
            } catch {
              return String(error);
            }
          })();
  const message = (raw || 'Unknown error').slice(0, 300);
  const stack =
    error instanceof Error && typeof error.stack === 'string' ? trimStack(error.stack) : undefined;
  return stack ? { message, stack } : { message };
}

/** The first five frames of a stack, each reduced to `function (path:line:column)` with the origin dropped. */
export function trimStack(stack: string): string | undefined {
  const frames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /:\d+:\d+\)?$/.test(line))
    .slice(0, 5)
    .map((line) => line.replace(/https?:\/\/[^/\s)]+/g, '').replace(/\?[^:\s)]*/g, ''));
  return frames.length > 0 ? frames.join('\n').slice(0, 1000) : undefined;
}

/**
 * Errors that differ only in numbers (ids, positions, versions in a path) or in a bundle's hash are one error. The
 * API groups the same way (TelemetryRules.Fingerprint).
 */
export function errorFingerprint(message: string, stack?: string): string {
  const firstFrame = (stack?.split('\n')[0] ?? '')
    .replace(/:\d+:\d+/g, '')
    .replace(/-[A-Za-z0-9_-]{6,}(?=\.js)/g, '');
  return `${message.replace(/\d+/g, '#')}|${firstFrame.replace(/\d+/g, '#')}`;
}

export interface TelemetryOptions {
  send(events: TelemetryEvent[]): void;
  /** Catch the window's uncaught errors and unhandled rejections (default true). */
  captureErrors?: boolean;
  /** Clock and timer, replaceable in tests. */
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
}

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const now = options.now ?? (() => Date.now());
  const counts = new Map<string, number>();
  const errors = new Map<string, { message: string; stack?: string; count: number }>();
  let metrics: { name: string; value: number }[] = [];
  let frames: FrameSummary[] = [];
  let errorWindowStart = now();
  let errorsInWindow = 0;

  const add = (name: string, n: number) => {
    if (!TELEMETRY_NAME.test(name) || name.length > 64) return;
    counts.set(name, (counts.get(name) ?? 0) + n);
  };

  const telemetry: Telemetry = {
    enabled: true,
    count(name, n = 1) {
      if (Number.isInteger(n) && n > 0) add(name, n);
    },
    metric(name, value) {
      if (!TELEMETRY_NAME.test(name) || !Number.isFinite(value) || value < 0) return;
      if (metrics.length >= MAX_METRICS) return add('sdk.metrics-dropped', 1);
      metrics.push({ name, value: Math.min(value, 1_000_000) });
    },
    error(error) {
      const { message, stack } = describeError(error);
      const key = errorFingerprint(message, stack);
      const known = errors.get(key);
      if (known) {
        known.count++;
        return;
      }
      if (now() - errorWindowStart > FLUSH_MS) {
        errorWindowStart = now();
        errorsInWindow = 0;
      }
      if (errorsInWindow >= MAX_ERRORS_PER_MINUTE) return add('sdk.errors-dropped', 1);
      errorsInWindow++;
      errors.set(key, stack ? { message, stack, count: 1 } : { message, count: 1 });
    },
    frames(summary) {
      if (summary.buckets.length !== FRAME_BUCKETS || frames.length >= MAX_FRAMES) return;
      frames.push(summary);
    },
    flush() {
      const events: TelemetryEvent[] = [
        ...[...errors.values()].map((e) => ({ kind: 'error' as const, ...e })),
        ...frames.map((f) => ({ kind: 'frames' as const, ...f })),
        ...metrics.map((m) => ({ kind: 'metric' as const, ...m })),
        ...[...counts].map(([name, count]) => ({ kind: 'count' as const, name, count })),
      ].slice(0, MAX_EVENTS);
      errors.clear();
      counts.clear();
      metrics = [];
      frames = [];
      if (events.length > 0) options.send(events);
    },
  };

  if (options.captureErrors !== false && typeof window !== 'undefined') {
    // Looked at after the event has run its course, so an error another handler dealt with (the kit's WebGL
    // fallback calls preventDefault) is not reported as uncaught.
    window.addEventListener('error', (event) => {
      setTimeout(() => {
        if (!event.defaultPrevented) telemetry.error(event.error ?? event.message);
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      setTimeout(() => {
        if (!event.defaultPrevented) telemetry.error(event.reason);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) telemetry.flush();
    });
    window.addEventListener('pagehide', () => telemetry.flush());
  }
  (options.setInterval ?? ((fn, ms) => setInterval(fn, ms)))(() => telemetry.flush(), FLUSH_MS);
  return telemetry;
}
