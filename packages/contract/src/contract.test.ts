import { describe, expect, it } from 'vitest';
import { GameManifest, GameMessage, HostMessage } from './index.ts';

describe('GameManifest', () => {
  it('applies defaults to a minimal manifest', () => {
    const manifest = GameManifest.parse({
      id: 'merge-block',
      name: 'Merge Block',
      version: '1.0.0',
      protocol: 1,
    });
    expect(manifest).toMatchObject({
      entry: 'index.html',
      orientation: 'portrait',
      capabilities: [],
      themes: ['light'],
      minAge: 0,
      sizeBudgetKb: 3000,
    });
  });

  it('accepts a game with both themes or a dark-only one', () => {
    const base = { id: 'merge', name: 'x', version: '1.0.0', protocol: 1 };
    expect(GameManifest.parse({ ...base, themes: ['light', 'dark'] }).themes).toEqual(['light', 'dark']);
    expect(GameManifest.parse({ ...base, themes: ['dark'] }).themes).toEqual(['dark']);
  });

  it.each([
    ['uppercase id', { id: 'Merge', name: 'x', version: '1.0.0', protocol: 1 }],
    ['bad version', { id: 'merge', name: 'x', version: 'v1', protocol: 1 }],
    ['unknown protocol', { id: 'merge', name: 'x', version: '1.0.0', protocol: 2 }],
    ['unknown field', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, extra: true }],
    ['unknown theme', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, themes: ['blue'] }],
    ['no theme', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, themes: [] }],
  ])('rejects %s', (_label, input) => {
    expect(GameManifest.safeParse(input).success).toBe(false);
  });
});

describe('protocol', () => {
  it('parses a score message and defaults the board and finality', () => {
    const message = GameMessage.parse({ tohe: 1, type: 'score', id: 'r1', value: 42 });
    expect(message).toEqual({ tohe: 1, type: 'score', id: 'r1', value: 42, board: 'default', final: true });
  });

  it('accepts a run reporting its score while it goes on', () => {
    const message = GameMessage.parse({
      tohe: 1,
      type: 'score',
      id: 'r2',
      value: 7,
      run: 'run-1',
      final: false,
    });
    expect(message).toMatchObject({ run: 'run-1', final: false });
    expect(GameMessage.safeParse({ tohe: 1, type: 'score', id: 'r3', value: 7, run: '' }).success).toBe(
      false,
    );
  });

  it('ignores messages without the tohe marker', () => {
    expect(GameMessage.safeParse({ type: 'ready', gameId: 'hello', sdkVersion: '1' }).success).toBe(false);
  });

  it('rejects non-JSON save data', () => {
    expect(GameMessage.safeParse({ tohe: 1, type: 'save', id: 'r1', data: () => 1 }).success).toBe(false);
  });

  it('parses an init message with the hub theme', () => {
    const init = HostMessage.parse({
      tohe: 1,
      type: 'init',
      profile: { id: 'p1', name: 'Bé Na' },
      locale: 'vi',
      settings: { muted: false, theme: 'dark' },
      save: { best: 10 },
      seed: 123,
    });
    expect(init.type === 'init' && init.settings.theme).toBe('dark');
  });

  it('rejects settings without a known theme', () => {
    const settings = (theme: unknown) =>
      HostMessage.safeParse({ tohe: 1, type: 'settings', settings: { muted: false, theme } });
    expect(settings('light').success).toBe(true);
    expect(settings('sepia').success).toBe(false);
    expect(settings(undefined).success).toBe(false);
  });
});

describe('telemetry message', () => {
  const telemetry = (events: unknown) => GameMessage.safeParse({ tohe: 1, type: 'telemetry', events });

  it('accepts the four kinds of event', () => {
    const parsed = telemetry([
      { kind: 'error', message: 'TypeError: x', stack: 'at f (/a.js:1:2)', count: 2 },
      { kind: 'count', name: 'kit.renderer.canvas', count: 1 },
      { kind: 'metric', name: 'kit.first-frame-ms', value: 812 },
      { kind: 'frames', buckets: [100, 4, 2, 1, 0, 0], slowestMs: 48, stepP50Ms: 1.2, renderer: 'webgl' },
    ]);
    expect(parsed.success).toBe(true);
  });

  it('keeps names to identifiers, so no text about a player can ride along', () => {
    expect(telemetry([{ kind: 'count', name: 'Na scored 40', count: 1 }]).success).toBe(false);
    expect(telemetry([{ kind: 'count', name: 'game.Score', count: 1 }]).success).toBe(false);
  });

  it('rejects empty, oversized and malformed batches', () => {
    const many = Array.from({ length: 51 }, () => ({ kind: 'count', name: 'a.b', count: 1 }));
    expect(telemetry([]).success).toBe(false);
    expect(telemetry(many).success).toBe(false);
    expect(telemetry([{ kind: 'frames', buckets: [1, 2], slowestMs: 1 }]).success).toBe(false);
    expect(telemetry([{ kind: 'metric', name: 'a.b-ms', value: -1 }]).success).toBe(false);
  });

  it('lets init say whether telemetry is on, and older hubs leave it out', () => {
    const init = (extra: object) =>
      HostMessage.safeParse({
        tohe: 1,
        type: 'init',
        profile: { id: 'p1', name: 'Na' },
        locale: 'vi',
        settings: { muted: false, theme: 'light' },
        save: null,
        seed: 1,
        ...extra,
      });
    expect(init({}).success).toBe(true);
    expect(init({ telemetry: true }).success).toBe(true);
    expect(init({ telemetry: 'yes' }).success).toBe(false);
  });
});

describe('rooms (ADR 0016)', () => {
  const base = { id: 'tien-len', name: 'Tiến Lên', version: '0.2.0', protocol: 1 };
  const label = { vi: 'Chặt chồng', en: 'Stacked chops' };
  const rooms = {
    seats: { min: 2, max: 4 },
    bots: ['easy', 'normal', 'hard'],
    options: [
      { id: 'chopChain', type: 'boolean', label, default: true },
      {
        id: 'points',
        type: 'choice',
        label,
        choices: [
          { id: 'full', label },
          { id: 'places', label },
        ],
        default: 'full',
      },
      { id: 'instantWins', type: 'multi', label, choices: [{ id: 'dragon', label }], default: ['dragon'] },
    ],
  };

  it('accepts a game with the rooms capability and block, defaulting the rules file', () => {
    const manifest = GameManifest.parse({ ...base, capabilities: ['save', 'rooms'], rooms });
    expect(manifest.rooms?.rules).toBe('rules.js');
    expect(manifest.rooms?.options).toHaveLength(3);
  });

  it.each([
    ['the capability without the block', { capabilities: ['rooms'] }],
    ['the block without the capability', { rooms }],
    [
      'more seats at least than at most',
      { capabilities: ['rooms'], rooms: { ...rooms, seats: { min: 4, max: 2 } } },
    ],
    [
      'a default that is not a choice',
      {
        capabilities: ['rooms'],
        rooms: { ...rooms, options: [{ ...rooms.options[1], default: 'nope' }] },
      },
    ],
    [
      'a repeated option id',
      { capabilities: ['rooms'], rooms: { ...rooms, options: [rooms.options[0], rooms.options[0]] } },
    ],
    ['a rules file outside the build', { capabilities: ['rooms'], rooms: { ...rooms, rules: '../x.js' } }],
  ])('rejects %s', (_label, extra) => {
    expect(GameManifest.safeParse({ ...base, ...extra }).success).toBe(false);
  });

  it('carries the table in init, views and seats to the game, and actions and reactions back', () => {
    const seat = { profile: { id: 'p1', name: 'Na' }, bot: null, connected: true };
    const init = HostMessage.parse({
      tohe: 1,
      type: 'init',
      profile: { id: 'p1', name: 'Na' },
      locale: 'vi',
      settings: { muted: false, theme: 'light' },
      save: null,
      seed: 1,
      room: {
        id: 'r1',
        seat: 0,
        seats: [seat, { profile: null, bot: 'normal', connected: true }],
        options: {},
      },
    });
    expect(init.type === 'init' && init.room?.seats[1]?.bot).toBe('normal');
    expect(
      HostMessage.parse({
        tohe: 1,
        type: 'room.view',
        view: { hand: [1] },
        events: [],
        seq: 3,
        turnMs: null,
      }),
    ).toMatchObject({ seq: 3 });
    expect(
      HostMessage.safeParse({ tohe: 1, type: 'room.reaction', seat: 1, reaction: 'shout' }).success,
    ).toBe(false);
    expect(
      GameMessage.parse({ tohe: 1, type: 'room.act', id: 'r1', action: { type: 'pass' } }),
    ).toMatchObject({
      action: { type: 'pass' },
    });
    expect(GameMessage.safeParse({ tohe: 1, type: 'room.react', reaction: 'clap' }).success).toBe(true);
    expect(GameMessage.safeParse({ tohe: 1, type: 'room.react', reaction: 'free text' }).success).toBe(false);
  });
});

describe('ranked runs (ADR 0030)', () => {
  const base = { id: 'merge-block', name: 'Ghép Khối', version: '1.6.0', protocol: 1 };

  it('accepts the ranked capability and block with scores, defaulting the module, the board and the limits', () => {
    const manifest = GameManifest.parse({ ...base, capabilities: ['save', 'scores', 'ranked'], ranked: {} });
    expect(manifest.ranked).toEqual({
      verify: 'verify.js',
      board: 'default',
      minMsPerMove: 100,
      maxMoves: 20_000,
    });
  });

  it.each([
    ['the capability without the block', { capabilities: ['scores', 'ranked'] }],
    ['the block without the capability', { capabilities: ['scores'], ranked: {} }],
    ['a ranked game that keeps no scores', { capabilities: ['ranked'], ranked: {} }],
    [
      'a verify module outside the build',
      { capabilities: ['scores', 'ranked'], ranked: { verify: '../x.js' } },
    ],
    ['too many moves', { capabilities: ['scores', 'ranked'], ranked: { maxMoves: 100_001 } }],
  ])('rejects %s', (_label, extra) => {
    expect(GameManifest.safeParse({ ...base, ...extra }).success).toBe(false);
  });

  it('asks for a run, hands in its moves, and carries the run back in the result', () => {
    expect(GameMessage.parse({ tohe: 1, type: 'ranked.start', id: 'r1' })).toMatchObject({
      type: 'ranked.start',
    });
    const finish = { tohe: 1, type: 'ranked.finish', id: 'r2', run: 'run-1', moves: [0, 3, 4], score: 128 };
    expect(GameMessage.parse(finish)).toMatchObject({ moves: [0, 3, 4], score: 128 });
    expect(GameMessage.safeParse({ ...finish, score: Number.NaN }).success).toBe(false);
    expect(GameMessage.safeParse({ ...finish, moves: Array(100_001).fill(0) }).success).toBe(false);
    const result = { tohe: 1, type: 'result', replyTo: 'r1', ok: true, value: { run: 'run-1', seed: 7 } };
    expect(HostMessage.parse(result)).toMatchObject({ value: { run: 'run-1', seed: 7 } });
  });
});
