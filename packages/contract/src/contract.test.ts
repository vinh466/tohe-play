import { describe, expect, it } from 'vitest';
import {
  GameManifest,
  GameMessage,
  gameContentSecurityPolicy,
  gameLevels,
  HostMessage,
  highestIdentityLevel,
  jsonBytes,
} from './index.ts';

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

  it('opens a game to watch a ranked run: its seed and moves, within the limit (ADR 0032)', () => {
    const init = {
      tohe: 1,
      type: 'init',
      profile: { id: 'p1', name: 'Na' },
      locale: 'vi',
      settings: { muted: true, theme: 'light' },
      save: null,
      seed: 1,
      rankedReplay: { seed: 913, moves: [0, 4, 2] },
    };
    const parsed = HostMessage.parse(init);
    expect(parsed.type === 'init' && parsed.rankedReplay).toEqual({ seed: 913, moves: [0, 4, 2] });
    expect(
      HostMessage.safeParse({ ...init, rankedReplay: { seed: 913, moves: Array(100_001).fill(0) } }).success,
    ).toBe(false);
    expect(HostMessage.safeParse({ ...init, rankedReplay: { seed: 1.5, moves: [] } }).success).toBe(false);
    expect(HostMessage.safeParse({ ...init, rankedReplay: { seed: 1, moves: [], run: 'x' } }).success).toBe(
      false,
    );
  });
});

describe('identity and entries (ADR 0045)', () => {
  const base = { id: 'merge-block', name: 'Ghép Khối', version: '1.11.0', protocol: 1 };
  const rooms = { seats: { min: 2, max: 4 } };

  it('leaves both out by default: any profile opens the game, and a table asks for a name', () => {
    const manifest = GameManifest.parse(base);
    expect(manifest.identity).toBeUndefined();
    expect(manifest.entries).toBeUndefined();
    expect(gameLevels(manifest)).toEqual({ play: 'any', table: null });
    const online = GameManifest.parse({ ...base, capabilities: ['rooms'], rooms });
    expect(gameLevels(online)).toEqual({ play: 'any', table: 'named' });
  });

  it('takes the levels and the share entry, defaulting play to any', () => {
    const manifest = GameManifest.parse({ ...base, identity: {}, entries: ['share'] });
    expect(manifest.identity).toEqual({ play: 'any' });
    expect(manifest.entries).toEqual(['share']);
    const online = GameManifest.parse({
      ...base,
      capabilities: ['rooms'],
      rooms,
      identity: { play: 'named', rooms: 'account' },
    });
    expect(gameLevels(online)).toEqual({ play: 'named', table: 'account' });
    expect(gameLevels({ capabilities: ['rooms'], identity: { play: 'account' } })).toEqual({
      play: 'account',
      table: 'account',
    });
  });

  it.each([
    ['identity.rooms without the rooms capability', { identity: { rooms: 'named' } }],
    ['an unknown level', { identity: { play: 'guest' } }],
    ['any as the rooms level', { capabilities: ['rooms'], rooms, identity: { rooms: 'any' } }],
    ['an unknown entry kind', { entries: ['notification'] }],
    ['a repeated entry kind', { entries: ['share', 'share'] }],
    ['an unknown identity field', { identity: { play: 'any', extra: 1 } }],
  ])('rejects %s', (_label, extra) => {
    expect(GameManifest.safeParse({ ...base, ...extra }).success).toBe(false);
  });

  it('orders the levels any < named < account', () => {
    expect(highestIdentityLevel()).toBe('any');
    expect(highestIdentityLevel('named', 'any', undefined)).toBe('named');
    expect(highestIdentityLevel('named', 'account', null)).toBe('account');
  });

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

  it('carries the profile kind, an entry and what the hub answers in init, all optional', () => {
    const entry = { kind: 'share', payload: { v: 1, seed: 7, score: 12340 }, version: '1.11.0' };
    expect(init({}).success).toBe(true);
    expect(init({ profile: { id: 'p1', name: 'Na', kind: 'device' } }).success).toBe(true);
    expect(init({ profile: { id: 'p1', name: 'Na', kind: 'guest' } }).success).toBe(false);
    expect(init({ entry, can: { require: true, share: true } }).success).toBe(true);
    expect(init({ entry: { ...entry, from: { name: 'Na', avatar: '🐱' } } }).success).toBe(true);
    expect(init({ entry: { ...entry, kind: 'daily' } }).success).toBe(false);
    expect(init({ entry: { ...entry, version: 'latest' } }).success).toBe(false);
    expect(init({ can: { require: true } }).success).toBe(false);
  });

  it('keeps an entry payload to 2 KB as UTF-8, whatever it holds', () => {
    const entry = (payload: unknown) => init({ entry: { kind: 'share', payload, version: '1.0.0' } }).success;
    expect(entry(null)).toBe(true);
    expect(entry('a'.repeat(2046))).toBe(true);
    expect(jsonBytes('a'.repeat(2046))).toBe(2048);
    expect(entry('a'.repeat(2047))).toBe(false);
    // Vietnamese takes more than one byte a character.
    expect(entry('ế'.repeat(700))).toBe(false);
  });

  it('answers an entry, asks for a level with a reason, and asks to share', () => {
    expect(GameMessage.safeParse({ tohe: 1, type: 'entry', result: 'handled' }).success).toBe(true);
    expect(GameMessage.safeParse({ tohe: 1, type: 'entry', result: 'maybe' }).success).toBe(false);
    const require = { tohe: 1, type: 'identity.require', id: 'r1', level: 'account', reason: 'ranked' };
    expect(GameMessage.safeParse(require).success).toBe(true);
    expect(GameMessage.safeParse({ ...require, level: 'any' }).success).toBe(false);
    expect(GameMessage.safeParse({ ...require, reason: 'Sign in to win a prize!' }).success).toBe(false);
    const share = { tohe: 1, type: 'share', id: 'r2', payload: { v: 1 }, text: 'Hi', level: 'any' };
    expect(GameMessage.safeParse(share).success).toBe(true);
    expect(GameMessage.safeParse({ ...share, level: 'guest' }).success).toBe(false);
    expect(GameMessage.safeParse({ ...share, text: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('game CSP', () => {
  const directives = (csp: string) =>
    new Map(csp.split('; ').map((d) => [d.split(' ')[0], d.slice(d.indexOf(' ') + 1)]));

  it('lets only the hubs embed a game, and a game page submit no form, even to a hub on the same site (ADR 0040)', () => {
    const csp = directives(gameContentSecurityPolicy(['https://toheplay.io.vn']));
    expect(csp.get('frame-ancestors')).toBe('https://toheplay.io.vn');
    expect(csp.get('form-action')).toBe("'none'");
    expect(csp.get('connect-src')).toBe("'self'");
  });

  it('lets nobody embed a game when no hub is given', () => {
    expect(directives(gameContentSecurityPolicy([])).get('frame-ancestors')).toBe("'none'");
  });
});
