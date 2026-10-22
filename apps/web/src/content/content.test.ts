// The public pages' words and the games' pages: what a game's manifest turns into, that every game has the copy only a
// person can write in both languages, that the FAQ keeps its shape (it is also the page's FAQPage data), and that each
// page's English words match its Vietnamese ones in shape (ADR 0047).
import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import { languages } from '../i18n.ts';
import { about } from './about.ts';
import { faq } from './faq.ts';
import { describeGame, gameCopy, gamePaths, gamesPage, loadGames } from './games.ts';
import { home } from './home.ts';
import { guides, install } from './install.ts';
import { siteWords } from './site.ts';

const manifest = (extra: Record<string, unknown> = {}) =>
  GameManifest.parse({
    id: 'sample-game',
    name: 'Mẫu',
    version: '1.0.0',
    protocol: 1,
    description: 'Một trò mẫu.',
    ...extra,
  });

describe('a game’s page from its manifest', () => {
  it('says the age, how it is played, and the ranking', () => {
    const alone = describeGame(
      manifest({ minAge: 3, capabilities: ['save', 'scores', 'ranked'], ranked: { verify: 'verify.js' } }),
      '/i.svg',
      undefined,
    );
    expect(alone.facts).toEqual(['Từ 3 tuổi', 'Chơi một mình', 'Có bảng xếp hạng']);
    expect(alone.playMode).toBe('SinglePlayer');

    const together = describeGame(
      manifest({
        capabilities: ['rooms'],
        rooms: { seats: { min: 2, max: 4 }, bots: ['easy'] },
      }),
      '/i.svg',
      undefined,
    );
    expect(together.facts).toEqual(['Mọi lứa tuổi', 'Cùng bạn bè: 2–4 người', 'Có bạn máy']);
    expect(together.playMode).toBe('MultiPlayer');
    expect(together.seats).toEqual({ min: 2, max: 4 });
  });

  it('says the same in English on an English page', () => {
    const alone = describeGame(
      manifest({
        minAge: 3,
        tags: ['puzzle'],
        capabilities: ['save', 'scores', 'ranked'],
        ranked: { verify: 'verify.js' },
      }),
      '/i.svg',
      undefined,
      'en',
    );
    expect(alone.facts).toEqual(['Ages 3+', 'Play alone', 'Leaderboard']);
    expect(alone.genre).toEqual(['Puzzle']);
    const together = describeGame(
      manifest({ capabilities: ['rooms'], rooms: { seats: { min: 2, max: 4 }, bots: ['easy'] } }),
      '/i.svg',
      undefined,
      'en',
    );
    expect(together.facts).toEqual(['All ages', 'With friends: 2–4 players', 'Bots to play against']);
  });

  it('has a title and a description even for a game nobody wrote copy for', () => {
    const bare = describeGame(manifest({ description: '' }), '/i.svg', undefined);
    expect(bare.title).toBe('Mẫu — chơi ngay | Tò He');
    expect(bare.metaDescription).toContain('Mẫu');
    expect(describeGame(manifest({ description: '' }), '/i.svg', undefined, 'en').title).toBe(
      'Mẫu — play now | Tò He',
    );
    const written = describeGame(manifest(), '/i.svg', {
      kind: 'game thử',
      howTo: ['a', 'b', 'c'],
      suits: 's',
    });
    expect(written.title).toBe('Mẫu — game thử | Tò He');
    expect(written.metaDescription).toBe('Một trò mẫu.');
  });

  it('names and describes the game in the page’s language, from the manifest (ADR 0048)', () => {
    const copy = { kind: 'test game', howTo: ['a', 'b', 'c'], suits: 's' };
    const words = {
      name: 'Sample',
      names: { vi: 'Mẫu' },
      description: 'A sample game.',
      descriptions: { vi: 'Một trò mẫu.' },
    };
    const english = describeGame(manifest(words), '/i.svg', copy, 'en');
    expect(english.name).toBe('Sample');
    expect(english.metaDescription).toBe('A sample game.');
    expect(english.title).toBe('Sample — test game | Tò He');
    const vietnamese = describeGame(manifest(words), '/i.svg', { ...copy, kind: 'game thử' }, 'vi');
    expect(vietnamese.name).toBe('Mẫu');
    expect(vietnamese.metaDescription).toBe('Một trò mẫu.');
    expect(vietnamese.title).toBe('Mẫu — game thử | Tò He');
  });
});

describe('the games in the repository', () => {
  const games = loadGames();

  it('are found: one page for each game.json, in each language', () => {
    expect(games.map((game) => game.id)).toEqual(
      expect.arrayContaining(['merge-block', 'tap-merge', 'tien-len', 'hello']),
    );
    expect(new Set(games.map((game) => game.id)).size).toBe(games.length);
    expect(loadGames('en').map((game) => game.id)).toEqual(games.map((game) => game.id));
    expect(gamePaths('en').map((path) => path.params.id)).toEqual(games.map((game) => game.id));
  });

  it('list the sample after the games made to be played', () => {
    const sample = games.findIndex((game) => game.sample);
    expect(games.slice(sample).every((game) => game.sample)).toBe(true);
  });

  // A page is made without anyone writing it, but its how-to is not: add it to `gameCopy` in games.ts, in Vietnamese
  // and in English (see docs/guides/create-a-game.md).
  it.each(languages.flatMap((lang) => loadGames(lang).map((game) => [game.id, lang, game] as const)))(
    '%s has its how-to in %s, in 3 to 5 lines',
    (id, lang, game) => {
      expect(game.copy, `add "${id}".${lang} to gameCopy in apps/web/src/content/games.ts`).toBeDefined();
      expect(game.copy?.howTo.length).toBeGreaterThanOrEqual(3);
      expect(game.copy?.howTo.length).toBeLessThanOrEqual(5);
      expect(game.copy?.kind.length).toBeGreaterThan(0);
      expect(game.copy?.suits.length).toBeGreaterThan(0);
      expect(game.description, `${id}'s game.json needs a description`).not.toBe('');
    },
  );

  // game.json describes the game in English (`description`) and in Vietnamese (`descriptions.vi`, ADR 0048).
  it.each(games.map((game) => [game.id] as const))('%s says what it is in English', (id) => {
    const english = loadGames('en').find((game) => game.id === id);
    const vietnamese = games.find((game) => game.id === id);
    expect(english?.metaDescription).not.toBe(vietnamese?.metaDescription);
    expect(english?.title).not.toBe(vietnamese?.title);
  });

  it('have no copy left over for a game that is gone', () => {
    const ids = new Set(games.map((game) => game.id));
    expect(Object.keys(gameCopy).filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe('the FAQ', () => {
  it.each(languages)('has 8 to 12 short questions in %s, each answered once', (lang) => {
    const { questions } = faq[lang];
    expect(questions.length).toBeGreaterThanOrEqual(8);
    expect(questions.length).toBeLessThanOrEqual(12);
    expect(new Set(questions.map(({ q }) => q)).size).toBe(questions.length);
    for (const { q, a } of questions) {
      expect(q.endsWith('?'), q).toBe(true);
      expect(a.length, q).toBeGreaterThan(20);
      // The answers are plain text: they are the page's FAQPage data as well.
      expect(a, q).not.toMatch(/[<>]|\[\[\[/);
    }
  });

  it('asks the same number of questions in both languages', () => {
    expect(faq.en.questions.length).toBe(faq.vi.questions.length);
  });
});

describe('the install guide', () => {
  it('covers Android, iPhone, Zalo and Messenger, and a computer, in both languages', () => {
    expect(install.vi.platforms.map((platform) => platform.id)).toEqual([
      'android',
      'iphone',
      'zalo',
      'may-tinh',
    ]);
    expect(install.en.platforms.map((platform) => platform.id)).toEqual([
      'android',
      'iphone',
      'zalo',
      'computer',
    ]);
    for (const lang of languages) {
      for (const platform of install[lang].platforms)
        expect(platform.steps.length, `${lang} ${platform.id}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the two languages', () => {
  // TypeScript keeps the keys the same; this keeps the lists the same length and every string written.
  const shape = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(shape);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
    }
    if (typeof value === 'string') return value.trim() === '' ? 'empty' : 'text';
    return typeof value;
  };

  it.each([
    ['site', siteWords],
    ['home', home],
    ['games', gamesPage],
    ['guides', guides],
    ['install', install],
    ['faq', faq],
    ['about', about],
  ] as const)('give the %s words the same shape in Vietnamese and English', (_, words) => {
    expect(shape(words.en)).toEqual(shape(words.vi));
  });

  it('write different words in each, and the same links', () => {
    expect(home.en.title).not.toBe(home.vi.title);
    expect(siteWords.en.nav.map((item) => item.path)).toEqual(siteWords.vi.nav.map((item) => item.path));
    expect(guides.en.items.map((item) => item.path)).toEqual(guides.vi.items.map((item) => item.path));
  });
});
