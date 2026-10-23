// Coming back (ADR 0046, docs/architecture/surfaces.md "Coming back"): what a profile opened last, "Ai đang chơi?"
// after 30 minutes unused, the manage PIN before a child's profile moves up to an adult's, an ended session that says
// so, a new version that never interrupts play, links handed to the installed app, and its persistent storage.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSummary, MeView, ProfileView } from './api/client.ts';
import { showsInstalledAppHint } from './install/InstalledAppHint.tsx';
import { isIos } from './install/install.ts';
import { askPersistentStorage, launchTarget, PERSIST_KEY } from './install/launch.ts';
import {
  comingBack,
  markReturning,
  OPENED_KEPT,
  type Opened,
  openedBy,
  openedKey,
  RECENT_SHOWN,
  RETURNING_KEY,
  readOpened,
  recordOpened,
  withOpened,
} from './launcher/recent.ts';
import { createSessionEnded, SESSION_ENDED_KEY, sessionEndedBy } from './session/ended.ts';
import {
  asksWhoIsPlaying,
  createWhoIsPlaying,
  IDLE_MS,
  idleBefore,
  LAST_USED_KEY,
  switchNeedsGate,
} from './session/whoIsPlaying.ts';
import { openDb } from './storage/db.ts';
import { createDeviceProfile, deleteDeviceProfile, reIdDeviceProfile } from './storage/deviceProfiles.ts';
import { appliesOutOfSight, createUpdateStore, holdsWork, showsUpdateNotice } from './update/update.ts';

function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const local = memory();
vi.stubGlobal('localStorage', local);
beforeEach(() => local.values.clear());

const fresh = () => openDb(`test-${crypto.randomUUID()}`);

const game = (id: string): GameSummary => ({
  id,
  name: id,
  names: {},
  version: '1.0.0',
  description: '',
  descriptions: {},
  entryUrl: `http://localhost:4730/${id}/1.0.0/index.html`,
  iconUrl: null,
  orientation: 'portrait',
  capabilities: [],
  tags: [],
  minAge: 0,
  sizeKb: 1,
  rooms: null,
  identity: { play: 'any', rooms: null },
  entries: [],
});

describe('"Chơi tiếp" and "Gần đây": what a profile opened, on this device', () => {
  it('puts the game opened now first, once, and keeps a short list', () => {
    let list: Opened[] = [];
    list = withOpened(list, 'hello', 1);
    list = withOpened(list, 'merge-block', 2);
    list = withOpened(list, 'hello', 3);
    expect(list).toEqual([
      { gameId: 'hello', at: 3 },
      { gameId: 'merge-block', at: 2 },
    ]);
    for (let i = 0; i < OPENED_KEPT + 5; i++) list = withOpened(list, `game-${i}`, 10 + i);
    expect(list).toHaveLength(OPENED_KEPT);
    expect(list[0]?.gameId).toBe(`game-${OPENED_KEPT + 4}`);
  });

  it('reads back only a list of games and times', () => {
    expect(readOpened(undefined)).toEqual([]);
    expect(readOpened('hello')).toEqual([]);
    expect(readOpened([{ gameId: 'hello', at: 1 }, { gameId: 2 }, null, 'x'])).toEqual([
      { gameId: 'hello', at: 1 },
    ]);
  });

  it('offers the last game as "Chơi tiếp" and the ones before as "Gần đây", among the games listed now', () => {
    const opened = [
      { gameId: 'tien-len', at: 5 },
      { gameId: 'gone', at: 4 },
      { gameId: 'hello', at: 3 },
      { gameId: 'merge-block', at: 2 },
    ];
    const games = [game('hello'), game('merge-block'), game('tien-len')];
    const back = comingBack(opened, games);
    expect(back.last?.id).toBe('tien-len');
    expect(back.recent.map((g) => g.id)).toEqual(['hello', 'merge-block']);
  });

  it('offers nothing to a profile that opened nothing, nor a game its catalog no longer lists (a child’s age)', () => {
    expect(comingBack([], [game('hello')])).toEqual({ last: null, recent: [] });
    expect(comingBack([{ gameId: 'for-adults', at: 1 }], [game('hello')])).toEqual({
      last: null,
      recent: [],
    });
  });

  it('shows a few recent games at most', () => {
    const many = Array.from({ length: 10 }, (_, i) => game(`g${i}`));
    const opened = many.map((g, i) => ({ gameId: g.id, at: 100 - i }));
    expect(comingBack(opened, many).recent).toHaveLength(RECENT_SHOWN);
  });

  it('is kept per profile: one profile’s games are not another’s', async () => {
    const db = fresh();
    await recordOpened(db, 'kid', 'hello', 1);
    await recordOpened(db, 'kid', 'merge-block', 2);
    await recordOpened(db, 'dad', 'tien-len', 3);
    expect((await openedBy(db, 'kid')).map((o) => o.gameId)).toEqual(['merge-block', 'hello']);
    expect((await openedBy(db, 'dad')).map((o) => o.gameId)).toEqual(['tien-len']);
    expect(await openedBy(db, 'nobody')).toEqual([]);
  });

  it('goes with a device profile that is deleted, and follows one that gets a new id', async () => {
    const db = fresh();
    const first = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐱' });
    const second = await createDeviceProfile(db, { name: 'Cáo', avatar: '🦊' });
    await recordOpened(db, first.id, 'hello');
    await recordOpened(db, second.id, 'merge-block');
    expect(await deleteDeviceProfile(db, first.id)).toBe(true);
    expect(await db.cache.get(openedKey(first.id))).toBeUndefined();

    const next = await reIdDeviceProfile(db, second.id);
    expect((await openedBy(db, next)).map((o) => o.gameId)).toEqual(['merge-block']);
    expect(await db.cache.get(openedKey(second.id))).toBeUndefined();
  });
});

describe('"Ai đang chơi?" after 30 minutes unused', () => {
  const now = Date.parse('2026-10-22T10:00:00Z');

  it('follows 30 minutes unused, not less; a first start or a clock set back asks nothing', () => {
    expect(idleBefore(now - IDLE_MS, now)).toBe(true);
    expect(idleBefore(now - 2 * 60 * 60 * 1000, now)).toBe(true);
    expect(idleBefore(now - IDLE_MS + 1000, now)).toBe(false);
    expect(idleBefore(null, now)).toBe(false);
    expect(idleBefore(now + 60_000, now)).toBe(false);
  });

  it('is asked only on a device with more than one profile', () => {
    expect(asksWhoIsPlaying(true, 2)).toBe(true);
    expect(asksWhoIsPlaying(true, 1)).toBe(false);
    expect(asksWhoIsPlaying(false, 3)).toBe(false);
  });

  it('is decided at the cold start, noted, and asked once', () => {
    const storage = memory();
    let clock = now;
    const first = createWhoIsPlaying(storage, () => clock);
    first.start();
    expect(first.pending()).toBe(false);
    expect(storage.getItem(LAST_USED_KEY)).toBe(String(now));

    // Used for a while, then closed; opened again 40 minutes later.
    clock += 5 * 60 * 1000;
    first.touch();
    clock += 40 * 60 * 1000;
    const later = createWhoIsPlaying(storage, () => clock);
    later.start();
    expect(later.pending()).toBe(true);
    later.asked();
    expect(later.pending()).toBe(false);

    // A reload ten minutes on is no cold start after 30 minutes.
    clock += 10 * 60 * 1000;
    const reload = createWhoIsPlaying(storage, () => clock);
    reload.start();
    expect(reload.pending()).toBe(false);
  });

  it('asks nothing where storage is refused', () => {
    const refused = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createWhoIsPlaying(refused, () => now);
    store.start();
    expect(store.pending()).toBe(false);
  });
});

describe('the manage PIN when a child’s profile moves up', () => {
  const profile = (id: string, kind: 'adult' | 'child'): ProfileView => ({
    id,
    publicId: '572000000006',
    name: id,
    avatar: '🦊',
    kind,
    ageBand: kind === 'child' ? '6-8' : null,
    hasPin: false,
    playWithOthers: true,
    onPublicBoards: true,
    hiddenFromBoards: false,
    invites: 'anyone',
  });
  const dad = profile('dad', 'adult');
  const mum = profile('mum', 'adult');
  const na = profile('na', 'child');
  const bi = profile('bi', 'child');
  const me = (active: string | null, unlockedUntil: string | null = null) =>
    ({
      profiles: [dad, mum, na, bi],
      activeProfileId: active,
      parentUnlockedUntil: unlockedUntil,
    }) as MeView;
  const now = new Date('2026-10-22T10:00:00Z');

  it('asks for it from a child’s profile to an adult’s', () => {
    expect(switchNeedsGate(me('na'), dad, now)).toBe(true);
  });

  it('does not ask while management is open on this device', () => {
    expect(switchNeedsGate(me('na', '2026-10-22T10:05:00Z'), dad, now)).toBe(false);
    expect(switchNeedsGate(me('na', '2026-10-22T09:55:00Z'), dad, now)).toBe(true);
  });

  it('never asks the other way, between children, between adults, or for the first choice', () => {
    expect(switchNeedsGate(me('dad'), na, now)).toBe(false);
    expect(switchNeedsGate(me('na'), bi, now)).toBe(false);
    expect(switchNeedsGate(me('dad'), mum, now)).toBe(false);
    expect(switchNeedsGate(me(null), dad, now)).toBe(false);
    expect(switchNeedsGate(me('na'), na, now)).toBe(false);
  });
});

describe('an account’s session that ended', () => {
  const someone = { profiles: [] } as unknown as MeView;

  it('is a session the device knew that the API no longer does', () => {
    expect(sessionEndedBy(someone, null)).toBe(true);
    expect(sessionEndedBy(undefined, null)).toBe(false);
    expect(sessionEndedBy(null, null)).toBe(false);
    expect(sessionEndedBy(someone, someone)).toBe(false);
  });

  it('is kept through a reload until someone signs in or chooses the device', () => {
    const storage = memory();
    const ended = createSessionEnded(storage);
    const heard: boolean[] = [];
    ended.subscribe(() => heard.push(ended.get()));
    expect(ended.get()).toBe(false);
    ended.mark();
    ended.mark();
    expect(storage.getItem(SESSION_ENDED_KEY)).toBe('1');
    expect(createSessionEnded(storage).get()).toBe(true);
    ended.clear();
    expect(ended.get()).toBe(false);
    expect(heard).toEqual([true, false]);
  });

  it('is cleared by choosing to play on the device’s profiles', async () => {
    local.setItem(SESSION_ENDED_KEY, '1');
    const { deviceMode } = await import('./session/session.ts');
    const { sessionEnded } = await import('./session/ended.ts');
    deviceMode.enable();
    expect(sessionEnded.get()).toBe(false);
  });
});

describe('a new version', () => {
  it('is offered on the frame’s screens only — never in a game, at a table or in a replay', () => {
    for (const path of ['/play', '/together', '/account', '/account/profiles', '/account/links']) {
      expect(showsUpdateNotice(true, path), path).toBe(true);
    }
    for (const path of [
      '/play/hello',
      '/play/tien-len/rooms',
      '/play/tien-len/rooms/abc',
      '/play/tien-len/rooms/abc/replay/2',
      '/r/482913',
      '/s/7KQ2M9XA',
    ]) {
      expect(showsUpdateNotice(true, path), path).toBe(false);
    }
    expect(showsUpdateNotice(false, '/play')).toBe(false);
  });

  function wired(waiting = true) {
    const store = createUpdateStore();
    const done: string[] = [];
    store.connect({
      skipWaiting: async () => void done.push('skip'),
      hasWaiting: () => waiting,
      reload: () => done.push('reload'),
    });
    return { store, done };
  }

  it('never reloads by itself: another tab moving to it only shows the notice', () => {
    const { store, done } = wired();
    store.controlling();
    expect(done).toEqual([]);
    expect(store.waiting()).toBe(true);
  });

  it('takes over and reloads when the player taps "Tải lại"', async () => {
    const { store, done } = wired();
    store.found();
    await store.apply();
    expect(done).toEqual(['skip']);
    store.controlling();
    expect(done).toEqual(['skip', 'reload']);
  });

  it('reloads at once on "Tải lại" when nothing waits any more', async () => {
    const { store, done } = wired(false);
    store.found();
    await store.apply();
    expect(done).toEqual(['reload']);
  });

  const at = (pathname: string, search = '') => ({ pathname, search });

  it('is taken out of sight on a screen of the frame that a reload brings back as it was', () => {
    for (const path of ['/play', '/play/', '/together', '/account', '/account/links']) {
      expect(appliesOutOfSight(true, at(path), false), path).toBe(true);
    }
    expect(appliesOutOfSight(true, at('/together', '?code=1'), false)).toBe(true);
  });

  it('is never taken out of sight in a game, at a table, in a replay or on a link into them', () => {
    for (const path of [
      '/play/hello',
      '/play/tien-len/rooms',
      '/play/tien-len/rooms/abc',
      '/play/tien-len/rooms/abc/replay/2',
      '/r/482913',
      '/s/7KQ2M9XA',
    ]) {
      expect(appliesOutOfSight(true, at(path), false), path).toBe(false);
    }
  });

  it('waits out of sight on a screen whose step lives only in the page, or with work in it', () => {
    for (const path of [
      '/account/sign-in',
      '/account/sign-in/continue',
      '/account/register',
      '/account/register/confirm',
      '/account/password/forgot',
      '/account/password/reset',
      '/account/email',
      '/account/profiles',
      '/account/transfer',
      '/account/transfer/send',
    ]) {
      expect(appliesOutOfSight(true, at(path), false), path).toBe(false);
    }
    // Quản lý tài khoản: the parent gate and the forms behind it.
    expect(appliesOutOfSight(true, at('/account', '?manage=true'), false)).toBe(false);
    expect(appliesOutOfSight(true, at('/play'), true)).toBe(false);
    expect(appliesOutOfSight(false, at('/play'), false)).toBe(false);
  });

  it('counts an open dialog and a field with text in it as work, not an empty field or a checkbox', () => {
    const page = (dialog: boolean, fields: { tagName: string; type?: string; value: string }[]) =>
      ({
        querySelector: (selector: string) => (selector === 'dialog[open]' && dialog ? {} : null),
        querySelectorAll: () => fields,
      }) as unknown as ParentNode;
    expect(holdsWork(page(false, []))).toBe(false);
    expect(holdsWork(page(true, []))).toBe(true);
    expect(holdsWork(page(false, [{ tagName: 'INPUT', type: 'text', value: '  ' }]))).toBe(false);
    expect(holdsWork(page(false, [{ tagName: 'INPUT', type: 'checkbox', value: 'on' }]))).toBe(false);
    expect(holdsWork(page(false, [{ tagName: 'INPUT', type: 'text', value: '4829' }]))).toBe(true);
    expect(holdsWork(page(false, [{ tagName: 'TEXTAREA', value: 'Chào' }]))).toBe(true);
  });

  it('takes over and reloads as the app goes out of sight on /play', async () => {
    const { store, done } = wired();
    store.found();
    await store.outOfSight(at('/play'), false);
    expect(done).toEqual(['skip']);
    store.controlling();
    expect(done).toEqual(['skip', 'reload']);
  });

  it('reloads nothing as the app goes out of sight in a game, with work in the page, or with nothing waiting', async () => {
    const { store, done } = wired();
    await store.outOfSight(at('/play'), false);
    expect(done).toEqual([]);
    store.found();
    await store.outOfSight(at('/play/hello'), false);
    await store.outOfSight(at('/play/tien-len/rooms/abc'), false);
    await store.outOfSight(at('/play'), true);
    expect(done).toEqual([]);
    // Coming back to the game in sight: still nothing, and the notice still waits for the frame.
    store.controlling();
    expect(done).toEqual([]);
    expect(store.waiting()).toBe(true);
  });

  it('reloads at once out of sight when another tab already moved to the new version', async () => {
    const { store, done } = wired(false);
    store.controlling();
    await store.outOfSight(at('/together'), false);
    expect(done).toEqual(['reload']);
  });
});

describe('a link while the app is installed', () => {
  const origin = 'https://toheplay.io.vn';

  it('goes to a screen of the app inside the open app', () => {
    expect(launchTarget(`${origin}/r/482913`, origin, '/play')).toEqual({ kind: 'app', path: '/r/482913' });
    expect(launchTarget(`${origin}/s/7KQ2M9XA`, origin, '/play/hello')).toEqual({
      kind: 'app',
      path: '/s/7KQ2M9XA',
    });
    expect(launchTarget(`${origin}/play?lang=en`, origin, '/together')).toEqual({
      kind: 'app',
      path: '/play?lang=en',
    });
  });

  it('does nothing for the address already shown (the first launch hands the start page)', () => {
    expect(launchTarget(`${origin}/play`, origin, '/play')).toBeNull();
  });

  it('loads a public page as a page, and ignores another origin', () => {
    expect(launchTarget(`${origin}/games/hello/`, origin, '/play')).toEqual({
      kind: 'page',
      url: `${origin}/games/hello/`,
    });
    expect(launchTarget('https://example.com/r/482913', origin, '/play')).toBeNull();
    expect(launchTarget('http://[bad', origin, '/play')).toBeNull();
  });

  it('on an iPhone or iPad outside the app, the entry page says how to open it in the app', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
    const ipad =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15';
    const android =
      'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
    expect(isIos(iphone, 5)).toBe(true);
    expect(isIos(ipad, 5)).toBe(true);
    expect(isIos(ipad, 0)).toBe(false);
    expect(isIos(android, 5)).toBe(false);
    expect(showsInstalledAppHint({ standalone: false }, true)).toBe(true);
    expect(showsInstalledAppHint({ standalone: true }, true)).toBe(false);
    expect(showsInstalledAppHint({ standalone: false }, false)).toBe(false);
  });
});

describe('the installed app’s storage', () => {
  function manager(persisted: boolean, grants: boolean) {
    const asked: number[] = [];
    return {
      asked,
      storage: {
        persisted: async () => persisted,
        persist: async () => {
          asked.push(1);
          return grants;
        },
      },
    };
  }

  it('is asked to persist once', async () => {
    const kv = memory();
    const { storage, asked } = manager(false, true);
    expect(await askPersistentStorage(storage, kv)).toBe('granted');
    expect(kv.getItem(PERSIST_KEY)).toBe('1');
    expect(await askPersistentStorage(storage, kv)).toBe('asked-before');
    expect(asked).toHaveLength(1);
  });

  it('is not asked when it persists already, nor where the browser has no such thing', async () => {
    const kv = memory();
    const { storage, asked } = manager(true, true);
    expect(await askPersistentStorage(storage, kv)).toBe('already');
    expect(await askPersistentStorage(undefined, kv)).toBe('unsupported');
    expect(asked).toEqual([]);
  });

  it('says when the browser refuses', async () => {
    const { storage } = manager(false, false);
    expect(await askPersistentStorage(storage, memory())).toBe('refused');
  });
});

describe('"Chơi tiếp" on the public pages: the device has opened a game', () => {
  // apps/web returning.js reads `tohe:returning`; the hub writes it where it notes "opened", never on a plain start.
  it('is the key the public pages read', () => {
    expect(RETURNING_KEY).toBe('tohe:returning');
  });

  it('is written when a game is opened, and by nothing before', () => {
    expect(local.values.has(RETURNING_KEY)).toBe(false);
    markReturning(local);
    expect(local.getItem(RETURNING_KEY)).toBe('1');
  });

  it('is no failure when storage is blocked', () => {
    expect(() =>
      markReturning({
        setItem: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
    expect(() => markReturning(undefined)).not.toThrow();
  });
});
