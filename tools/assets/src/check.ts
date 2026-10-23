// `tohe-assets check`: the drift check. The lock must be what game.json's assets and the manifests it pins make, and
// src/assets.gen.ts exactly what they generate; a game without assets has neither file.
import { lockMatchesAssets } from '@tohe/contract';
import {
  type GameFolder,
  GENERATED_FILE,
  LOCK_FILE,
  RESOLVE_HINT,
  readDeclaredAssets,
  readLock,
  readText,
} from './game.ts';
import { buildLock, renderAssetsModule, serializeLock } from './generate.ts';
import { pinnedManifests } from './manifests.ts';
import { AssetsError, type AssetsOptions, resolveOptions } from './options.ts';

/** What is out of date in a game, one line each; empty when nothing is. */
export async function checkGame(game: GameFolder, options: AssetsOptions = {}): Promise<string[]> {
  const assets = readDeclaredAssets(game);
  if (assets === undefined)
    return [
      ...(readText(game.lockPath) === null ? [] : [`${LOCK_FILE} exists, but game.json declares no assets`]),
      ...(readText(game.generatedPath) === null
        ? []
        : [`${GENERATED_FILE} exists, but game.json declares no assets`]),
    ];
  let lock: ReturnType<typeof readLock>['lock'];
  try {
    lock = readLock(game).lock;
  } catch (error) {
    if (error instanceof AssetsError) return [error.message];
    throw error;
  }
  const declared = lockMatchesAssets(assets, lock);
  if (declared.length > 0) return declared.map((line) => `${LOCK_FILE}: ${line}`);
  const manifests = await pinnedManifests(lock, resolveOptions(options));
  const problems: string[] = [];
  let expected: typeof lock | null = null;
  try {
    expected = buildLock(assets, manifests);
  } catch (error) {
    if (!(error instanceof AssetsError)) throw error;
    problems.push(`${LOCK_FILE}: ${error.message}`);
  }
  if (expected && serializeLock(expected) !== serializeLock(lock))
    problems.push(`${LOCK_FILE} is not what game.json's assets and the manifests it pins make`);
  const generated = readText(game.generatedPath);
  if (generated === null) problems.push(`${GENERATED_FILE} is missing`);
  else if (generated !== renderAssetsModule(lock, manifests))
    problems.push(`${GENERATED_FILE} is not what ${LOCK_FILE} generates`);
  return problems.length === 0 ? [] : [...problems, `${RESOLVE_HINT}, and commit both files`];
}
