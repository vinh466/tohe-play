// The entry pipeline's pure parts (ADR 0044): reading codes, the intent kept on a tab, the dead ends, `open` and `play`
// asked once, and the share sheet's choice of link. docs/architecture/entry-links.md#the-hubs-entry-pipeline
import { describe, expect, it, vi } from 'vitest';
import type { LinkIntent, ShareLinkView } from './api/client.ts';
import {
  canonicalEntry,
  formatEntryCode,
  highestLevel,
  intentPath,
  isEntryPath,
  readCode,
  readCodeOf,
  readLevel,
} from './entry/codes.ts';
import { deadEndScreen } from './entry/deadEnds.ts';
import { createEntryStore, createOnce, type EntryStorage, KEEP_MS } from './entry/intent.ts';
import { REUSE_MIN_LEFT_MS, reusableLink, shareUrl } from './entry/share.ts';

/** sessionStorage of one tab, kept across reloads: a new store on the same map is the page loaded again. */
function tab(): EntryStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const clock = (start = 1_800_000_000_000) => {
  let now = start;
  return {
    now: () => now,
    pass: (ms: number) => {
      now += ms;
    },
  };
};

const okLink = (code: string, overrides: Partial<LinkIntent> = {}): LinkIntent => ({
  code,
  state: 'ok',
  kind: 'game',
  gameId: 'merge-block',
  gameName: 'Ghép Khối',
  level: 'any',
  makerName: 'Mèo Cam',
  ...overrides,
});

describe('reading a code', () => {
  it('takes six digits as a table, with spaces or a hyphen', () => {
    expect(readCode('482913')).toEqual({ kind: 'room', code: '482913' });
    expect(readCode(' 482 913 ')).toEqual({ kind: 'room', code: '482913' });
    expect(readCode('482-913')).toEqual({ kind: 'room', code: '482913' });
  });

  it('takes eight characters as a share link, as the API reads them', () => {
    expect(readCode('7KQ2M9XA')).toEqual({ kind: 'share', code: '7KQ2M9XA' });
    expect(readCode('7kq2-m9xa')).toEqual({ kind: 'share', code: '7KQ2M9XA' });
    expect(readCode('7kq2 m9xa')).toEqual({ kind: 'share', code: '7KQ2M9XA' });
    // I and L read as 1, O as 0.
    expect(readCode('ikq2-m9xo')).toEqual({ kind: 'share', code: '1KQ2M9X0' });
    expect(readCode('Lkq2m9xa')).toEqual({ kind: 'share', code: '1KQ2M9XA' });
    // Eight digits are a share link too: only six are a table.
    expect(readCode('12345678')).toEqual({ kind: 'share', code: '12345678' });
  });

  it('reads a pasted link by its /r/ or /s/ part, whatever its host', () => {
    expect(readCode('https://toheplay.io.vn/s/7kq2m9xa?app=1')).toEqual({ kind: 'share', code: '7KQ2M9XA' });
    expect(readCode('http://10.100.0.2:4820/r/482913')).toEqual({ kind: 'room', code: '482913' });
    expect(readCode('Vào bàn nè: https://toheplay.io.vn/r/482913')).toEqual({ kind: 'room', code: '482913' });
  });

  it('refuses what is no code', () => {
    for (const input of ['', '   ', '48291', '4829131', '7KQ2M9X', '7KQ2M9XAB', '7KQ2M9XU', '7KQ2M9X!']) {
      expect(readCode(input), input).toBeNull();
    }
    expect(readCode('https://toheplay.io.vn/s/short')).toBeNull();
    expect(readCode('x'.repeat(500))).toBeNull();
  });

  it('builds the hub’s own path from the kind and the code only: never a free path', () => {
    expect(intentPath({ kind: 'room', code: '482913' })).toBe('/r/482913');
    expect(intentPath({ kind: 'share', code: '7KQ2M9XA' })).toBe('/s/7KQ2M9XA');
    expect(intentPath({ kind: 'play', code: 'merge-block' })).toBe('/play/merge-block');
    for (const raw of ['//evil.example', '../account', 'https:', 'Merge', 'a']) {
      expect(readCodeOf('play', raw), raw).toBeNull();
    }
    expect(readCodeOf('share', '//evil.example')).toBeNull();
    expect(readCodeOf('room', '482913/../../x')).toBeNull();
    expect(isEntryPath('/r/482913')).toBe(true);
    expect(isEntryPath('/play/hello')).toBe(false);
  });

  it('shows a code in two halves', () => {
    expect(formatEntryCode({ kind: 'room', code: '482913' })).toBe('482 913');
    expect(formatEntryCode({ kind: 'share', code: '7KQ2M9XA' })).toBe('7KQ2 M9XA');
  });
});

describe('the address of an entry', () => {
  it('drops ?app=1 from a link preview’s card', () => {
    expect(canonicalEntry('share', '7KQ2M9XA', { app: 1 })).toEqual({ code: '7KQ2M9XA' });
    expect(canonicalEntry('room', '482913', { app: '1' })).toEqual({ code: '482913' });
  });

  it('takes the code in its canonical form', () => {
    expect(canonicalEntry('share', '7kq2-m9xa', {})).toEqual({ code: '7KQ2M9XA' });
  });

  it('leaves a right address alone, and a wrong code to its dead end', () => {
    expect(canonicalEntry('share', '7KQ2M9XA', {})).toBeNull();
    expect(canonicalEntry('room', '482913', {})).toBeNull();
    expect(canonicalEntry('share', 'nope', {})).toBeNull();
  });
});

describe('the identity gate', () => {
  it('asks the highest of the game’s, the feature’s and the link’s level', () => {
    expect(highestLevel('any', 'any')).toBe('any');
    expect(highestLevel('any', 'named')).toBe('named');
    expect(highestLevel('named', 'account', 'any')).toBe('account');
  });

  it('reads an unknown level as the most', () => {
    expect(readLevel('named')).toBe('named');
    expect(readLevel(null)).toBe('any');
    expect(readLevel('admin')).toBe('account');
  });
});

describe('the intent kept on a tab', () => {
  const share = { kind: 'share', code: '7KQ2M9XA' } as const;
  const room = { kind: 'room', code: '482913' } as const;

  it('is made, and kept through a reload', () => {
    const storage = tab();
    const time = clock();
    createEntryStore(storage, time.now).keep(share);
    time.pass(30 * 60 * 1000);
    const reloaded = createEntryStore(storage, time.now);
    expect(reloaded.current()).toMatchObject(share);
  });

  it('keeps the same intent with its resolution, and replaces it with another', () => {
    const storage = tab();
    const time = clock();
    const entry = createEntryStore(storage, time.now);
    const first = entry.keep(share);
    entry.resolved(share.code, okLink(share.code));
    time.pass(1000);
    expect(entry.keep(share)).toMatchObject({ at: first.at, link: { state: 'ok' } });
    expect(entry.keep(room)).toMatchObject({ ...room, at: first.at + 1000 });
    expect(entry.current()?.link).toBeUndefined();
  });

  it('is gone after an hour', () => {
    const storage = tab();
    const time = clock();
    const entry = createEntryStore(storage, time.now);
    entry.keep(share);
    time.pass(KEEP_MS - 1);
    expect(entry.current()).not.toBeNull();
    time.pass(1);
    expect(entry.current()).toBeNull();
    expect(storage.map.has('tohe:entry')).toBe(false);
  });

  it('is cleared when reached — only the intent reached', () => {
    const entry = createEntryStore(tab(), clock().now);
    entry.keep(share);
    entry.reached(room);
    expect(entry.current()).toMatchObject(share);
    entry.reached(share);
    expect(entry.current()).toBeNull();
  });

  it('is cleared when another profile is chosen, with the path waiting after sign-in', () => {
    const storage = tab();
    const entry = createEntryStore(storage, clock().now);
    entry.keep(room);
    entry.resolved('7KQ2M9XA', okLink('7KQ2M9XA'));
    storage.setItem('tohe:next', '/r/482913');
    entry.forget();
    expect(entry.current()).toBeNull();
    expect(entry.signUpCode()).toBeNull();
    expect(storage.getItem('tohe:next')).toBeNull();
  });

  it('leaves a page that is no entry waiting after sign-in', () => {
    const storage = tab();
    storage.setItem('tohe:next', '/account/transfer');
    createEntryStore(storage, clock().now).forget();
    expect(storage.getItem('tohe:next')).toBe('/account/transfer');
  });

  it('never reads back a free path someone wrote into storage', () => {
    const storage = tab();
    const time = clock();
    storage.setItem('tohe:entry', JSON.stringify({ kind: 'play', code: '//evil.example', at: time.now() }));
    expect(createEntryStore(storage, time.now).current()).toBeNull();
    storage.setItem('tohe:entry', JSON.stringify({ kind: 'redirect', code: 'x', at: time.now() }));
    expect(createEntryStore(storage, time.now).current()).toBeNull();
    storage.setItem('tohe:entry', '{not json');
    expect(createEntryStore(storage, time.now).current()).toBeNull();
  });

  it('works, for the page’s life, without storage', () => {
    const entry = createEntryStore(null, clock().now);
    expect(entry.keep(share)).toMatchObject(share);
    expect(entry.current()).toBeNull();
  });
});

describe('the share link an account was made from', () => {
  it('is sent once, within the hour, from a link that opened', () => {
    const time = clock();
    const entry = createEntryStore(tab(), time.now);
    entry.keep({ kind: 'share', code: '7KQ2M9XA' });
    entry.resolved('7KQ2M9XA', okLink('7KQ2M9XA'));
    // Reaching the game does not end it: an account made after a round still came from the link.
    entry.reached({ kind: 'share', code: '7KQ2M9XA' });
    expect(entry.signUpCode()).toBe('7KQ2M9XA');
    entry.signedUp();
    expect(entry.signUpCode()).toBeNull();
  });

  it('is not sent for a link that did not open, nor after an hour', () => {
    const time = clock();
    const entry = createEntryStore(tab(), time.now);
    entry.resolved('7KQ2M9XA', okLink('7KQ2M9XA', { state: 'revoked' }));
    expect(entry.signUpCode()).toBeNull();
    entry.resolved('7KQ2M9XA', okLink('7KQ2M9XA'));
    time.pass(KEEP_MS);
    expect(entry.signUpCode()).toBeNull();
  });
});

describe('open and play', () => {
  it('ask once per reached intent, though the screen is drawn again', async () => {
    const once = createOnce();
    const play = vi.fn(async () => okLink('7KQ2M9XA'));
    const [a, b] = await Promise.all([once('play:7KQ2M9XA:1', play), once('play:7KQ2M9XA:1', play)]);
    await once('play:7KQ2M9XA:1', play);
    expect(play).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    // A new intent kept later is another reach.
    await once('play:7KQ2M9XA:2', play);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('ask again after a failure (offline)', async () => {
    const once = createOnce();
    const play = vi
      .fn<() => Promise<LinkIntent>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(okLink('7KQ2M9XA'));
    await expect(once('play:x', play)).rejects.toThrow('offline');
    await expect(once('play:x', play)).resolves.toMatchObject({ state: 'ok' });
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('are not called again on a reload once reached: nothing is kept to reach', () => {
    const storage = tab();
    const time = clock();
    const entry = createEntryStore(storage, time.now);
    entry.keep({ kind: 'share', code: '7KQ2M9XA' });
    entry.reached({ kind: 'share', code: '7KQ2M9XA' });
    expect(createEntryStore(storage, time.now).current()).toBeNull();
  });
});

describe('dead ends', () => {
  it('say no more than "no longer opens" for an unknown code, with the code box', () => {
    expect(deadEndScreen('unknown', {})).toEqual({
      title: 'entry.unknownTitle',
      body: 'entry.unknownBody',
      toGame: false,
      codeBox: true,
    });
  });

  it('give the reason and the game’s menu for a share link that ended', () => {
    const game = { id: 'merge-block', name: 'Ghép Khối' };
    expect(deadEndScreen('expired', game)).toMatchObject({ title: 'entry.expiredTitle', toGame: true });
    expect(deadEndScreen('revoked', game)).toMatchObject({ body: 'entry.revokedBody', toGame: true });
    expect(deadEndScreen('used_up', game)).toMatchObject({ title: 'entry.usedUpTitle', codeBox: false });
    expect(deadEndScreen('expired', {})).toMatchObject({ body: 'entry.expiredBodyNoGame', toGame: false });
  });

  it('tell a child that a game is for older players', () => {
    expect(deadEndScreen('not-for-profile', { name: 'Tiến Lên' }, true).title).toBe('entry.tooYoungTitle');
    expect(deadEndScreen('not-for-profile', { name: 'Tiến Lên' }).title).toBe('entry.goneTitle');
  });
});

describe('"Chia sẻ"', () => {
  const now = Date.parse('2026-10-20T10:00:00Z');
  const view = (overrides: Partial<ShareLinkView> = {}): ShareLinkView => ({
    code: '7KQ2M9XA',
    kind: 'game',
    gameId: 'merge-block',
    gameVersion: '1.0.0',
    level: 'any',
    state: 'ok',
    createdAt: '2026-10-19T10:00:00Z',
    expiresAt: new Date(now + 10 * 24 * 3600 * 1000).toISOString(),
    maxUses: null,
    uses: 0,
    revokedAt: null,
    counts: { opened: 0, played: 0, accountsMade: null },
    ...overrides,
  });

  it('shows the profile’s live link to the game again', () => {
    expect(reusableLink([view()], 'merge-block', now)?.code).toBe('7KQ2M9XA');
  });

  it('makes a new one when none fits', () => {
    for (const other of [
      view({ gameId: 'hello' }),
      view({ state: 'revoked' }),
      view({ level: 'named' }),
      view({ maxUses: 5 }),
      view({ kind: 'entry' }),
      view({ expiresAt: new Date(now + REUSE_MIN_LEFT_MS - 1).toISOString() }),
    ]) {
      expect(reusableLink([other], 'merge-block', now)).toBeNull();
    }
  });

  it('sends the hub’s /s/ address', () => {
    expect(shareUrl('7KQ2M9XA', 'https://toheplay.io.vn')).toBe('https://toheplay.io.vn/s/7KQ2M9XA');
  });
});
