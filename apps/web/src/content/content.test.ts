// The public pages' words and the games' pages: what a game's manifest, its page's words and its facts turn into, that
// every game has its page in both languages (games/<id>/page/, ADR 0047), that the FAQ keeps its shape (it is also the
// page's FAQPage data), and that each page's English words match its Vietnamese ones in shape.
import { existsSync, readdirSync } from 'node:fs';
import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import { languages } from '../i18n.ts';
import { about } from './about.ts';
import { faq } from './faq.ts';
import { allOffline, type GamePageText, parseGameFacts, parseGamePage } from './game-page.ts';
import { describeGame, gamePaths, gamesPage, loadGames } from './games.ts';
import { home } from './home.ts';
import { guides, install } from './install.ts';
import { promise } from './promise.ts';
import { formatDay, siteWords } from './site.ts';

const manifest = (extra: Record<string, unknown> = {}) =>
  GameManifest.parse({
    id: 'sample-game',
    name: 'Mẫu',
    version: '1.0.0',
    protocol: 1,
    description: 'Một trò mẫu.',
    ...extra,
  });

const page: GamePageText = {
  updated: '2026-10-22',
  kind: 'game thử',
  answer: 'Một câu trả lời.',
  howTo: ['a', 'b', 'c'],
  suits: 's',
  questions: [],
  pictures: [],
};
const open = { round: { kind: 'open' as const }, offline: false };

describe('a game’s page from its manifest, its words and its facts', () => {
  it('says the age, how it is played, and the ranking', () => {
    const alone = describeGame(
      manifest({ minAge: 3, capabilities: ['save', 'scores', 'ranked'], ranked: { verify: 'verify.js' } }),
      '/i.svg',
      page,
      open,
      'vi',
    );
    expect(alone.chips).toEqual(['Từ 3 tuổi', 'Chơi một mình', 'Có bảng xếp hạng']);
    expect(alone.playMode).toBe('SinglePlayer');
    expect(alone.together).toBe(false);

    const together = describeGame(
      manifest({ capabilities: ['rooms'], rooms: { seats: { min: 2, max: 4 }, bots: ['easy'] } }),
      '/i.svg',
      page,
      open,
      'vi',
    );
    expect(together.chips).toEqual(['Mọi lứa tuổi', 'Chơi cùng: 2–4 người', 'Có bạn máy']);
    expect(together.playMode).toBe('MultiPlayer');
    expect(together.seats).toEqual({ min: 2, max: 4 });
    expect(together.together).toBe(true);
  });

  it('puts the manifest’s facts and facts.json’s in one table, the ads and the data included', () => {
    const game = describeGame(
      manifest({
        minAge: 6,
        orientation: 'portrait',
        capabilities: ['rooms'],
        rooms: { seats: { min: 2, max: 4 }, bots: ['easy'] },
      }),
      '/i.svg',
      page,
      { round: { kind: 'about', minMinutes: 3, maxMinutes: 5 }, offline: false },
      'vi',
    );
    expect(Object.fromEntries(game.facts.map((fact) => [fact.label, fact.value]))).toEqual({
      Tuổi: 'Từ 6 tuổi',
      'Người chơi': 'Một mình với bạn máy, hoặc 2–4 người cùng bàn, mỗi người một máy',
      'Một ván': 'Khoảng 3–5 phút',
      'Cầm máy': 'Cầm dọc',
      'Quảng cáo': 'Không có',
      'Thông tin cá nhân': 'Chơi không cần đăng ký, không theo dõi',
    });
    const english = describeGame(
      manifest(),
      '/i.svg',
      page,
      { round: { kind: 'fixed', seconds: 20 }, offline: false },
      'en',
    );
    expect(english.facts.map((fact) => fact.value)).toEqual([
      'All ages',
      'One player',
      '20 seconds',
      'Upright',
      'None',
      'No sign-up needed to play, no tracking',
    ]);
  });

  it('says it plays offline only when every game does (ADR 0047)', () => {
    const offline = { round: { kind: 'open' as const }, offline: true };
    const labels = (offlineEverywhere: boolean) =>
      describeGame(manifest(), '/i.svg', page, offline, 'vi', { offlineEverywhere }).facts.map(
        (fact) => fact.label,
      );
    expect(labels(false)).not.toContain('Khi mất mạng');
    expect(labels(true)).toContain('Khi mất mạng');
    expect(allOffline([offline, open])).toBe(false);
    expect(allOffline([offline, offline])).toBe(true);
    expect(allOffline([])).toBe(false);
  });

  it('names and describes the game in the page’s language, from the manifest (ADR 0048)', () => {
    const words = {
      name: 'Sample',
      names: { vi: 'Mẫu' },
      description: 'A sample game.',
      descriptions: { vi: 'Một trò mẫu.' },
    };
    const english = describeGame(manifest(words), '/i.svg', { ...page, kind: 'test game' }, open, 'en');
    expect(english.name).toBe('Sample');
    expect(english.metaDescription).toBe('A sample game.');
    expect(english.title).toBe('Sample — test game | Tò He');
    const vietnamese = describeGame(manifest(words), '/i.svg', page, open, 'vi');
    expect(vietnamese.name).toBe('Mẫu');
    expect(vietnamese.metaDescription).toBe('Một trò mẫu.');
    expect(vietnamese.title).toBe('Mẫu — game thử | Tò He');
  });

  it('falls back on the page’s answer for a manifest without a description', () => {
    expect(describeGame(manifest({ description: '' }), '/i.svg', page, open, 'vi').metaDescription).toBe(
      'Một câu trả lời.',
    );
  });
});

describe('a game’s page file', () => {
  const file = [
    '---',
    'updated: 2026-10-22',
    'kind: game thử',
    '---',
    '',
    'Một câu trả lời',
    'trên hai dòng.',
    '',
    '## Cách chơi',
    '',
    '1. Một.',
    '2. Hai, dài',
    '   hơn.',
    '3. Ba.',
    '',
    '## Hợp với ai',
    '',
    'Mọi người.',
    '',
    '## Hỏi đáp',
    '',
    '### Có khó không?',
    '',
    'Không.',
    '',
    '## Hình ảnh',
    '',
    '![Bàn chơi giữa ván](ban-choi.png)',
    '',
  ].join('\n');

  it('reads the front matter, the answer and every section', () => {
    expect(parseGamePage(file, 'vi', 'vi.md')).toEqual({
      updated: '2026-10-22',
      kind: 'game thử',
      answer: 'Một câu trả lời trên hai dòng.',
      howTo: ['Một.', 'Hai, dài hơn.', 'Ba.'],
      suits: 'Mọi người.',
      questions: [{ q: 'Có khó không?', a: 'Không.' }],
      pictures: [{ alt: 'Bàn chơi giữa ván', file: 'ban-choi.png' }],
    });
  });

  it('lets a page leave out "Hợp với ai" when it only repeats the facts', () => {
    const without = file.replace('## Hợp với ai\n\nMọi người.\n\n', '');
    expect(without).not.toContain('Hợp với ai');
    expect(parseGamePage(without, 'vi', 'vi.md').suits).toBeUndefined();
  });

  it.each([
    ['no front matter', file.slice(file.indexOf('Một câu')), /no front matter/],
    ['no date', file.replace('updated: 2026-10-22\n', ''), /updated/],
    ['a date that is no day', file.replace('2026-10-22', '2026-13-40'), /updated/],
    ['an unknown key', file.replace('kind:', 'title: x\nkind:'), /unknown key "title"/],
    ['a heading of the other language', file.replace('## Hợp với ai', '## Who it suits'), /no heading/],
    ['no how-to', file.replace('## Cách chơi\n\n1. Một.\n2. Hai, dài\n   hơn.\n3. Ba.\n\n', ''), /howTo/],
    ['two steps only', file.replace('3. Ba.\n', ''), /howTo/],
    ['a step that is no numbered line', file.replace('3. Ba.', 'Ba.'), /not a numbered line/],
    ['no answer', file.replace('Một câu trả lời\ntrên hai dòng.', ''), /answer/],
    ['a question without "?"', file.replace('Có khó không?', 'Có khó không'), /questions/],
    ['HTML', file.replace('Mọi người.', '<b>Mọi người.</b>'), /plain text only/],
    ['a link', file.replace('Mọi người.', '[Mọi người](https://example.com)'), /plain text only/],
    ['a picture without words', file.replace('Bàn chơi giữa ván', ''), /pictures/],
  ])('refuses a file with %s, naming it', (_, broken, problem) => {
    expect(() => parseGamePage(broken, 'vi', 'games/x/page/vi.md')).toThrow(problem);
    expect(() => parseGamePage(broken, 'vi', 'games/x/page/vi.md')).toThrow(/^games\/x\/page\/vi\.md: /);
  });

  it('reads facts.json, and refuses one with a fact missing or one it does not know', () => {
    expect(parseGameFacts({ round: { kind: 'fixed', seconds: 20 }, offline: false }, 'f')).toEqual({
      round: { kind: 'fixed', seconds: 20 },
      offline: false,
    });
    expect(() => parseGameFacts({ round: { kind: 'open' } }, 'f')).toThrow(/offline/);
    expect(() => parseGameFacts({ round: { kind: 'open' }, offline: false, ads: true }, 'f')).toThrow(/ads/);
    expect(() =>
      parseGameFacts({ round: { kind: 'about', minMinutes: 9, maxMinutes: 3 }, offline: false }, 'f'),
    ).toThrow(/minMinutes/);
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

  // A game's page is written in its folder, games/<id>/page/vi.md and en.md (docs/guides/create-a-game.md): a game
  // without them does not load at all, and the build fails.
  it.each(languages.flatMap((lang) => loadGames(lang).map((game) => [game.id, lang, game] as const)))(
    '%s has its page in %s',
    (id, lang, game) => {
      expect(game.page.howTo.length, `${id} ${lang}`).toBeGreaterThanOrEqual(3);
      expect(game.description, `${id}'s game.json needs a description`).not.toBe('');
    },
  );

  // game.json describes the game in English (`description`) and in Vietnamese (`descriptions.vi`, ADR 0048).
  it.each(games.map((game) => [game.id] as const))('%s says what it is in English', (id) => {
    const english = loadGames('en').find((game) => game.id === id);
    const vietnamese = games.find((game) => game.id === id);
    expect(english?.metaDescription).not.toBe(vietnamese?.metaDescription);
    expect(english?.title).not.toBe(vietnamese?.title);
    expect(english?.page.answer).not.toBe(vietnamese?.page.answer);
  });

  it('have no page left over for a game that is gone', () => {
    const gamesDir = new URL('../../../../games/', import.meta.url);
    const orphans = readdirSync(gamesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/page`, gamesDir)))
      .filter((entry) => !existsSync(new URL(`${entry.name}/public/game.json`, gamesDir)))
      .map((entry) => entry.name);
    expect(orphans).toEqual([]);
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
    ['promise', promise],
  ] as const)('give the %s words the same shape in Vietnamese and English', (_, words) => {
    expect(shape(words.en)).toEqual(shape(words.vi));
  });

  it('write a day as each language does', () => {
    expect(formatDay('2026-10-02', 'vi')).toBe('02/10/2026');
    expect(formatDay('2026-10-02', 'en')).toBe('2 October 2026');
  });

  it('write different words in each, and the same links', () => {
    expect(home.en.title).not.toBe(home.vi.title);
    expect(siteWords.en.nav.map((item) => item.path)).toEqual(siteWords.vi.nav.map((item) => item.path));
    expect(guides.en.items.map((item) => item.path)).toEqual(guides.vi.items.map((item) => item.path));
  });
});

describe('the FAQ', () => {
  it.each(languages)('keeps unique question ids in %s', (lang) => {
    const ids = faq[lang].questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the same question ids in both languages', () => {
    expect(faq.en.questions.map((question) => question.id)).toEqual(
      faq.vi.questions.map((question) => question.id),
    );
  });
});

// docs/conventions/voice-and-look.md, the parts a machine can read: the words of the public pages.
describe('the voice of the public pages’ words', () => {
  const strings = (value: unknown, skip: readonly string[] = []): string[] => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap((inner) => strings(inner, skip));
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, inner]) =>
        skip.includes(key) ? [] : strings(inner, skip),
      );
    }
    return [];
  };
  // The tab title, the description and the picture's alt are not read on the page.
  const unseen = ['title', 'description', 'imageAlt'];
  const pages = [
    ['site', siteWords],
    ['home', home],
    ['games', gamesPage],
    ['guides', guides],
    ['install', install],
    ['faq', faq],
    ['about', about],
    ['promise', promise],
  ] as const;

  it.each(pages.flatMap(([name, words]) => languages.map((lang) => [name, lang, words[lang]] as const)))(
    '%s in %s: no "·" in a sentence, no emoji, nothing internal, at most one long dash',
    (_, __, words) => {
      const text = strings(words, unseen);
      for (const line of text) {
        expect(line, line).not.toMatch(/ · /);
        expect(line, line).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(line, line).not.toMatch(/game mẫu|sample game/i);
      }
      expect(text.join(' ').split('—').length - 1).toBeLessThanOrEqual(1);
    },
  );

  it.each(languages)('the games’ pages in %s say nothing internal and keep to one long dash', (lang) => {
    for (const game of loadGames(lang)) {
      const text = [game.description, game.page.kind, game.page.answer, game.page.suits ?? ''].concat(
        game.page.howTo,
        game.page.questions.flatMap(({ q, a }) => [q, a]),
        game.genre,
        game.chips,
      );
      for (const line of text) expect(line, `${game.id}: ${line}`).not.toMatch(/game mẫu|sample game/i);
      expect(text.join(' ').split('—').length - 1, game.id).toBeLessThanOrEqual(1);
    }
  });
});
