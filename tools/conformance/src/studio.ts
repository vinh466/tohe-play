// A game's assets (ADR 0053): with `assets` in game.json, its build carries `studio/` — every file by hash, the lock
// and the credits. Reads the folder and hashes its files; the checks themselves are @tohe/contract's, pure.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AssetCredits,
  AssetsLock,
  creditsCoverLock,
  type GameAssets,
  lockMatchesAssets,
  STUDIO_CREDITS,
  STUDIO_DIR,
  STUDIO_LOCK,
  type StudioEntry,
  studioMatchesLock,
} from '@tohe/contract';

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

/** What readJson needs of a Zod schema (zod is not a dependency of the kit of its own). */
interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}

const LOCK_FILE = 'lock.json';
const CREDITS_FILE = 'credits.json';

/** Reads and parses one of studio/'s JSON files; the problem in words when it cannot. */
function readJson<T>(
  dist: string,
  path: string,
  schema: Schema<T>,
): { ok: true; value: T } | { ok: false; detail: string } {
  const file = join(dist, path);
  if (!existsSync(file)) return { ok: false, detail: `missing ${path}` };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { ok: false, detail: `${path} is not JSON: ${(error as Error).message}` };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, detail: `${path}: ${parsed.error.message}` };
}

/** Every entry of studio/ but the lock and the credits, with the sha256 of each file's content (null for a folder). */
function studioEntries(dist: string): StudioEntry[] {
  const dir = join(dist, STUDIO_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name !== LOCK_FILE && entry.name !== CREDITS_FILE)
    .map((entry) => ({
      name: entry.name,
      sha256: entry.isFile()
        ? createHash('sha256')
            .update(readFileSync(join(dir, entry.name)))
            .digest('hex')
        : null,
    }));
}

const lines = (problems: string[], ok: string) =>
  problems.length === 0
    ? ok
    : problems.slice(0, 8).join('\n') + (problems.length > 8 ? `\n… ${problems.length - 8} more` : '');

/**
 * The three checks of ADR 0053 for a game that declares `assets`: the lock's packs and versions are those of `assets`;
 * studio/'s files and the lock's match by sha256 both ways; every licence is accepted and the credits name every
 * attribution. A lock or credits that cannot be read fails the checks that need it.
 */
export function checkStudio(dist: string, assets: GameAssets): Check[] {
  const checks: Check[] = [];
  const lock = readJson(dist, STUDIO_LOCK, AssetsLock);
  if (!lock.ok) {
    checks.push({ name: `assets: ${STUDIO_LOCK} is a valid lock`, ok: false, detail: lock.detail });
    return checks;
  }
  const packs = Object.keys(lock.value.packs).length;
  const files = Object.values(lock.value.packs).reduce((sum, pack) => sum + pack.files.length, 0);
  const declared = lockMatchesAssets(assets, lock.value);
  checks.push({
    name: "assets: the lock's packs and versions are those game.json declares",
    ok: declared.length === 0,
    detail: lines(declared, `${packs} packs`),
  });
  const matched = studioMatchesLock(lock.value, studioEntries(dist));
  checks.push({
    name: `assets: every file in ${STUDIO_DIR}/ is in the lock by its sha256, and every locked file is there`,
    ok: matched.length === 0,
    detail: lines(matched, `${files} files`),
  });
  const credits = readJson(dist, STUDIO_CREDITS, AssetCredits);
  const credited = credits.ok ? creditsCoverLock(lock.value, credits.value) : [credits.detail];
  checks.push({
    name: `assets: every licence is accepted, and ${STUDIO_CREDITS} names every attribution`,
    ok: credited.length === 0,
    detail: lines(credited, `${files} files credited`),
  });
  return checks;
}
