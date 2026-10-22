// The app's language (ADR 0047): its own setting, then the public page it came from, then the browser, then Vietnamese;
// the setting shared with the public pages' switch; public pages in the app's language; the catalog in its alphabet.
import { describe, expect, it } from 'vitest';
import {
  chooseLanguage,
  LANGUAGE_KEY,
  publicPage,
  savedLanguage,
  saveLanguage,
} from './language/language.ts';
import { byShownName } from './launcher/gameWords.ts';

describe('the app’s language, in order', () => {
  it('is its own setting first, whatever the address or the browser says', () => {
    expect(chooseLanguage({ saved: 'en', query: 'vi', browser: ['vi-VN'] })).toBe('en');
    expect(chooseLanguage({ saved: 'vi', query: 'en', browser: ['en-US'] })).toBe('vi');
  });

  it('then the public page it came from (?lang=)', () => {
    expect(chooseLanguage({ saved: null, query: 'en', browser: ['vi-VN'] })).toBe('en');
    expect(chooseLanguage({ saved: null, query: 'vi', browser: ['fr-FR'] })).toBe('vi');
  });

  it('then the browser: Vietnamese for vi…, English for anything else', () => {
    expect(chooseLanguage({ saved: null, query: null, browser: ['vi'] })).toBe('vi');
    expect(chooseLanguage({ saved: null, query: null, browser: ['VI-vn', 'en'] })).toBe('vi');
    expect(chooseLanguage({ saved: null, query: null, browser: ['en-GB', 'vi'] })).toBe('en');
    expect(chooseLanguage({ saved: null, query: null, browser: ['fr-FR'] })).toBe('en');
  });

  it('then Vietnamese, when nothing says', () => {
    expect(chooseLanguage({ saved: undefined, query: undefined, browser: [] })).toBe('vi');
    expect(chooseLanguage({ saved: null, query: null, browser: [''] })).toBe('vi');
  });

  it('ignores what is not one of its two languages', () => {
    expect(chooseLanguage({ saved: 'de', query: 'xx', browser: ['vi'] })).toBe('vi');
  });
});

describe('the setting', () => {
  const memory = () => {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      items,
    };
  };

  it('is kept under the key the public pages’ VI | EN switch writes', () => {
    const storage = memory();
    expect(LANGUAGE_KEY).toBe('tohe:language');
    expect(savedLanguage(storage)).toBeNull();
    saveLanguage(storage, 'en');
    expect(storage.items.get('tohe:language')).toBe('en');
    expect(savedLanguage(storage)).toBe('en');
    storage.setItem(LANGUAGE_KEY, 'vi');
    expect(savedLanguage(storage)).toBe('vi');
  });

  it('holds for the visit when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(savedLanguage(blocked)).toBeNull();
    expect(() => saveLanguage(blocked, 'en')).not.toThrow();
  });
});

describe('a public page from the app', () => {
  it('is the Vietnamese page in Vietnamese', () => {
    expect(publicPage('/faq/', 'vi')).toEqual({ href: '/faq/', vietnameseOnly: false });
  });

  it('is the English page in English, where there is one', () => {
    expect(publicPage('/guides/', 'en')).toEqual({ href: '/en/guides/', vietnameseOnly: false });
    expect(publicPage('/promise/', 'en')).toEqual({ href: '/en/promise/', vietnameseOnly: false });
  });

  it('is the Vietnamese page, said as such, where there is none (the terms, the privacy notice)', () => {
    expect(publicPage('/terms/', 'en')).toEqual({ href: '/terms/', vietnameseOnly: true });
    expect(publicPage('/privacy/', 'en')).toEqual({ href: '/privacy/', vietnameseOnly: true });
  });
});

describe('the catalog’s order', () => {
  const games = [
    { id: 'tap-merge', name: 'Tap Merge', names: { vi: 'Chạm Ghép' } },
    { id: 'hello', name: 'Hello Dot', names: { vi: 'Chạm Chấm' } },
    { id: 'merge-block', name: 'Merge Block', names: { vi: 'Ghép Khối' } },
    { id: 'tien-len', name: 'Tiến Lên' },
  ];
  const ids = (list: { id: string }[]) => list.map((game) => game.id);

  it('follows the names a Vietnamese reader sees', () => {
    expect(ids(byShownName(games, 'vi'))).toEqual(['hello', 'tap-merge', 'merge-block', 'tien-len']);
  });

  it('follows the standard names for an English reader', () => {
    expect(ids(byShownName(games, 'en'))).toEqual(['hello', 'merge-block', 'tap-merge', 'tien-len']);
  });

  it('leaves the list it was given as it was', () => {
    byShownName(games, 'vi');
    expect(ids(games)).toEqual(['tap-merge', 'hello', 'merge-block', 'tien-len']);
  });
});
