// `tohe-assets resolve`: game.json's assets → assets.lock.json and src/assets.gen.ts, from each version's manifest.
import { creditsCoverLock } from '@tohe/contract';
import { type GameFolder, readDeclaredAssets, removeIfPresent, writeIfChanged } from './game.ts';
import { buildLock, creditsFromLock, renderAssetsModule, serializeLock } from './generate.ts';
import { fetchManifests } from './manifests.ts';
import { AssetsError, type AssetsOptions, resolveOptions } from './options.ts';

export interface ResolveResult {
  /** Files written or removed, as paths; empty when everything was up to date. */
  changed: string[];
  packs: number;
  files: number;
}

/**
 * Resolves a game: fetches every declared pack version's manifest, applies `include`, and writes the lock and the
 * typed module — after checking the licences and attributions, so a lock the build would refuse is never written. A
 * game that declares no assets loses both files.
 */
export async function resolveGame(game: GameFolder, options: AssetsOptions = {}): Promise<ResolveResult> {
  const assets = readDeclaredAssets(game);
  if (assets === undefined) {
    const changed = [game.lockPath, game.generatedPath].filter(removeIfPresent);
    return { changed, packs: 0, files: 0 };
  }
  const manifests = await fetchManifests(assets, resolveOptions(options));
  const lock = buildLock(assets, manifests);
  const problems = creditsCoverLock(lock, creditsFromLock(lock));
  if (problems.length > 0)
    throw new AssetsError(`${game.name}: the packs cannot be credited:\n  ${problems.join('\n  ')}`);
  const changed = [
    writeIfChanged(game.lockPath, serializeLock(lock)) ? game.lockPath : null,
    writeIfChanged(game.generatedPath, renderAssetsModule(lock, manifests)) ? game.generatedPath : null,
  ].filter((path) => path !== null);
  const files = Object.values(lock.packs).reduce((sum, pack) => sum + pack.files.length, 0);
  return { changed, packs: Object.keys(lock.packs).length, files };
}
