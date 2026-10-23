// Files by hash: the registry (the Studio's public storage) and the cache shared by every worktree on the machine.
// Every file's sha256 is checked on download and on every read from the cache.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AssetsError, type ResolvedOptions, registryBase } from './options.ts';

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export const manifestUrl = (base: string, pack: string, version: string) =>
  `${base}/packs/${pack}/${version}.json`;
export const blobUrl = (base: string, hash: string, ext: string) => `${base}/blobs/sha256/${hash}.${ext}`;

const FETCH_TIMEOUT_MS = 30_000;

/** GETs a URL: its bytes, or `null` when the registry has nothing there (404, 410). Any other failure throws. */
export async function download(url: string, what: string): Promise<Buffer | null> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new AssetsError(`${what}: could not fetch ${url}: ${(error as Error).message}`);
  }
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok)
    throw new AssetsError(`${what}: ${url} answered ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

/** A file the cache keeps: by its hash, with its extension. */
export interface StoredFile {
  sha256: string;
  ext: string;
  /** What a person calls it in an error: `farm-crops/crops/carrot`. */
  label: string;
}

const cachePath = (cacheDir: string, file: StoredFile) => join(cacheDir, `${file.sha256}.${file.ext}`);

/** A file from the cache, its hash checked; `null` when it is not there. */
export function readCached(cacheDir: string, file: StoredFile): Buffer | null {
  const path = cachePath(cacheDir, file);
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  const actual = sha256(bytes);
  if (actual !== file.sha256)
    throw new AssetsError(
      `${file.label}: ${path} in the cache hashes to ${actual}, not ${file.sha256} — delete it and try again`,
    );
  return bytes;
}

/** Writes a file into the cache through a temporary name, so another worktree never reads half a file. */
export function writeCached(cacheDir: string, file: StoredFile, bytes: Uint8Array): void {
  mkdirSync(cacheDir, { recursive: true });
  const path = cachePath(cacheDir, file);
  const temporary = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, path);
}

/** Checks downloaded bytes against the hash they were asked for. */
export function verifyDownload(file: StoredFile, url: string, bytes: Uint8Array): void {
  const actual = sha256(bytes);
  if (actual !== file.sha256)
    throw new AssetsError(`${file.label}: ${url} hashes to ${actual}, not ${file.sha256}`);
}

const CONCURRENCY = 8;

/**
 * Every file, from the cache or, when it is missing there, from the registry by its hash (then kept in the cache).
 * Offline, nothing is fetched: every file missing from the cache is named in one error.
 */
export async function loadFiles(files: readonly StoredFile[], options: ResolvedOptions): Promise<Buffer[]> {
  const found = files.map((file) => readCached(options.cacheDir, file));
  const missing = files.filter((_, index) => found[index] === null);
  if (missing.length === 0) return found as Buffer[];
  if (options.offline)
    throw new AssetsError(
      `offline (TOHE_ASSETS_OFFLINE=1), and ${missing.length} file(s) are not in the cache ${options.cacheDir}:\n` +
        missing.map((file) => `  ${file.label} (${file.sha256}.${file.ext})`).join('\n'),
    );
  const base = registryBase(options, `${missing.length} file(s) are not in the cache`);
  const queue = files.map((file, index) => ({ file, index })).filter(({ index }) => found[index] === null);
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const url = blobUrl(base, next.file.sha256, next.file.ext);
      const bytes = await download(url, next.file.label);
      if (bytes === null) throw new AssetsError(`${next.file.label}: the registry has no file at ${url}`);
      verifyDownload(next.file, url, bytes);
      writeCached(options.cacheDir, next.file, bytes);
      found[next.index] = bytes;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return found as Buffer[];
}
