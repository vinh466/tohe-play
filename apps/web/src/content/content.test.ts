// The public pages' words and the games' pages: what a game's manifest turns into, that every game has the copy only a
// person can write, and that the FAQ keeps its shape (it is also the page's FAQPage data).
import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import { faq } from './faq.ts';
import { describeGame, gameCopy, loadGames } from './games.ts';
import { install } from './install.ts';

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

  it('has a title and a description even for a game nobody wrote copy for', () => {
    const bare = describeGame(manifest({ description: '' }), '/i.svg', undefined);
    expect(bare.title).toBe('Mẫu — chơi ngay | Tò He');
    expect(bare.metaDescription).toContain('Mẫu');
    const written = describeGame(manifest(), '/i.svg', {
      kind: 'game thử',
      howTo: ['a', 'b', 'c'],
      suits: 's',
    });
    expect(written.title).toBe('Mẫu — game thử | Tò He');
    expect(written.metaDescription).toBe('Một trò mẫu.');
  });
});

describe('the games in the repository', () => {
  const games = loadGames();

  it('are found: one page for each game.json', () => {
    expect(games.map((game) => game.id)).toEqual(
      expect.arrayContaining(['merge-block', 'tap-merge', 'tien-len', 'hello']),
    );
    expect(new Set(games.map((game) => game.id)).size).toBe(games.length);
  });

  it('list the sample after the games made to be played', () => {
    const sample = games.findIndex((game) => game.sample);
    expect(games.slice(sample).every((game) => game.sample)).toBe(true);
  });

  // A page is made without anyone writing it, but its how-to is not: add it to `gameCopy` in games.ts (see
  // docs/guides/create-a-game.md).
  it.each(games.map((game) => [game.id, game] as const))('%s has its how-to, in 3 to 5 lines', (id, game) => {
    expect(game.copy, `add "${id}" to gameCopy in apps/web/src/content/games.ts`).toBeDefined();
    expect(game.copy?.howTo.length).toBeGreaterThanOrEqual(3);
    expect(game.copy?.howTo.length).toBeLessThanOrEqual(5);
    expect(game.copy?.kind.length).toBeGreaterThan(0);
    expect(game.copy?.suits.length).toBeGreaterThan(0);
    expect(game.description, `${id}'s game.json needs a description`).not.toBe('');
  });

  it('have no copy left over for a game that is gone', () => {
    const ids = new Set(games.map((game) => game.id));
    expect(Object.keys(gameCopy).filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe('the FAQ', () => {
  it('has 8 to 12 short questions, each answered once', () => {
    expect(faq.questions.length).toBeGreaterThanOrEqual(8);
    expect(faq.questions.length).toBeLessThanOrEqual(12);
    expect(new Set(faq.questions.map(({ q }) => q)).size).toBe(faq.questions.length);
    for (const { q, a } of faq.questions) {
      expect(q.endsWith('?'), q).toBe(true);
      expect(a.length, q).toBeGreaterThan(20);
      // The answers are plain text: they are the page's FAQPage data as well.
      expect(a, q).not.toMatch(/[<>]|\[\[\[/);
    }
  });
});

describe('the install guide', () => {
  it('covers Android, iPhone, Zalo and Messenger, and a computer', () => {
    expect(install.platforms.map((platform) => platform.id)).toEqual([
      'android',
      'iphone',
      'zalo',
      'may-tinh',
    ]);
    for (const platform of install.platforms)
      expect(platform.steps.length, platform.id).toBeGreaterThanOrEqual(3);
  });
});
