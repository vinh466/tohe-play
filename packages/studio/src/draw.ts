// `draw`: run a drawing script; every picture it saves becomes an asset whose source is the script itself, so a
// code-drawn asset can be made again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Canvas, createCanvas, loadImage } from '@napi-rs/canvas';
import { AssetId, AssetKind } from '@tohe/contract';
import { Refused, UsageError } from './errors.ts';
import { stripPng } from './files.ts';
import { assetPath, FILES_DIR, type PackAsset, putAsset, readPack, writePack } from './pack.ts';

/** What is made for Tò He is under this licence until the repository has one (docs/architecture/asset-studio.md#licences). */
export const DRAWN_LICENCE = 'LicenseRef-Tohe-Internal';

export interface SaveOptions {
  kind?: AssetKind;
  tags?: string[];
  /** A sprite sheet's frame, or a tileset's tile: its size and how many. */
  frames?: { width: number; height: number; count: number };
}

/** What a drawing script's default export is given. */
export interface DrawTools {
  createCanvas: typeof createCanvas;
  loadImage: typeof loadImage;
  /** Keeps the canvas as the asset `id` (`crops/carrot`), a PNG without metadata. */
  save(id: string, canvas: Canvas, options?: SaveOptions): Promise<void>;
}

export type DrawScript = (tools: DrawTools) => unknown | Promise<unknown>;

/** Runs the script at `script` for the pack in `dir`, and answers the ids it saved. */
export async function drawWith(dir: string, script: string): Promise<string[]> {
  const path = resolve(script);
  if (!existsSync(path)) throw new UsageError(`${script} does not exist`);
  let pack = readPack(dir);
  const text = readFileSync(path, 'utf8');
  const module = (await import(pathToFileURL(path).href)) as { default?: unknown };
  if (typeof module.default !== 'function')
    throw new UsageError(
      `${script} must export a default function: export default async ({ createCanvas, save }) => …`,
    );
  const saved: string[] = [];
  const save = async (id: string, canvas: Canvas, options: SaveOptions = {}) => {
    if (!AssetId.safeParse(id).success)
      throw new Refused(`save(${JSON.stringify(id)}): an asset id is a-z, digits, - and / for folders`);
    if (options.kind !== undefined && !AssetKind.safeParse(options.kind).success)
      throw new Refused(`save(${id}): ${options.kind} is not a kind of asset`);
    if (saved.includes(id)) throw new Refused(`save(${id}): the script saved this id twice`);
    const file = `${FILES_DIR}/${id}.png`;
    const out = assetPath(dir, file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, stripPng(await canvas.encode('png')));
    const asset: PackAsset = {
      id,
      kind: options.kind ?? 'image',
      file,
      tags: options.tags ?? [],
      licence: DRAWN_LICENCE,
      attribution: null,
      source: { type: 'code', file: basename(path), script: text },
      ...(options.frames ? { frames: options.frames } : {}),
    };
    pack = putAsset(pack, asset);
    saved.push(id);
  };
  await (module.default as DrawScript)({ createCanvas, loadImage, save });
  if (saved.length === 0)
    throw new Refused(`${script} saved nothing: call save(id, canvas) for every picture`);
  writePack(dir, pack);
  return saved;
}
