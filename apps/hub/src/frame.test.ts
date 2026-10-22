// The app's frame (ADR 0046): which screens it holds and which tab each belongs to, the app's level behind a game the
// app was opened at, the bar stepping aside for the keyboard, and the manage PIN before a child follows a link out.
import { describe, expect, it } from 'vitest';
import config from '../vite.config.ts?raw';
import type { MeView } from './api/client.ts';
import { leavesTohe, outboundNeedsPin } from './frame/outbound.ts';
import { appLevelBeneath, isTyping, tabOf, tabs } from './frame/tabs.ts';
import router from './router.tsx?raw';
import type { SessionState } from './session/session.ts';

describe('the tabs', () => {
  it('are Trò chơi, Chơi cùng and Tôi, at /play, /together and /account', () => {
    expect(tabs.map((tab) => [tab.id, tab.to])).toEqual([
      ['games', '/play'],
      ['together', '/together'],
      ['me', '/account'],
    ]);
  });

  it('each own their screens; "Link của tôi" is Chơi cùng’s', () => {
    expect(tabOf('/play')).toBe('games');
    expect(tabOf('/play/')).toBe('games');
    expect(tabOf('/together')).toBe('together');
    expect(tabOf('/account/links')).toBe('together');
    expect(tabOf('/account')).toBe('me');
    expect(tabOf('/account/profiles')).toBe('me');
    expect(tabOf('/account/sign-in/continue')).toBe('me');
    expect(tabOf('/accounts')).toBeNull();
  });

  it('leave a game, its lobby, a table, a replay and the links into them full screen (ADR 0020)', () => {
    for (const path of [
      '/play/hello',
      '/play/tien-len/rooms',
      '/play/tien-len/rooms/abc',
      '/play/tien-len/rooms/abc/replay/2',
      '/r/482913',
      '/s/7KQ2M9XA',
    ]) {
      expect(tabOf(path), path).toBeNull();
    }
  });

  it('match the router: what the frame route holds is a tab’s, and nothing else is', () => {
    const routes = [...router.matchAll(/getParentRoute: \(\) => (\w+),\s*path: '([^']+)'/g)].map(
      ([, parent, path]) => ({
        framed: parent === 'frameRoute',
        path: (path as string).replace(/\$\w+/g, 'x'),
      }),
    );
    expect(routes.filter((route) => route.framed).length).toBeGreaterThan(10);
    expect(routes.filter((route) => !route.framed).length).toBeGreaterThan(4);
    const wrong = routes.filter((route) => (tabOf(route.path) !== null) !== route.framed);
    expect(wrong).toEqual([]);
  });
});

describe('the app’s level behind a game opened straight', () => {
  it('goes behind a game, a table and a link into one, when nothing of the app is behind it', () => {
    expect(appLevelBeneath('/play/merge-block', undefined)).toBe('/play');
    expect(appLevelBeneath('/play/tien-len/rooms/abc', 0)).toBe('/play');
    expect(appLevelBeneath('/s/7KQ2M9XA', undefined)).toBe('/play');
    expect(appLevelBeneath('/r/482913', 0)).toBe('/play');
  });

  it('is not added twice, nor behind the app’s own screens', () => {
    expect(appLevelBeneath('/play/merge-block', 1)).toBeNull();
    expect(appLevelBeneath('/play', undefined)).toBeNull();
    expect(appLevelBeneath('/together', undefined)).toBeNull();
    expect(appLevelBeneath('/account/links', undefined)).toBeNull();
  });
});

describe('the bar and the keyboard', () => {
  it('steps aside for a field that brings up a keyboard', () => {
    expect(isTyping({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTyping({ tagName: 'input' })).toBe(true);
    expect(isTyping({ tagName: 'INPUT', type: 'password' })).toBe(true);
    expect(isTyping({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTyping({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('stays for buttons, switches and boxes to tick', () => {
    expect(isTyping({ tagName: 'BUTTON' })).toBe(false);
    expect(isTyping({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTyping({ tagName: 'A' })).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe('a link out of Tò He', () => {
  const origin = 'https://toheplay.io.vn';

  it('is another origin or another scheme; the public pages are Tò He’s', () => {
    expect(leavesTohe('mailto:hello@toheplay.io.vn', origin)).toBe(true);
    expect(leavesTohe('https://docs.toheplay.io.vn/', origin)).toBe(true);
    expect(leavesTohe('https://github.com/vinh466/tohe-play', origin)).toBe(true);
    expect(leavesTohe('/faq/', origin)).toBe(false);
    expect(leavesTohe('https://toheplay.io.vn/en/guides/', origin)).toBe(false);
  });

  const me = (unlockedUntil: string | null) => ({ parentUnlockedUntil: unlockedUntil }) as MeView;
  const account = (kind: 'adult' | 'child', unlockedUntil: string | null = null): SessionState => ({
    status: 'account',
    me: me(unlockedUntil),
    player: { id: 'p', name: 'Bé Na', avatar: '🐼', kind },
  });
  const now = new Date('2026-10-22T10:00:00Z');

  it('asks an account’s child profile for the manage PIN', () => {
    expect(outboundNeedsPin(account('child'), now)).toBe(true);
  });

  it('does not ask again while the account’s management is open on this device', () => {
    expect(outboundNeedsPin(account('child', '2026-10-22T10:05:00Z'), now)).toBe(false);
    expect(outboundNeedsPin(account('child', '2026-10-22T09:55:00Z'), now)).toBe(true);
  });

  it('never asks an adult, nor a device profile, which has no PIN', () => {
    expect(outboundNeedsPin(account('adult'), now)).toBe(false);
    expect(
      outboundNeedsPin(
        { status: 'device', player: { id: 'd', name: 'Mèo', avatar: '🐱', kind: 'device' } },
        now,
      ),
    ).toBe(false);
    expect(outboundNeedsPin({ status: 'signedOut' }, now)).toBe(false);
  });
});

it('locks no orientation in the app’s manifest: each game declares its own', () => {
  expect(config).not.toMatch(/\borientation\s*:/);
});
