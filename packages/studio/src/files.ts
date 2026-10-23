// What the Studio is told about a file — its sha256, bytes, extension and size — and PNG chunks.
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface FileFacts {
  sha256: string;
  bytes: number;
  /** The extension without the dot, lower-case. */
  ext: string;
  /** A PNG's size; none for another format. */
  width: number | null;
  height: number | null;
}

export const sha256 = (content: Uint8Array) => createHash('sha256').update(content).digest('hex');

export const isPng = (content: Uint8Array) =>
  content.length >= 8 && PNG_SIGNATURE.every((byte, index) => content[index] === byte);

export function fileFacts(name: string, content: Uint8Array): FileFacts {
  const size = isPng(content) ? pngSize(content) : null;
  return {
    sha256: sha256(content),
    bytes: content.length,
    ext: extname(name).slice(1).toLowerCase(),
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

interface Chunk {
  type: string;
  /** Where the chunk starts (its length field) and where the next one starts. */
  start: number;
  end: number;
}

function chunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const found: Chunk[] = [];
  for (let at = PNG_SIGNATURE.length; at + 12 <= png.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const end = at + 12 + length;
    if (end > png.length) break;
    found.push({ type, start: at, end });
    at = end;
    if (type === 'IEND') break;
  }
  return found;
}

/** The size in a PNG's IHDR. */
export function pngSize(png: Uint8Array): { width: number; height: number } | null {
  const header = chunks(png)[0];
  if (header?.type !== 'IHDR') return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(header.start + 8), height: view.getUint32(header.start + 12) };
}

/** The chunk types of a PNG, in order. */
export const pngChunkTypes = (png: Uint8Array) => chunks(png).map((chunk) => chunk.type);

/** The chunks a picture needs; everything else — text, time, colour profiles, EXIF — is metadata. */
const PICTURE_CHUNKS = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);

/** The PNG with only the chunks that make its pixels (each chunk keeps its own CRC). */
export function stripPng(png: Uint8Array): Uint8Array {
  const kept = chunks(png).filter((chunk) => PICTURE_CHUNKS.has(chunk.type));
  const out = new Uint8Array(
    PNG_SIGNATURE.length + kept.reduce((sum, chunk) => sum + chunk.end - chunk.start, 0),
  );
  out.set(PNG_SIGNATURE, 0);
  let at = PNG_SIGNATURE.length;
  for (const chunk of kept) {
    out.set(png.subarray(chunk.start, chunk.end), at);
    at += chunk.end - chunk.start;
  }
  return out;
}
