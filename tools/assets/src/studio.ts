// The build's studio/ folder (ADR 0053), from the lock alone: every locked file by hash, the lock, the credits.
import {
  creditsCoverLock,
  lockMatchesAssets,
  STUDIO_CREDITS,
  STUDIO_DIR,
  STUDIO_LOCK,
  studioFileName,
  studioMatchesLock,
} from '@tohe/contract';
import { type GameFolder, LOCK_FILE, RESOLVE_HINT, readDeclaredAssets, readLock } from './game.ts';
import { creditsFromLock, serializeCredits } from './generate.ts';
import { AssetsError, type AssetsOptions, resolveOptions } from './options.ts';
import { loadFiles, type StoredFile, sha256 } from './store.ts';

/** One file of studio/, its path relative to the build's root. */
export interface StudioOutput {
  fileName: string;
  source: Uint8Array | string;
}

/**
 * What a game's build carries in studio/, or `null` when it declares no assets. Reads only the lock — it never
 * resolves — and fails when the lock is not that of game.json's assets. Every file comes from the cache or the
 * registry, its hash checked.
 */
export async function studioOutputs(
  game: GameFolder,
  options: AssetsOptions = {},
): Promise<StudioOutput[] | null> {
  const assets = readDeclaredAssets(game);
  if (assets === undefined) return null;
  const { text, lock } = readLock(game);
  const declared = lockMatchesAssets(assets, lock);
  if (declared.length > 0)
    throw new AssetsError(
      `${game.name}/${LOCK_FILE} is not the lock of game.json's assets — ${RESOLVE_HINT}:\n  ${declared.join('\n  ')}`,
    );
  const credits = creditsFromLock(lock);
  const uncredited = creditsCoverLock(lock, credits);
  if (uncredited.length > 0)
    throw new AssetsError(`${game.name}: the packs cannot be credited:\n  ${uncredited.join('\n  ')}`);

  // One entry per distinct file: two packs may hold the same bytes, which studio/ keeps once.
  const files = new Map<string, StoredFile & { bytes: number }>();
  for (const [id, pack] of Object.entries(lock.packs))
    for (const file of pack.files)
      if (!files.has(studioFileName(file)))
        files.set(studioFileName(file), {
          sha256: file.sha256,
          ext: file.ext,
          bytes: file.bytes,
          label: `${id}/${file.id}`,
        });
  const wanted = [...files.values()];
  const contents = await loadFiles(wanted, resolveOptions(options));
  const outputs: StudioOutput[] = wanted.map((file, index) => {
    const source = contents[index] as Buffer;
    if (source.length !== file.bytes)
      throw new AssetsError(
        `${file.label}: ${source.length} bytes, the lock says ${file.bytes} — ${RESOLVE_HINT}`,
      );
    return { fileName: `${STUDIO_DIR}/${studioFileName(file)}`, source };
  });

  // The checks conformance will run on the build, run here first so a bad build fails where it is made.
  const entries = outputs.map((output) => ({
    name: output.fileName.slice(STUDIO_DIR.length + 1),
    sha256: sha256(output.source as Buffer),
  }));
  const mismatched = studioMatchesLock(lock, entries);
  if (mismatched.length > 0) throw new AssetsError(`${game.name}: ${mismatched.join('\n  ')}`);

  outputs.push(
    { fileName: STUDIO_LOCK, source: text },
    { fileName: STUDIO_CREDITS, source: serializeCredits(credits) },
  );
  return outputs;
}
