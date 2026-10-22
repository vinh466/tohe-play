// Offline (docs/architecture/game-launch-flow.md, "Offline"): the connection followed live, a game that cannot load
// without it said so instead of an endless "Đang tải…", and no claim of offline play where no game has it yet.
import { describe, expect, it, vi } from 'vitest';
import i18n from './i18n.ts';
import gameFrame from './launcher/GameFrame.tsx?raw';
import { loadFailure, OFFLINE_GRACE_MS } from './launcher/offline.ts';
import { createOnlineStore, type OnlineSource } from './net/online.ts';
import catalog from './pages/CatalogPage.tsx?raw';

/** A window that can lose and find its network. */
function fakeWindow(onLine: boolean) {
  const listeners = new Map<string, Set<() => void>>();
  const source: OnlineSource & { go(online: boolean): void } = {
    navigator: { onLine },
    addEventListener: (type, listener) =>
      void listeners.set(type, (listeners.get(type) ?? new Set()).add(listener)),
    removeEventListener: (type, listener) => void listeners.get(type)?.delete(listener),
    go(online) {
      (source.navigator as { onLine: boolean }).onLine = online;
      for (const listener of listeners.get(online ? 'online' : 'offline') ?? []) listener();
    },
  };
  return source;
}

describe('the connection, followed live', () => {
  it('reads the browser now and tells a listener when it goes offline and online again', () => {
    const source = fakeWindow(true);
    const store = createOnlineStore(source);
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    expect(store.get()).toBe(true);
    source.go(false);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(false);
    source.go(true);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe(true);
    stop();
    source.go(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('is what the catalog’s strip reads, not navigator.onLine once', () => {
    expect(catalog).toMatch(/useOnline\(\)/);
    expect(catalog).not.toMatch(/navigator\.onLine/);
  });
});

describe('a game that cannot load offline', () => {
  it('says why when the device is offline, and fails as before when it is online', () => {
    expect(loadFailure(false)).toBe('offline');
    expect(loadFailure(true)).toBe('failed');
  });

  it('gives a game already in the cache a moment before it gives up', () => {
    expect(OFFLINE_GRACE_MS).toBeGreaterThanOrEqual(2000);
    expect(OFFLINE_GRACE_MS).toBeLessThanOrEqual(5000);
  });

  it('shows the loading screen’s message with a way back to Tò He, from the offline state or a timed-out handshake', () => {
    expect(gameFrame).toMatch(/setStatus\(loadFailure\(navigator\.onLine\)\)/);
    expect(gameFrame).toMatch(/status === 'offline'/);
    expect(gameFrame).toContain("t('offlineGame.body')");
    expect(gameFrame).toContain("t('offlineGame.leave')");
  });
});

describe('the words about being offline', () => {
  const words = (language: 'vi' | 'en', key: string) => i18n.getFixedT(language)(key);

  it('say that a game opened before still plays, in both languages', () => {
    expect(words('vi', 'offline')).toBe('Đang mất mạng. Trò đã mở trước đó vẫn chơi được.');
    expect(words('en', 'offline')).toBe("You're offline. Games you've opened before still work.");
  });

  it('say that a game never opened needs a connection, with “Về Tò He” as the way out', () => {
    expect(words('vi', 'offlineGame.body')).toBe('Trò này cần mạng để mở lần đầu.');
    expect(words('vi', 'offlineGame.leave')).toBe('Về Tò He');
    expect(words('en', 'offlineGame.body')).toBe('This game needs a connection to open the first time.');
  });

  it('do not promise offline play in the install sheet: no game claims it yet', () => {
    expect(words('vi', 'install.body')).not.toMatch(/không có mạng/);
    expect(words('en', 'install.body')).not.toMatch(/without a connection|offline/i);
  });
});
