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
