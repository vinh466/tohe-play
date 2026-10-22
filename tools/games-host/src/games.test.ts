// The games of this repository speak the hub's two languages (ADR 0048). Not a rule of the Game Contract — a game made
// elsewhere may speak one — but one of this repository: every game has its description in Vietnamese, `descriptions.vi`,
// its standard `description` being the English one. A Vietnamese name, `names.vi`, stays optional.
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

describe('the games in this repository (ADR 0048)', () => {
  it('are found', () => {
    expect(manifests.map(([id]) => id)).toEqual(
      expect.arrayContaining(['hello', 'merge-block', 'tap-merge', 'tien-len']),
    );
  });

  it.each(manifests)(
    '%s describes itself in Vietnamese and, as its standard description, in English',
    (_id, manifest) => {
      expect(manifest.descriptions?.vi, 'descriptions.vi in game.json').toBeTruthy();
      expect(manifest.description, 'description in game.json, the English one').toBeTruthy();
      expect(manifest.descriptions?.en, 'no descriptions.en: description is the English one').toBeUndefined();
    },
  );
});

// A game's public page is written beside it, in games/<id>/page/ (ADR 0047): its words, its facts and its link-preview
// pictures. Only public/ (through the game's build) reaches the games origin, so none of them may sit there.
describe('the games’ public-page sources stay off the games origin (ADR 0047)', () => {
  const pageFiles = /^(vi\.md|en\.md|facts\.json|og\.json|og\.[a-z]+\.png|page)$/;
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? [entry.name, ...walk(join(dir, entry.name))] : [entry.name],
    );

  it.each(manifests)('%s keeps them in page/, not in public/', (folder) => {
    expect(existsSync(join(gamesDir, folder, 'page', 'facts.json')), `games/${folder}/page/facts.json`).toBe(
      true,
    );
    expect(walk(join(gamesDir, folder, 'public')).filter((name) => pageFiles.test(name))).toEqual([]);
  });
});
