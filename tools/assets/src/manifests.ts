// Pack manifests: fetched by version when resolving (the registry decides what a version holds), read by the hash the
// lock pins when checking (from the cache, or the registry and checked against that hash).
import type { AssetsLock, GameAssets } from '@tohe/contract';
import type { PinnedManifest } from './generate.ts';
import { PackManifest } from './manifest.ts';
import { AssetsError, type ResolvedOptions, registryBase } from './options.ts';
import {
  download,
  manifestUrl,
  readCached,
  type StoredFile,
  sha256,
  verifyDownload,
  writeCached,
} from './store.ts';

function parseManifest(
  label: string,
  where: string,
  bytes: Buffer,
  pack: string,
  version: string,
): PackManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new AssetsError(`${label}: ${where} is not JSON: ${(error as Error).message}`);
  }
  const parsed = PackManifest.safeParse(raw);
  if (!parsed.success)
    throw new AssetsError(`${label}: ${where} is not a pack manifest\n${parsed.error.message}`);
  if (parsed.data.id !== pack || parsed.data.version !== version)
    throw new AssetsError(`${label}: ${where} is the manifest of ${parsed.data.id}@${parsed.data.version}`);
  return parsed.data;
}

/** Every declared pack's manifest, fetched by its version; each is kept in the cache by its hash. */
export async function fetchManifests(
  assets: GameAssets,
  options: ResolvedOptions,
): Promise<Map<string, PinnedManifest>> {
  const packs = Object.entries(assets);
  if (packs.length === 0) return new Map();
  if (options.offline)
    throw new AssetsError('resolving reads every pack version from the registry, and TOHE_ASSETS_OFFLINE=1');
  const base = registryBase(options, 'resolving reads every pack version from the registry');
  const fetched = await Promise.all(
    packs.map(async ([id, ref]) => {
      const label = `${id}@${ref.version}`;
      const url = manifestUrl(base, id, ref.version);
      const bytes = await download(url, label);
      if (bytes === null)
        throw new AssetsError(
          `${label}: the registry has no manifest at ${url} — the version does not exist, or it was withdrawn`,
        );
      const manifest = parseManifest(label, url, bytes, id, ref.version);
      const hash = sha256(bytes);
      writeCached(options.cacheDir, { sha256: hash, ext: 'json', label }, bytes);
      return [id, { sha256: hash, manifest }] as const;
    }),
  );
  return new Map(fetched);
}

/** Every locked pack's manifest, by the hash the lock pins: from the cache, else from the registry, checked. */
export async function pinnedManifests(
  lock: AssetsLock,
  options: ResolvedOptions,
): Promise<Map<string, PinnedManifest>> {
  const result = new Map<string, PinnedManifest>();
  const missing: { id: string; version: string; file: StoredFile }[] = [];
  for (const [id, pack] of Object.entries(lock.packs)) {
    const file: StoredFile = { sha256: pack.manifest, ext: 'json', label: `${id}@${pack.version}` };
    const bytes = readCached(options.cacheDir, file);
    if (bytes === null) missing.push({ id, version: pack.version, file });
    else
      result.set(id, {
        sha256: pack.manifest,
        manifest: parseManifest(file.label, 'its manifest in the cache', bytes, id, pack.version),
      });
  }
  if (missing.length === 0) return result;
  if (options.offline)
    throw new AssetsError(
      `offline (TOHE_ASSETS_OFFLINE=1), and ${missing.length} pack manifest(s) are not in the cache ${options.cacheDir}:\n` +
        missing.map(({ file }) => `  ${file.label} (${file.sha256}.json)`).join('\n'),
    );
  const base = registryBase(options, `${missing.length} pack manifest(s) are not in the cache`);
  await Promise.all(
    missing.map(async ({ id, version, file }) => {
      const url = manifestUrl(base, id, version);
      const bytes = await download(url, file.label);
      if (bytes === null)
        throw new AssetsError(
          `${file.label}: the registry has no manifest at ${url} — the version does not exist, or it was withdrawn`,
        );
      verifyDownload(file, url, bytes);
      writeCached(options.cacheDir, file, bytes);
      result.set(id, { sha256: file.sha256, manifest: parseManifest(file.label, url, bytes, id, version) });
    }),
  );
  return result;
}
