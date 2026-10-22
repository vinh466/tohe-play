// The games of this repository speak the hub's two languages (ADR 0048). Not a rule of the Game Contract — a game made
// elsewhere may speak one — but one of this repository: every game has its description in Vietnamese and in English,
// its standard description is the English one, and a game whose standard name is not Vietnamese has a Vietnamese name.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';

const gamesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../games');

const manifests = readdirSync(gamesDir, { withFileTypes: true })
  .filter((folder) => folder.isDirectory() && existsSync(join(gamesDir, folder.name, 'public', 'game.json')))
  .map((folder) => {
    const file = join(gamesDir, folder.name, 'public', 'game.json');
    return [folder.name, GameManifest.parse(JSON.parse(readFileSync(file, 'utf8')))] as const;
  });

/**
 * A name is taken for Vietnamese when it has đ, or one of the marks Vietnamese letters carry: the circumflex, breve and
 * horn of â ă ê ô ơ ư, and the five tone marks. A Vietnamese name written without them gets a `names.vi`, which costs
 * nothing; an English name with an accent ("Café") passes as Vietnamese, which a review catches.
 */
const VIETNAMESE_MARKS = new Set([0x0300, 0x0301, 0x0302, 0x0303, 0x0306, 0x0309, 0x031b, 0x0323]);
const looksVietnamese = (name: string) =>
  [...name.normalize('NFD').toLowerCase()].some(
    (letter) => letter === 'đ' || VIETNAMESE_MARKS.has(letter.codePointAt(0) ?? 0),
  );

describe('a name is taken for Vietnamese', () => {
  it.each(['Tiến Lên', 'Ô Ăn Quan', 'Cờ Caro', 'Đố Vui'])('%s is', (name) => {
    expect(looksVietnamese(name)).toBe(true);
  });
  it.each(['Merge Blocks', 'Tap Dot', 'Sudoku', '2048'])('%s is not', (name) => {
    expect(looksVietnamese(name)).toBe(false);
  });
});

describe('the games in this repository (ADR 0048)', () => {
  it('are found', () => {
    expect(manifests.map(([id]) => id)).toEqual(
      expect.arrayContaining(['hello', 'merge-block', 'tap-merge', 'tien-len']),
    );
  });

  it.each(manifests)('%s describes itself in Vietnamese and in English', (_id, manifest) => {
    expect(manifest.descriptions?.vi, 'descriptions.vi in game.json').toBeTruthy();
    expect(manifest.descriptions?.en, 'descriptions.en in game.json').toBeTruthy();
    expect(manifest.description, 'description is the English one, descriptions.en').toBe(
      manifest.descriptions?.en,
    );
  });

  it.each(manifests)('%s has a Vietnamese name when its standard name is not one', (_id, manifest) => {
    if (looksVietnamese(manifest.name)) return;
    expect(manifest.names?.vi, `names.vi in game.json: "${manifest.name}" is not Vietnamese`).toBeTruthy();
  });
});
