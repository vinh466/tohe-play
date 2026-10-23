// `prepare`: fit a pack's pictures to its style — snap to the palette, alpha to 0 or 255, trim transparent borders —
// and re-encode each as a PNG without metadata.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createCanvas, ImageData, loadImage } from '@napi-rs/canvas';
import { Refused } from './errors.ts';
import { isPng, sha256, stripPng } from './files.ts';
import { assetPath, type PackFile, readPack, writePack } from './pack.ts';

export type Rgb = readonly [number, number, number];

export interface PrepareOptions {
  /** Snap every opaque pixel to the nearest of these colours. */
  palette?: readonly Rgb[];
  /** Alpha below 128 becomes 0, the rest 255. */
  binaryAlpha?: boolean;
  /** Cut transparent borders away: the picture's size changes. */
  trim?: boolean;
}

export interface PreparedPicture {
  png: Uint8Array;
  width: number;
  height: number;
  /** Pixels whose colour moved to the palette. */
  snapped: number;
  /** Pixels whose alpha became 0 or 255. */
  alpha: number;
  /** The size before trimming, when trimming cut something. */
  trimmedFrom: { width: number; height: number } | null;
}

/** `#a1b2c3` → [161, 178, 195]. */
export function parseColour(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Refused(`${hex} is not a colour #rrggbb`);
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function nearest(palette: readonly Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0] as Rgb;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const colour of palette) {
    const distance = (colour[0] - r) ** 2 + (colour[1] - g) ** 2 + (colour[2] - b) ** 2;
    if (distance < bestDistance) {
      best = colour;
      bestDistance = distance;
    }
  }
  return best;
}

/** The smallest box holding every pixel that is not fully transparent; null when every pixel is. */
function opaqueBox(data: Uint8ClampedArray, width: number, height: number) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Decodes a picture (PNG or WebP), applies the options, and encodes it as a PNG with only its picture's chunks. */
export async function preparePicture(content: Uint8Array, options: PrepareOptions): Promise<PreparedPicture> {
  const image = await loadImage(Buffer.from(content));
  const { width, height } = image;
  const source = createCanvas(width, height);
  const context = source.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  let snapped = 0;
  let alpha = 0;
  for (let at = 0; at < data.length; at += 4) {
    const a = data[at + 3] ?? 0;
    if (options.binaryAlpha && a !== 0 && a !== 255) {
      data[at + 3] = a < 128 ? 0 : 255;
      alpha++;
    }
    if ((data[at + 3] ?? 0) === 0) {
      // A transparent pixel keeps no colour, so the same picture always makes the same file.
      data[at] = 0;
      data[at + 1] = 0;
      data[at + 2] = 0;
      continue;
    }
    if (options.palette && options.palette.length > 0) {
      const r = data[at] ?? 0;
      const g = data[at + 1] ?? 0;
      const b = data[at + 2] ?? 0;
      const colour = nearest(options.palette, r, g, b);
      if (colour[0] !== r || colour[1] !== g || colour[2] !== b) {
        data[at] = colour[0];
        data[at + 1] = colour[1];
        data[at + 2] = colour[2];
        snapped++;
      }
    }
  }
  let out = pixels;
  let trimmedFrom: PreparedPicture['trimmedFrom'] = null;
  if (options.trim) {
    const box = opaqueBox(data, width, height);
    if (box && (box.width !== width || box.height !== height)) {
      const cut = new Uint8ClampedArray(box.width * box.height * 4);
      for (let y = 0; y < box.height; y++) {
        const from = ((box.top + y) * width + box.left) * 4;
        cut.set(data.subarray(from, from + box.width * 4), y * box.width * 4);
      }
      out = new ImageData(cut, box.width, box.height);
      trimmedFrom = { width, height };
    }
  }
  if (snapped === 0 && alpha === 0 && !trimmedFrom && isPng(content)) {
    // The pixels stay as they were: keep the file's own encoding, without its metadata.
    return { png: stripPng(content), width, height, snapped, alpha, trimmedFrom };
  }
  const target = createCanvas(out.width, out.height);
  target.getContext('2d').putImageData(out, 0, 0);
  const png = stripPng(await target.encode('png'));
  return { png, width: out.width, height: out.height, snapped, alpha, trimmedFrom };
}

/** What `prepare` changed in one asset, in words. */
export interface PreparedAsset {
  id: string;
  changes: string[];
}

/** The kinds `prepare` works on: pictures. */
const PICTURES = new Set(['image', 'spritesheet', 'tileset']);

/** Prepares every picture of the pack in `dir` in place, and answers what changed in each. */
export async function preparePack(dir: string, options: PrepareOptions): Promise<PreparedAsset[]> {
  let pack: PackFile = readPack(dir);
  const report: PreparedAsset[] = [];
  const assets = [];
  for (const asset of pack.assets) {
    if (!PICTURES.has(asset.kind)) {
      assets.push(asset);
      continue;
    }
    const path = assetPath(dir, asset.file);
    const before = readFileSync(path);
    // Trimming a sprite sheet or a tileset would break its grid of frames.
    const trim = options.trim === true && asset.kind === 'image';
    let picture: PreparedPicture;
    try {
      picture = await preparePicture(before, { ...options, trim });
    } catch (error) {
      throw new Refused(
        `asset ${asset.id}: ${asset.file} is not a picture this tool decodes (${(error as Error).message})`,
      );
    }
    const changes: string[] = [];
    if (picture.snapped > 0) changes.push(`${picture.snapped} pixel(s) moved to the palette`);
    if (picture.alpha > 0) changes.push(`${picture.alpha} pixel(s) made fully opaque or transparent`);
    if (picture.trimmedFrom)
      changes.push(
        `trimmed from ${picture.trimmedFrom.width}×${picture.trimmedFrom.height} to ${picture.width}×${picture.height}`,
      );
    if (options.trim && !trim) changes.push(`not trimmed: a ${asset.kind} keeps its grid`);
    let file = asset.file;
    if (!/\.png$/i.test(file)) {
      file = `${file.replace(/\.[^./]*$/, '')}.png`;
      changes.push(`converted to PNG as ${file}`);
    }
    const unchanged = file === asset.file && sha256(picture.png) === sha256(before);
    if (!unchanged && changes.length === 0)
      changes.push(`metadata removed (${before.length} → ${picture.png.length} bytes)`);
    writeFileSync(assetPath(dir, file), picture.png);
    if (file !== asset.file) rmSync(path);
    assets.push({ ...asset, file });
    report.push({ id: asset.id, changes });
  }
  pack = { ...pack, assets };
  writePack(dir, pack);
  return report;
}
