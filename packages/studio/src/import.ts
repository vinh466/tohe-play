// `import`: take pictures from a known source's zip, each with its source and licence filled in.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, matchesGlob, posix } from 'node:path';
import { unzipSync } from 'fflate';
import { Refused, UsageError } from './errors.ts';
import { assetPath, FILES_DIR, type PackAsset, putAsset, readPack, writePack } from './pack.ts';
import type { Io } from './settings.ts';
import type { KnownSource } from './sources.ts';

/** The most a downloaded archive may hold. */
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
/** What a pack keeps: single pictures (docs/architecture/asset-studio.md#checks). */
const PICTURE = /\.(png|webp)$/i;

export interface ImportOptions {
  /** Globs of the archive's paths; default the source's own. */
  include?: string[];
  /** A zip on disk, or another URL, instead of the source's download. */
  from?: string;
  fetch?: typeof fetch;
}

/** `Tiles/tile_0001.png` → `tiles/tile-0001`; null when nothing of the name is left. */
export function assetIdFromPath(path: string): string | null {
  const withoutExt = path.slice(0, path.length - extname(path).length);
  const segments = withoutExt
    .split('/')
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter((segment) => segment.length > 0);
  const id = segments.join('/');
  return id.length > 0 && id.length <= 100 ? id : null;
}

async function readArchive(
  source: KnownSource,
  options: ImportOptions,
): Promise<{ bytes: Uint8Array; from: string }> {
  const from = options.from ?? source.download;
  if (!/^https?:\/\//.test(from)) {
    if (!existsSync(from)) throw new UsageError(`${from} does not exist`);
    return { bytes: readFileSync(from), from };
  }
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(from);
  } catch (error) {
    throw new Refused(`cannot download ${from}: ${(error as Error).message}`);
  }
  if (!response.ok)
    throw new Refused(
      `${from} answered ${response.status}: the pack may have moved — download it from ${source.page} and pass --from <zip>`,
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_ARCHIVE_BYTES)
    throw new Refused(`${from} is larger than ${MAX_ARCHIVE_BYTES} bytes`);
  return { bytes, from };
}

/** Adds the source's pictures to the pack in `dir`, and answers the ids added. */
export async function importSource(
  dir: string,
  source: KnownSource,
  options: ImportOptions,
  io: Io,
): Promise<string[]> {
  let pack = readPack(dir);
  const include = options.include && options.include.length > 0 ? options.include : source.include;
  const { bytes, from } = await readArchive(source, options);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (file) =>
        !file.name.endsWith('/') &&
        PICTURE.test(file.name) &&
        include.some((glob) => matchesGlob(file.name, glob)),
    });
  } catch (error) {
    throw new Refused(`${from} is not a zip archive: ${(error as Error).message}`);
  }
  const names = Object.keys(entries).sort();
  if (names.length === 0)
    throw new Refused(
      `no picture in ${from} matches ${include.join(', ')}: look at its paths and pass --include`,
    );
  const added: string[] = [];
  for (const name of names) {
    const content = entries[name];
    const id = assetIdFromPath(posix.normalize(name));
    if (!content || !id) {
      io.err(`skipped ${name}: no asset id can be made of its name`);
      continue;
    }
    if (added.includes(id)) {
      io.err(`skipped ${name}: another file of the archive already became ${id}`);
      continue;
    }
    const file = `${FILES_DIR}/${id}${extname(name).toLowerCase()}`;
    const path = assetPath(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    const asset: PackAsset = {
      id,
      kind: 'image',
      file,
      tags: [...source.tags],
      licence: source.licence,
      attribution: source.attribution,
      source: { kind: 'pack', name: source.title, url: source.page, author: source.author, file: name },
    };
    pack = putAsset(pack, asset);
    added.push(id);
  }
  writePack(dir, pack);
  return added;
}
