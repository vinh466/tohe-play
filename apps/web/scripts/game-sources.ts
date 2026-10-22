// Every game's sources for its public pages, read from the disk (ADR 0047): games/<id>/public/game.json, and
// games/<id>/page/vi.md, en.md and facts.json, with the rules of src/content/game-page.ts. For the scripts that run
// outside Vite — the preview pictures (render-og.ts) and the build's check (check-build.ts); the pages read the same
// files through Vite (src/content/games.ts). A game is a folder with a game.json; a folder with only a SPEC.md is no
// game yet.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameManifest } from '@tohe/contract';
import {
  type GameFacts,
  type GamePageText,
  parseGameFacts,
  parseGamePage,
} from '../src/content/game-page.ts';
import { type Lang, languages } from '../src/i18n.ts';

export interface GameSource {
  id: string;
  /** The game's folder, absolute. */
  folder: string;
  manifest: GameManifest;
  facts: GameFacts;
  pages: Record<Lang, GamePageText>;
}

/** The games under `gamesDir`, by id, and what is wrong with any of them (a missing or broken file). */
export function readGameSources(gamesDir: string): { games: GameSource[]; problems: string[] } {
  const games: GameSource[] = [];
  const problems: string[] = [];
  for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
    const folder = join(gamesDir, entry.name);
    if (!entry.isDirectory() || !existsSync(join(folder, 'public', 'game.json'))) continue;
    const shown = (file: string) => `games/${entry.name}/${file}`;
    try {
      const manifest = GameManifest.parse(
        JSON.parse(readFileSync(join(folder, 'public', 'game.json'), 'utf8')),
      );
      const read = (file: string) => {
        if (!existsSync(join(folder, file))) {
          throw new Error(
            `${shown(file)} is missing: every game has its page in Vietnamese and English and its facts (docs/guides/create-a-game.md)`,
          );
        }
        return readFileSync(join(folder, file), 'utf8');
      };
      const facts = parseGameFacts(JSON.parse(read('page/facts.json')), shown('page/facts.json'));
      const pages = Object.fromEntries(
        languages.map((lang) => [
          lang,
          parseGamePage(read(`page/${lang}.md`), lang, shown(`page/${lang}.md`)),
        ]),
      ) as Record<Lang, GamePageText>;
      for (const lang of languages) {
        for (const { file } of pages[lang].pictures) {
          if (!existsSync(join(folder, 'page', file)))
            problems.push(`${shown(`page/${lang}.md`)}: ${file} is not beside it`);
        }
      }
      games.push({ id: manifest.id, folder, manifest, facts, pages });
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { games: games.sort((a, b) => a.id.localeCompare(b.id)), problems };
}
