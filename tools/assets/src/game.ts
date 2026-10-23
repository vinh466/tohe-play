// A game's folder as the tool sees it: `public/game.json` (its `assets`), `assets.lock.json` next to `package.json`,
// and `src/assets.gen.ts`.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { AssetsLock, GameAssets } from '@tohe/contract';
import { AssetsError } from './options.ts';

export const LOCK_FILE = 'assets.lock.json';
export const GENERATED_FILE = 'src/assets.gen.ts';
export const MANIFEST_FILE = 'public/game.json';

export const RESOLVE_HINT = 'run pnpm assets:resolve';

export interface GameFolder {
  dir: string;
  /** How errors name the game: its folder, relative to where the tool runs. */
  name: string;
  lockPath: string;
  generatedPath: string;
}

export function gameFolder(dir: string, from: string = process.cwd()): GameFolder {
  return {
    dir,
    name: relative(from, dir) || '.',
    lockPath: join(dir, LOCK_FILE),
    generatedPath: join(dir, GENERATED_FILE),
  };
}

/** `game.json`'s `assets`, or `undefined` when the game declares none. */
export function readDeclaredAssets(game: GameFolder): GameAssets | undefined {
  const path = join(game.dir, MANIFEST_FILE);
  if (!existsSync(path)) throw new AssetsError(`${game.name}: no ${MANIFEST_FILE}`);
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new AssetsError(`${game.name}/${MANIFEST_FILE} is not JSON: ${(error as Error).message}`);
  }
  const assets = (manifest as { assets?: unknown } | null)?.assets;
  if (assets === undefined) return undefined;
  const parsed = GameAssets.safeParse(assets);
  if (!parsed.success)
    throw new AssetsError(`${game.name}/${MANIFEST_FILE}: invalid assets\n${parsed.error.message}`);
  return parsed.data;
}

/** The game's lock: its text as it is on disk, and parsed. */
export function readLock(game: GameFolder): { text: string; lock: AssetsLock } {
  if (!existsSync(game.lockPath)) throw new AssetsError(`${game.name}: no ${LOCK_FILE} — ${RESOLVE_HINT}`);
  const text = readFileSync(game.lockPath, 'utf8');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new AssetsError(
      `${game.name}/${LOCK_FILE} is not JSON: ${(error as Error).message} — ${RESOLVE_HINT}`,
    );
  }
  const parsed = AssetsLock.safeParse(raw);
  if (!parsed.success)
    throw new AssetsError(
      `${game.name}/${LOCK_FILE} is not a valid lock — ${RESOLVE_HINT}\n${parsed.error.message}`,
    );
  return { text, lock: parsed.data };
}

export const readText = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

/** Writes a file only when its content changes, so an unchanged lock keeps its time stamp. */
export function writeIfChanged(path: string, text: string): boolean {
  if (readText(path) === text) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return true;
}

export function removeIfPresent(path: string): boolean {
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}
