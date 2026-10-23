#!/usr/bin/env node
// tohe-assets resolve|check [game folder...]
// Without a folder: the game whose folder it runs in (pnpm's INIT_CWD, else the working directory), else every game in
// the repository's games/ — for resolve, those that declare assets or still have a lock.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkGame } from './check.ts';
import { type GameFolder, gameFolder, LOCK_FILE, MANIFEST_FILE, readDeclaredAssets } from './game.ts';
import { AssetsError } from './options.ts';
import { resolveGame } from './resolve.ts';

const USAGE = 'usage: tohe-assets resolve|check [game folder...]';

const isGame = (dir: string) => existsSync(join(dir, 'package.json')) && existsSync(join(dir, MANIFEST_FILE));

function repositoryRoot(from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

/** The games to work on, and whether they were found in games/ rather than named or worked in. */
function findGames(args: string[], start: string): { games: GameFolder[]; everyGame: boolean } {
  if (args.length > 0)
    return { games: args.map((arg) => gameFolder(resolve(start, arg), start)), everyGame: false };
  if (isGame(start)) return { games: [gameFolder(start, start)], everyGame: false };
  const root = repositoryRoot(start);
  if (!root) throw new AssetsError(`${start} is not a game's folder, nor inside a repository with games/`);
  const dir = join(root, 'games');
  if (!existsSync(dir)) return { games: [], everyGame: true };
  const games = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isGame(join(dir, entry.name)))
    .map((entry) => gameFolder(join(dir, entry.name), start))
    .sort((a, b) => (a.dir < b.dir ? -1 : 1));
  return { games, everyGame: true };
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  if (command !== 'resolve' && command !== 'check') {
    console.error(USAGE);
    return 2;
  }
  const start = process.env.INIT_CWD || process.cwd();
  const { games, everyGame } = findGames(args, start);
  let failed = 0;
  let resolved = 0;
  for (const game of games) {
    try {
      if (command === 'resolve') {
        // Across games/, a game with no assets and none of the files is none of resolve's business.
        const untouched =
          !readDeclaredAssets(game) && !existsSync(game.lockPath) && !existsSync(game.generatedPath);
        if (everyGame && untouched) continue;
        const result = await resolveGame(game);
        resolved++;
        const what = result.packs === 0 ? 'no assets' : `${result.packs} pack(s), ${result.files} file(s)`;
        console.log(
          `${game.name}: ${what}${result.changed.length > 0 ? ` — changed ${result.changed.length} file(s)` : ', up to date'}`,
        );
      } else {
        const problems = await checkGame(game);
        if (problems.length === 0) {
          if (readDeclaredAssets(game))
            console.log(`${game.name}: ${LOCK_FILE} and its typed module are up to date`);
          continue;
        }
        failed++;
        console.error(`${game.name}:\n  ${problems.join('\n  ')}`);
      }
    } catch (error) {
      if (!(error instanceof AssetsError)) throw error;
      failed++;
      console.error(error.message);
    }
  }
  if (command === 'check' && failed === 0) console.log(`assets: ${games.length} game(s) checked`);
  if (command === 'resolve' && resolved === 0 && failed === 0) console.log('assets: no game declares assets');
  return failed === 0 ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
