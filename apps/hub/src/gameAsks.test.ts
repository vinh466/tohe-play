import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import { ApiError, type GameSummary, type LinkIntent } from './api/client.ts';
import { createGameEntryStore, entryOfLink, wellFormedEntry } from './entry/gameEntry.ts';
import { createEntryStore } from './entry/intent.ts';
import { manifestFrom } from './launcher/manifest.ts';
import {
  createDeclines,
  DECLINE_MS,
  hostCan,
  meets,
  playLevel,
  profileKind,
  profileLevel,
  shareErrorOf,
  tableLevel,
  takesEntry,
} from './launcher/requests.ts';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const game: GameSummary = {
  id: 'merge-block',
  name: 'Merge Blocks',
  names: { vi: 'Ghép Khối' },
  version: '1.11.0',
  description: '',
  descriptions: {},
  entryUrl: 'http://localhost:4730/merge-block/1.11.0/index.html',
  iconUrl: null,
  orientation: 'portrait',
  capabilities: ['save', 'scores', 'shell'],
  tags: [],
  minAge: 3,
  sizeKb: 10,
  rooms: null,
  identity: { play: 'any', rooms: null },
  entries: ['share'],
};

const entry = { kind: 'share' as const, payload: { v: 1, seed: 913, score: 12340 }, version: '1.10.0' };

describe('a game’s levels and entries (ADR 0045)', () => {
  it('asks for the game’s level, and a table for the highest of play, rooms and a name', () => {
    expect(playLevel(game)).toBe('any');
    expect(tableLevel(game)).toBe('named');
    expect(tableLevel({ identity: { play: 'any', rooms: 'account' } })).toBe('account');
    expect(tableLevel({ identity: { play: 'account', rooms: 'named' } })).toBe('account');
    expect(playLevel({ identity: { play: 'named', rooms: null } })).toBe('named');
    expect(takesEntry(game, 'share')).toBe(true);
    expect(takesEntry({ ...game, entries: [] }, 'share')).toBe(false);
  });

  it('gives the host a manifest that declares the entries and the levels', () => {
    const manifest = manifestFrom({
      ...game,
      entries: ['share', 'daily'],
      identity: { play: 'named', rooms: 'x' },
    });
    expect(GameManifest.safeParse(manifest).success).toBe(true);
    expect(manifest.entries).toEqual(['share']);
    expect(manifest.identity).toEqual({ play: 'named' });
  });

  it('says the kind of the profile: a child’s is an account’s', () => {
    expect(profileKind({ kind: 'device' })).toBe('device');
    expect(profileKind({ kind: 'child' })).toBe('account');
    expect(profileKind({ kind: 'adult' })).toBe('account');
  });

  it('answers neither request at a table, in a replay or without a session; shares only with entries', () => {
    const base = { asking: true, elsewhere: false, entries: ['share'], mayPlayWithOthers: true };
    expect(hostCan(base)).toEqual({ require: true, share: true });
    expect(hostCan({ ...base, elsewhere: true })).toEqual({ require: false, share: false });
    expect(hostCan({ ...base, asking: false })).toEqual({ require: false, share: false });
    expect(hostCan({ ...base, entries: [] })).toEqual({ require: true, share: false });
    expect(hostCan({ ...base, mayPlayWithOthers: false })).toEqual({ require: true, share: false });
  });

  it('answers ok at once for a level the profile has', () => {
    expect(meets(profileLevel({ kind: 'device' }, false), 'named')).toBe(false);
    expect(meets(profileLevel({ kind: 'device' }, true), 'named')).toBe(true);
    expect(meets(profileLevel({ kind: 'device' }, true), 'account')).toBe(false);
    expect(meets(profileLevel({ kind: 'child' }, false), 'account')).toBe(true);
  });

  it('remembers "Để sau" for that game and profile for ten minutes', () => {
    let now = 0;
    const declines = createDeclines(() => now);
    declines.decline('merge-block', 'p1');
    expect(declines.declined('merge-block', 'p1')).toBe(true);
    expect(declines.declined('merge-block', 'p2')).toBe(false);
    expect(declines.declined('hello', 'p1')).toBe(false);
    now = DECLINE_MS;
    expect(declines.declined('merge-block', 'p1')).toBe(false);
  });

  it('tells the game why its link was not made', () => {
    const api = (status: number, code: string | null) =>
      Object.assign(Object.create(ApiError.prototype), { status, code, fields: {} });
    expect(shareErrorOf(api(429, 'link_limit'))).toBe('limit');
    expect(shareErrorOf(api(403, 'play_with_others_off'))).toBe('not_allowed');
    expect(shareErrorOf(api(400, 'entry_not_supported'))).toBe('not_allowed');
    expect(shareErrorOf(api(500, null))).toBe('unavailable');
    expect(shareErrorOf(new TypeError('Failed to fetch'))).toBe('offline');
  });
});

describe('the entry a game opens with (ADR 0045)', () => {
  const link = (extra: Partial<LinkIntent>): LinkIntent => ({
    code: '7KQ2M9XA',
    state: 'ok',
    kind: 'entry',
    gameId: 'merge-block',
    gameName: 'Ghép Khối',
    level: 'any',
    makerName: 'Na',
    entry: { payload: entry.payload, version: '1.10.0', makerAvatar: '🐱' },
    ...extra,
  });

  it('takes the payload, the version and the maker from what play answered', () => {
    expect(entryOfLink(link({}))).toEqual({ ...entry, from: { name: 'Na', avatar: '🐱' } });
    // A child's link names no one.
    const child = link({
      makerName: null,
      entry: { payload: entry.payload, version: entry.version, makerAvatar: null },
    });
    expect(entryOfLink(child)).toEqual(entry);
    expect(entryOfLink(link({ kind: 'game', entry: null }))).toBeNull();
    expect(entryOfLink(link({ state: 'revoked' }))).toBeNull();
    expect(
      entryOfLink(link({ entry: { payload: 'x'.repeat(3000), version: '1.0.0', makerAvatar: null } })),
    ).toBeNull();
  });

  it('keeps it on this tab for the game named, once, for an hour', () => {
    let now = 1_000;
    const store = createGameEntryStore(memory(), () => now);
    store.keep('merge-block', entry);
    expect(store.take('hello')).toBeNull();
    expect(store.take('merge-block')).toEqual({ gameId: 'merge-block', entry, at: 1_000 });
    expect(store.take('merge-block')).toBeNull();
    store.keep('merge-block', entry);
    now += 60 * 60 * 1000;
    expect(store.take('merge-block')).toBeNull();
  });

  it('keeps the game to open again after signing in, with its entry or without one', () => {
    const store = createGameEntryStore(memory(), () => 5);
    store.keep('merge-block', null);
    expect(store.take('merge-block')).toBeNull();
    store.keep('merge-block', null, true);
    expect(store.take('merge-block')).toEqual({ gameId: 'merge-block', entry: null, at: 5, reopen: true });
    store.keep('merge-block', entry, true);
    expect(store.take('merge-block')?.entry).toEqual(entry);
  });

  it('reads back only what is well formed, and goes when the tab’s entry is forgotten', () => {
    const storage = memory();
    const store = createGameEntryStore(storage, () => 5);
    storage.setItem('tohe:game-entry', JSON.stringify({ gameId: '../x', entry, at: 5 }));
    expect(store.take('../x')).toBeNull();
    expect(wellFormedEntry({ ...entry, version: 'latest' })).toBe(false);
    expect(wellFormedEntry({ ...entry, kind: 'daily' })).toBe(false);
    store.keep('merge-block', entry);
    createEntryStore(storage, () => 5).forget();
    expect(store.take('merge-block')).toBeNull();
  });
});
