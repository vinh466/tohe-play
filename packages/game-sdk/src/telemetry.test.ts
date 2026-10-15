import {
  TELEMETRY_NAME as CONTRACT_NAME,
  type GameManifest,
  MAX_TELEMETRY_EVENTS,
  type TelemetryEvent,
} from '@tohe/contract';
import { describe, expect, it, vi } from 'vitest';
import { createHost, type HostOptions } from './host.ts';
import {
  connect,
  createTelemetry,
  describeError,
  errorFingerprint,
  memoryTransportPair,
  TELEMETRY_NAME,
  trimStack,
} from './index.ts';

const manifest: GameManifest = {
  id: 'hello',
  name: 'Hello',
  version: '1.0.0',
  protocol: 1,
  description: '',
  entry: 'index.html',
  orientation: 'portrait',
  capabilities: [],
  themes: ['light'],
  minAge: 0,
  tags: [],
  sizeBudgetKb: 3000,
};

async function play(telemetry: boolean | undefined, overrides: Partial<HostOptions> = {}) {
  const [gameSide, hostSide] = memoryTransportPair();
  const received: TelemetryEvent[][] = [];
  const onProtocolError = vi.fn();
  const host = createHost({
    transport: hostSide,
    manifest,
    init: () => ({
      profile: { id: 'p1', name: 'Na' },
      locale: 'vi',
      settings: { muted: false, theme: 'light' },
      save: null,
      seed: 1,
      ...(telemetry === undefined ? {} : { telemetry }),
    }),
    onTelemetry: (events) => received.push(events),
    onProtocolError,
    ...overrides,
  });
  const session = await connect({ gameId: 'hello', transport: gameSide });
  await host.ready;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { host, session, received, onProtocolError, settle };
}

describe('telemetry in a session', () => {
  it('is off unless the hub turns it on, and then sends nothing', async () => {
    for (const flag of [undefined, false]) {
      const { session, received, settle } = await play(flag);
      expect(session.telemetry.enabled).toBe(false);
      session.telemetry.count('game.anything');
      session.telemetry.error(new Error('boom'));
      session.telemetry.flush();
      await settle();
      expect(received).toEqual([]);
    }
  });

  it('adds counts up and reaches the host as valid messages', async () => {
    const { session, received, onProtocolError, settle } = await play(true);
    expect(session.telemetry.enabled).toBe(true);
    session.telemetry.count('game.board.full');
    session.telemetry.count('game.board.full', 2);
    session.telemetry.metric('game.level-load-ms', 120);
    session.telemetry.frames({ buckets: [50, 3, 1, 0, 0, 0], slowestMs: 40, renderer: 'webgl' });
    session.telemetry.flush();
    await settle();
    expect(onProtocolError).not.toHaveBeenCalled();
    expect(received).toEqual([
      [
        { kind: 'frames', buckets: [50, 3, 1, 0, 0, 0], slowestMs: 40, renderer: 'webgl' },
        { kind: 'metric', name: 'game.level-load-ms', value: 120 },
        { kind: 'count', name: 'game.board.full', count: 3 },
      ],
    ]);
  });

  it('sends what the game reported while pausing, after its pause handlers ran', async () => {
    const { host, session, received, settle } = await play(true);
    session.on('pause', () => session.telemetry.count('game.paused'));
    host.pause();
    await settle();
    await settle();
    expect(received).toEqual([[{ kind: 'count', name: 'game.paused', count: 1 }]]);
  });

  it('sends what is waiting before asking to exit', async () => {
    const onExit = vi.fn();
    const { session, received, settle } = await play(true, { onExit });
    session.telemetry.count('game.quit');
    session.exit();
    await settle();
    expect(received).toEqual([[{ kind: 'count', name: 'game.quit', count: 1 }]]);
    expect(onExit).toHaveBeenCalled();
  });
});

describe('createTelemetry', () => {
  const collect = () => {
    const sent: TelemetryEvent[][] = [];
    let clock = 0;
    const telemetry = createTelemetry({
      send: (events) => sent.push(events),
      captureErrors: false,
      now: () => clock,
      setInterval: () => 0,
    });
    return { telemetry, sent, tick: (ms: number) => (clock += ms) };
  };

  it('counts an error that repeats instead of sending it again', () => {
    const { telemetry, sent } = collect();
    for (let i = 0; i < 3; i++) telemetry.error(new Error(`cell ${i} missing`));
    telemetry.flush();
    expect(sent[0]).toHaveLength(1);
    expect(sent[0]?.[0]).toMatchObject({ kind: 'error', message: 'Error: cell 0 missing', count: 3 });
  });

  it('keeps at most ten different errors a minute and counts the rest', () => {
    const { telemetry, sent, tick } = collect();
    for (let i = 0; i < 15; i++) telemetry.error(`problem ${String.fromCharCode(97 + i)}`);
    telemetry.flush();
    const first = sent[0] ?? [];
    expect(first.filter((e) => e.kind === 'error')).toHaveLength(10);
    expect(first).toContainEqual({ kind: 'count', name: 'sdk.errors-dropped', count: 5 });
    tick(61_000);
    telemetry.error('problem after a minute');
    telemetry.flush();
    expect(sent[1]).toEqual([{ kind: 'error', message: 'problem after a minute', count: 1 }]);
  });

  it('drops names that could carry text, and bad values', () => {
    const { telemetry, sent } = collect();
    telemetry.count('Player Na won');
    telemetry.count('game.ok', 0);
    telemetry.metric('game.time-ms', Number.NaN);
    telemetry.metric('game.time-ms', -1);
    telemetry.frames({ buckets: [1, 2], slowestMs: 1 });
    telemetry.flush();
    expect(sent).toEqual([]);
  });

  it('never sends more events than a message may hold', () => {
    const { telemetry, sent } = collect();
    for (let i = 0; i < 80; i++) telemetry.count(`game.thing-${i}`);
    telemetry.flush();
    expect(sent[0]).toHaveLength(MAX_TELEMETRY_EVENTS);
  });

  it('uses the same name rule as the contract', () => {
    expect(TELEMETRY_NAME.source).toBe(CONTRACT_NAME.source);
  });
});

describe('error descriptions', () => {
  it('keeps the top frames without the origin or query strings', () => {
    const stack = [
      'TypeError: x is undefined',
      '    at drop (http://10.100.0.2:4830/tap-merge/0.4.0/assets/index-abc.js?v=1:1:2345)',
      '    at http://10.100.0.2:4830/tap-merge/0.4.0/assets/index-abc.js:1:999',
      'not a frame',
    ].join('\n');
    expect(trimStack(stack)).toBe(
      'at drop (/tap-merge/0.4.0/assets/index-abc.js:1:2345)\nat /tap-merge/0.4.0/assets/index-abc.js:1:999',
    );
  });

  it('describes errors, strings and other values', () => {
    expect(describeError(new RangeError('too far')).message).toBe('RangeError: too far');
    expect(describeError('plain')).toEqual({ message: 'plain' });
    expect(describeError({ code: 7 })).toEqual({ message: '{"code":7}' });
    expect(describeError('x'.repeat(400)).message).toHaveLength(300);
  });

  it('treats errors that differ only in numbers as one', () => {
    expect(errorFingerprint('cell 3 missing', 'at a (/x.js:1:20)')).toBe(
      errorFingerprint('cell 12 missing', 'at a (/x.js:1:99)'),
    );
    expect(errorFingerprint('cell missing')).not.toBe(errorFingerprint('row missing'));
  });
});
