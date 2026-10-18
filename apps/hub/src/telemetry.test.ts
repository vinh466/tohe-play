import { describe, expect, it } from 'vitest';
import {
  type CollectorDeps,
  consentOf,
  createCollector,
  DEVICE_ID_DAYS,
  durationBucket,
  KEYS,
  type KeyValue,
  statusOf,
  type TelemetryBatch,
} from './telemetry/collector.ts';

const scope = { gameId: 'tap-merge', gameVersion: '0.4.1' };

function setup(overrides: Partial<CollectorDeps> = {}) {
  const values = new Map<string, string>();
  const storage: KeyValue = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
  const sent: TelemetryBatch[] = [];
  let online = true;
  let clock = Date.parse('2026-10-15T08:00:00Z');
  let ids = 0;
  const collector = createCollector({
    send: (json) => {
      sent.push(JSON.parse(json) as TelemetryBatch);
      return true;
    },
    online: () => online,
    context: () => ({
      hubVersion: 'test',
      deviceClass: 'phone',
      viewportWidth: 400,
      viewportHeight: 850,
      pixelRatio: 2.63,
      displayMode: 'browser',
      theme: 'light',
      locale: 'vi',
    }),
    storage,
    now: () => clock,
    newId: () => `id-${++ids}`,
    ...overrides,
  });
  return {
    collector,
    sent,
    values,
    goOffline: () => (online = false),
    goOnline: () => (online = true),
    advance: (ms: number) => (clock += ms),
  };
}

describe('the hub collector', () => {
  it('holds events until it knows it may send, then adds them up into one batch', () => {
    const { collector, sent } = setup();
    collector.count('hub.play.session', scope);
    collector.record({ kind: 'count', name: 'kit.renderer.webgl', count: 1 }, 'game', scope);
    collector.count('hub.play.session', scope);
    collector.flush();
    expect(sent).toEqual([]);

    collector.setConsent(true);
    collector.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.events).toEqual([
      {
        source: 'hub',
        gameId: 'tap-merge',
        gameVersion: '0.4.1',
        kind: 'count',
        name: 'hub.play.session',
        count: 2,
      },
      {
        source: 'game',
        gameId: 'tap-merge',
        gameVersion: '0.4.1',
        kind: 'count',
        name: 'kit.renderer.webgl',
        count: 1,
      },
    ]);
    expect(sent[0]?.context.deviceClass).toBe('phone');
  });

  it('drops everything, queued batches too, once telemetry is turned off', () => {
    const { collector, sent, values, goOffline } = setup();
    collector.setConsent(true);
    goOffline();
    collector.count('hub.sync.failed.network');
    collector.flush();
    expect(values.has(KEYS.queue)).toBe(true);

    collector.setConsent(false);
    collector.count('hub.play.session');
    collector.flush();
    expect(sent).toEqual([]);
    expect(values.has(KEYS.queue)).toBe(false);
  });

  it('counts an error that differs only in numbers once, per game and source', () => {
    const { collector, sent } = setup();
    collector.setConsent(true);
    collector.record({ kind: 'error', message: 'TypeError: cell 3 missing', count: 1 }, 'game', scope);
    collector.record({ kind: 'error', message: 'TypeError: cell 9 missing', count: 2 }, 'game', scope);
    collector.error(new Error('sync broke'));
    collector.flush();
    const errors = sent[0]?.events.filter((e) => e.kind === 'error') ?? [];
    expect(errors.map((e) => [e.source, e.gameId ?? null, e.count])).toEqual([
      ['game', 'tap-merge', 3],
      ['hub', null, 1],
    ]);
  });

  it('keeps batches while offline and sends them, oldest first, when back online', () => {
    const { collector, sent, values, goOffline, goOnline } = setup();
    collector.setConsent(true);
    goOffline();
    collector.metric('hub.game.ready-ms', 900, scope);
    collector.flush();
    collector.metric('hub.game.ready-ms', 700, scope);
    collector.flush();
    expect(sent).toEqual([]);

    goOnline();
    collector.flush();
    expect(sent.map((batch) => batch.events[0]?.value)).toEqual([900, 700]);
    expect(values.has(KEYS.queue)).toBe(false);
    expect(collector.lastBatch()?.events[0]?.value).toBe(700);
  });

  it('splits what would not fit in one batch', () => {
    const { collector, sent } = setup();
    collector.setConsent(true);
    for (let i = 0; i < 200; i++) collector.metric('hub.vitals.inp-ms', i);
    collector.flush();
    expect(sent.length).toBeGreaterThan(1);
    expect(
      sent.every((batch) => batch.events.length <= 150 && JSON.stringify(batch).length <= 16 * 1024),
    ).toBe(true);
    expect(sent.flatMap((batch) => batch.events)).toHaveLength(200);
  });

  it('keeps one device id for 30 days and one session id per page load', () => {
    const { collector, sent, advance } = setup();
    collector.setConsent(true);
    const send = () => {
      collector.count('hub.play.session');
      collector.flush();
      return sent.at(-1) as TelemetryBatch;
    };
    const first = send();
    advance((DEVICE_ID_DAYS - 1) * 24 * 60 * 60 * 1000);
    expect(send().deviceId).toBe(first.deviceId);
    advance(2 * 24 * 60 * 60 * 1000);
    const renewed = send();
    expect(renewed.deviceId).not.toBe(first.deviceId);
    expect(renewed.sessionId).toBe(first.sessionId);
  });
});

describe('switches', () => {
  it('sends only when the server, the account and the device all say yes', () => {
    expect(consentOf({ server: true, account: true, device: true })).toBe(true);
    expect(consentOf({ server: null, account: true, device: true })).toBeNull();
    expect(consentOf({ server: true, account: false, device: true })).toBe(false);
    expect(consentOf({ server: null, account: true, device: false })).toBe(false);
  });

  it('names the switch that keeps it off', () => {
    expect(statusOf({ server: true, account: true, device: true })).toBe('on');
    expect(statusOf({ server: true, account: true, device: false })).toBe('device');
    expect(statusOf({ server: true, account: false, device: true })).toBe('account');
    expect(statusOf({ server: false, account: true, device: true })).toBe('server');
    expect(statusOf({ server: null, account: true, device: true })).toBe('unknown');
  });

  it('puts play time into ranges', () => {
    expect([30_000, 120_000, 600_000, 1_800_000, 7_200_000].map(durationBucket)).toEqual([
      'under-1m',
      '1-5m',
      '5-15m',
      '15-60m',
      'over-60m',
    ]);
  });
});
