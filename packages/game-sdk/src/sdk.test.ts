import { type GameManifest, PROTOCOL_VERSION } from '@tohe/contract';
import { describe, expect, it, vi } from 'vitest';
import { createHost, type HostOptions } from './host.ts';
import { connect, createRng, memoryTransportPair, normalizeSettings, PROTOCOL } from './index.ts';

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
    expect(onScore).toHaveBeenCalledWith({ value: 9, board: 'default' });
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
