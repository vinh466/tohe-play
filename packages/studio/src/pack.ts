// A pack's working folder: pack.json (the pack and every asset's metadata) and the files it names.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';
import {
  ACCEPTED_ASSET_LICENCES,
  AssetId,
  AssetKind,
  GameId,
  licenceNeedsAttribution,
  PackId,
  SemVer,
} from '@tohe/contract';
import { z } from 'zod';
import { type Problem, Refused, UsageError } from './errors.ts';

export const PACK_FILE = 'pack.json';
/** Where the CLI keeps the files it adds, inside the working folder. */
export const FILES_DIR = 'files';

/** The server's limits on an asset's metadata (StudioInput in the API). */
const MAX_SOURCE_CHARS = 8000;
const MAX_TAGS = 20;
const MAX_TAG = 40;
const MAX_DESCRIPTION = 500;
const MAX_PIXELS = 16384;

/** Text that is not blank, kept exactly as written (a script's source is the script). */
const Text = z.string().refine((text) => text.trim().length > 0, 'must not be blank');

/**
 * Where an asset came from (docs/architecture/asset-studio.md#packs): `pack` (name, URL, author), `upload` (who), `ai`
 * (vendor, model, prompt, seed, date) or `code` (the script). Further keys are kept as they are.
 */
export const AssetSource = z.discriminatedUnion('kind', [
  z.looseObject({ kind: z.literal('pack'), name: Text, url: z.url(), author: Text }),
  z.looseObject({ kind: z.literal('code'), script: Text }),
  z.looseObject({ kind: z.literal('upload'), by: Text }),
  z.looseObject({
    kind: z.literal('ai'),
    vendor: Text,
    model: Text,
    prompt: Text,
    date: Text,
    seed: z.union([z.string(), z.number()]).optional(),
  }),
]);
export type AssetSource = z.infer<typeof AssetSource>;

const Size = z.number().int().min(1).max(MAX_PIXELS);

/** One asset in pack.json. Its sha256, bytes and size are read from its file when it is checked. */
export const PackAsset = z
  .object({
    id: AssetId,
    kind: AssetKind,
    /** The file, relative to the working folder. */
    file: Text,
    tags: z.array(z.string().trim().min(1).max(MAX_TAG)).max(MAX_TAGS).default([]),
    /** An SPDX identifier; the Studio accepts those in @tohe/contract's ACCEPTED_ASSET_LICENCES. */
    licence: Text,
    /** The credit, when the licence asks for one; none otherwise. */
    attribution: z.string().trim().min(1).max(1000).nullable().default(null),
    source: AssetSource,
    /** A sprite sheet's frame, or a tileset's tile: its size and how many. */
    frames: z.object({ width: Size, height: Size, count: z.number().int().min(1).max(10000) }).optional(),
  })
  .strict();
export type PackAsset = z.infer<typeof PackAsset>;

/** pack.json. */
export const PackFile = z
  .object({
    id: PackId,
    version: SemVer,
    /** The style's id in the Studio. */
    style: GameId,
    description: z.string().trim().max(MAX_DESCRIPTION).default(''),
    assets: z.array(PackAsset).default([]),
  })
  .strict();
export type PackFile = z.infer<typeof PackFile>;

export const packPath = (dir: string) => join(dir, PACK_FILE);

/** A file an asset names, inside the working folder; refuses a path that leaves it. */
export function assetPath(dir: string, file: string): string {
  const relative = normalize(file);
  if (isAbsolute(relative) || relative === '..' || relative.startsWith(`..${sep}`))
    throw new Refused(`${file} is outside the pack's folder: name files relative to it`);
  return join(dir, relative);
}

/** Reads pack.json: a usage error when there is none, a refusal naming every field that is wrong. */
export function readPack(dir: string): PackFile {
  const path = packPath(dir);
  if (!existsSync(path))
    throw new UsageError(`${path} does not exist: start the pack with tohe-studio pack init ${dir} --id …`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Refused(`${path} is not JSON: ${(error as Error).message}`);
  }
  const parsed = PackFile.safeParse(json);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Refused(`${path} is not a valid pack:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

/** Writes pack.json, its assets sorted by id, so the same pack always makes the same file. */
export function writePack(dir: string, pack: PackFile): void {
  const sorted: PackFile = { ...pack, assets: [...pack.assets].sort((a, b) => (a.id < b.id ? -1 : 1)) };
  writeFileSync(packPath(dir), `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Adds an asset to the pack, or replaces the one with its id. */
export function putAsset(pack: PackFile, asset: PackAsset): PackFile {
  return { ...pack, assets: [...pack.assets.filter((other) => other.id !== asset.id), asset] };
}

/**
 * The pack's own problems, found before anything is sent: a missing file, a licence the Studio never accepts, a credit
 * missing, a repeated id, a source longer than the server keeps.
 */
export function lintPack(dir: string, pack: PackFile): Problem[] {
  const problems: Problem[] = [];
  const accepted: readonly string[] = ACCEPTED_ASSET_LICENCES;
  const seen = new Set<string>();
  if (pack.assets.length === 0)
    problems.push({ code: 'assets_required', message: 'the pack has no asset yet: import or draw some' });
  for (const asset of pack.assets) {
    const at = { assetId: asset.id };
    if (seen.has(asset.id))
      problems.push({ ...at, code: 'asset_id_repeated', message: 'two assets have this id' });
    seen.add(asset.id);
    let path: string | null = null;
    try {
      path = assetPath(dir, asset.file);
    } catch (error) {
      problems.push({ ...at, code: 'file_outside', message: (error as Error).message });
    }
    if (path && !existsSync(path))
      problems.push({ ...at, code: 'file_missing', message: `${asset.file} does not exist` });
    if (!accepted.includes(asset.licence))
      problems.push({
        ...at,
        code: 'licence_not_accepted',
        message: `${asset.licence} is not a licence the Studio accepts (${accepted.join(', ')})`,
      });
    else if (licenceNeedsAttribution(asset.licence) && !asset.attribution)
      problems.push({
        ...at,
        code: 'attribution_required',
        message: `${asset.licence} asks for a credit: set the asset's attribution`,
      });
    if (JSON.stringify(asset.source).length > MAX_SOURCE_CHARS)
      problems.push({
        ...at,
        code: 'source_too_long',
        message: `its source is longer than the ${MAX_SOURCE_CHARS} characters the Studio keeps`,
      });
    if (asset.kind === 'spritesheet' && !asset.frames)
      problems.push({
        ...at,
        code: 'frames_required',
        message: 'a sprite sheet names its frames: { "width", "height", "count" }',
      });
  }
  return problems;
}
