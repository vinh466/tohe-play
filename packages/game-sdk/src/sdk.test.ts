import { REACTIONS as CONTRACT_REACTIONS, type GameManifest, PROTOCOL_VERSION } from '@tohe/contract';
import { describe, expect, it, vi } from 'vitest';
import { createHost, type HostOptions } from './host.ts';
import { connect, createRng, memoryTransportPair, normalizeSettings, PROTOCOL, REACTIONS } from './index.ts';

const manifest: GameManifest = {
  id: 'hello',
  name: 'Hello',
  version: '1.0.0',
  protocol: 1,
  description: '',
  entry: 'index.html',
  orientation: 'portrait',
  capabilities: ['save', 'scores'],
  themes: ['light', 'dark'],
  minAge: 0,
  tags: [],
  sizeBudgetKb: 3000,
};

function setup(overrides: Partial<HostOptions> = {}) {
  const [gameSide, hostSide] = memoryTransportPair();
  const host = createHost({
    transport: hostSide,
    manifest,
    init: () => ({
      profile: { id: 'p1', name: 'Na' },
      locale: 'vi',
      settings: { muted: false, theme: 'dark' },
      save: { best: 7 },
      seed: 42,
    }),
    ...overrides,
  });
  return { host, gameSide };
}

describe('game <-> host handshake', () => {
  it('delivers init data to the game', async () => {
    const { host, gameSide } = setup();
    const session = await connect<{ best: number }>({ gameId: 'hello', transport: gameSide });
    await host.ready;
    expect(session.mode).toBe('embedded');
    expect(session.profile.name).toBe('Na');
    expect(session.saved).toEqual({ best: 7 });
    expect(session.seed).toBe(42);
    expect(session.settings).toEqual({ muted: false, theme: 'dark' });
  });

  it('round-trips save and score', async () => {
    const onSave = vi.fn();
    const onScore = vi.fn();
    const { gameSide } = setup({ onSave, onScore });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await session.save({ best: 9 });
    await session.submitScore(9);
    expect(onSave).toHaveBeenCalledWith({ best: 9 });
    expect(onScore).toHaveBeenCalledWith({ value: 9, board: 'default', final: true });
  });

  it('reports a long run as it grows, then finishes it', async () => {
    const onScore = vi.fn();
    const { gameSide } = setup({ onScore });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    const run = session.run('run-7');
    await run.update(10);
    await run.finish(25);
    expect(onScore.mock.calls.map(([score]) => score)).toEqual([
      { value: 10, board: 'default', run: 'run-7', final: false },
      { value: 25, board: 'default', run: 'run-7', final: true },
    ]);
  });

  it('surfaces host-side failures as rejected promises', async () => {
    const { gameSide } = setup({
      onSave: () => {
        throw new Error('disk full');
      },
    });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await expect(session.save({})).rejects.toThrow('disk full');
  });

  it('rejects capabilities the manifest does not declare', async () => {
    const { gameSide } = setup({ manifest: { ...manifest, capabilities: [] } });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await expect(session.submitScore(1)).rejects.toThrow('capability "scores"');
  });

  it('forwards pause, resume and settings', async () => {
    const { host, gameSide } = setup();
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await host.ready;
    const events: string[] = [];
    session.on('pause', () => events.push('pause'));
    session.on('resume', () => events.push('resume'));
    session.on('settings', (s) => events.push(`muted=${s.muted} theme=${s.theme}`));
    host.pause();
    host.resume();
    host.setSettings({ muted: true, theme: 'light' });
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual(['pause', 'resume', 'muted=true theme=light']);
    expect(session.settings).toEqual({ muted: true, theme: 'light' });
  });

  it('completes settings from a host that sends no theme (light)', () => {
    expect(normalizeSettings({ muted: true })).toEqual({ muted: true, theme: 'light' });
    expect(normalizeSettings(undefined)).toEqual({ muted: false, theme: 'light' });
    expect(normalizeSettings({ muted: false, theme: 'dark' })).toEqual({ muted: false, theme: 'dark' });
  });

  it('refuses a game that announces the wrong id', async () => {
    const onProtocolError = vi.fn();
    const { gameSide } = setup({ onProtocolError, readyTimeoutMs: 50 });
    await expect(connect({ gameId: 'other', transport: gameSide, timeoutMs: 50 })).rejects.toThrow('no init');
    expect(onProtocolError).toHaveBeenCalledWith(
      expect.stringContaining('expected "hello"'),
      expect.anything(),
    );
  });

  it('keeps the SDK protocol constant in sync with the contract', () => {
    expect(PROTOCOL).toBe(PROTOCOL_VERSION);
  });
});

describe('rooms (ADR 0016)', () => {
  const roomManifest: GameManifest = {
    ...manifest,
    id: 'hello',
    capabilities: ['rooms'],
    rooms: { rules: 'rules.js', seats: { min: 2, max: 4 }, bots: ['normal'], options: [] },
  };
  const seats = [
    { profile: { id: 'p1', name: 'Na' }, bot: null, connected: true },
    { profile: null, bot: 'normal', connected: true },
  ];

  function table(overrides: Partial<HostOptions> = {}) {
    const [gameSide, hostSide] = memoryTransportPair();
    const host = createHost({
      transport: hostSide,
      manifest: roomManifest,
      init: () => ({
        profile: { id: 'p1', name: 'Na' },
        locale: 'vi',
        settings: { muted: false, theme: 'light' },
        save: null,
        seed: 1,
        room: { id: 'room-1', seat: 0, seats, options: { chopChain: true } },
      }),
      ...overrides,
    });
    return { host, gameSide };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('gives the game its seat and keeps the newest view, even one sent before it listens', async () => {
    const { host, gameSide } = table();
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await host.ready;
    host.roomView({ view: { hand: [1, 2] }, events: [], seq: 1, turnMs: 20_000 });
    await tick();
    const room = session.room;
    expect(room?.seat).toBe(0);
    expect(room?.options).toEqual({ chopChain: true });
    expect(room?.latest).toEqual({ view: { hand: [1, 2] }, events: [], seq: 1, turnMs: 20_000 });
    const views: number[] = [];
    room?.onView((update) => views.push(update.seq));
    host.roomView({ view: {}, events: [{ type: 'pass' }], seq: 3, turnMs: null });
    host.roomView({ view: {}, events: [], seq: 2, turnMs: null }); // late: dropped
    await tick();
    expect(views).toEqual([3]);
  });

  it('sends actions to the referee and rejects with its error code', async () => {
    const onRoomAct = vi.fn((action: unknown) => {
      if ((action as { type: string }).type === 'pass') throw new Error('must_lead');
    });
    const onRoomNext = vi.fn();
    const onRoomReact = vi.fn();
    const { host, gameSide } = table({ onRoomAct, onRoomNext, onRoomReact });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await host.ready;
    await session.room?.act({ type: 'play', cards: [0] });
    await expect(session.room?.act({ type: 'pass' })).rejects.toThrow('must_lead');
    await session.room?.next();
    session.room?.react('clap');
    await tick();
    expect(onRoomAct).toHaveBeenCalledTimes(2);
    expect(onRoomNext).toHaveBeenCalledOnce();
    expect(onRoomReact).toHaveBeenCalledWith('clap');
  });

  it('passes on seats and reactions', async () => {
    const { host, gameSide } = table();
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await host.ready;
    const seen: string[] = [];
    session.room?.onSeats((next) => seen.push(`seats ${next.length}`));
    session.room?.onReaction((seat, reaction) => seen.push(`${seat} ${reaction}`));
    host.roomSeats([...seats, { profile: null, bot: null, connected: true }], 2);
    host.roomReaction(1, 'wave');
    await tick();
    expect(seen).toEqual(['seats 3', '1 wave']);
    expect(session.room?.seats).toHaveLength(3);
    expect(session.room?.seat).toBe(2);
  });

  it('refuses room messages from a game without the capability', async () => {
    const { gameSide } = setup();
    const session = await connect({ gameId: 'hello', transport: gameSide });
    expect(session.room).toBeNull();
  });

  it('gives a game a finished hand to replay', async () => {
    const replay = {
      seats,
      seat: 0,
      seed: 7,
      options: { chopChain: true },
      carry: null,
      actions: [{ seat: 0, action: { type: 'play', cards: [0] } }],
    };
    const [gameSide, hostSide] = memoryTransportPair();
    const host = createHost({
      transport: hostSide,
      manifest: roomManifest,
      init: () => ({
        profile: { id: 'p1', name: 'Na' },
        locale: 'vi',
        settings: { muted: false, theme: 'light' },
        save: null,
        seed: 1,
        replay,
      }),
    });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await host.ready;
    expect(session.replay).toEqual(replay);
    expect(session.room).toBeNull();
  });

  it('has a picture for every reaction of the contract', () => {
    expect(Object.keys(REACTIONS).sort()).toEqual([...CONTRACT_REACTIONS].sort());
  });
});

describe('game shell (ADR 0018)', () => {
  const shellManifest: GameManifest = { ...manifest, capabilities: ['save', 'scores', 'shell'] };
  const shellInit = () => ({
    profile: { id: 'p1', name: 'Na' },
    locale: 'vi',
    settings: { muted: false, theme: 'light' as const },
    save: null,
    seed: 1,
    shell: { leaderboard: true, rooms: false },
  });

  it('tells the game what the hub can open, and passes Back on as `menu`', async () => {
    const [gameSide, hostSide] = memoryTransportPair();
    const host = createHost({ transport: hostSide, manifest: shellManifest, init: shellInit });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    await host.ready;
    expect(session.shell.can).toEqual({ leaderboard: true, rooms: false });
    const back = vi.fn();
    session.on('menu', back);
    host.menu();
    await vi.waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it('sends the menu state, what to open and the sound switch to the hub', async () => {
    const onMenu = vi.fn();
    const onOpen = vi.fn();
    const onSettings = vi.fn();
    const [gameSide, hostSide] = memoryTransportPair();
    createHost({ transport: hostSide, manifest: shellManifest, init: shellInit, onMenu, onOpen, onSettings });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    const heard: boolean[] = [];
    session.on('settings', (settings) => heard.push(settings.muted));
    session.shell.menuChanged(true);
    session.shell.open('leaderboard');
    session.shell.setMuted(true);
    expect(session.settings.muted).toBe(true);
    expect(heard).toEqual([true]);
    await vi.waitFor(() => expect(onSettings).toHaveBeenCalledWith({ muted: true }));
    expect(onMenu).toHaveBeenCalledWith(true);
    expect(onOpen).toHaveBeenCalledWith('leaderboard');
  });

  it('refuses shell messages from a game without the capability', async () => {
    const onProtocolError = vi.fn();
    const onOpen = vi.fn();
    const { gameSide } = setup({ onProtocolError, onOpen });
    const session = await connect({ gameId: 'hello', transport: gameSide });
    expect(session.shell.can).toEqual({ leaderboard: false, rooms: false });
    session.shell.open('leaderboard');
    await vi.waitFor(() => expect(onProtocolError).toHaveBeenCalled());
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 5 }, () => a.int(0, 100));
    const seqB = Array.from({ length: 5 }, () => b.int(0, 100));
    expect(seqA).toEqual(seqB);
    expect(createRng(124).next()).not.toBe(createRng(123).next());
  });
});
