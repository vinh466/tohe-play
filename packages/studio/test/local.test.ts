// The commands that work on the working folder alone: pack init, import, draw, prepare.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pngChunkTypes, pngSize } from '../src/files.ts';
import { assetIdFromPath } from '../src/import.ts';
import { lintPack, readPack, writePack } from '../src/pack.ts';
import { preparePicture } from '../src/prepare.ts';
import { cli, pixels, png, startFakeStudio, style, TOKEN, tempDir } from './helpers.ts';

const DRAW_SCRIPT = fileURLToPath(new URL('./fixtures/draw-squares.mjs', import.meta.url));

let work: ReturnType<typeof tempDir>;
let packDir: string;

beforeEach(async () => {
  work = tempDir();
  packDir = join(work.dir, 'farm');
  const started = await cli(
    ['pack', 'init', 'farm', '--id', 'farm-tiles', '--style', 'tohe-pixel', '--version', '1.0.0'],
    work.dir,
  );
  expect(started.code).toBe(0);
});
afterEach(() => work.remove());

/** A small zip shaped like a Kenney pack: single tiles, a tilemap, a licence. */
function fixtureZip(): Uint8Array {
  const red = png(16, 16, (context) => {
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 16, 16);
  });
  const green = png(16, 16, (context) => {
    context.fillStyle = '#00ff00';
    context.fillRect(2, 2, 12, 12);
  });
  return zipSync({
    'Tiles/tile_0000.png': red,
    'Tiles/tile_0001.png': green,
    'Tilemap/tilemap.png': red,
    'License.txt': new TextEncoder().encode('CC0'),
  });
}

describe('pack.json', () => {
  it('starts a pack with its id, version and style, and no asset', () => {
    expect(readPack(packDir)).toEqual({
      id: 'farm-tiles',
      version: '1.0.0',
      style: 'tohe-pixel',
      description: '',
      assets: [],
    });
  });

  it('refuses to start a pack twice, and a bad id or version, as usage errors', async () => {
    const again = await cli(
      ['pack', 'init', 'farm', '--id', 'farm-tiles', '--style', 'tohe-pixel', '--version', '1.0.0'],
      work.dir,
    );
    expect(again.code).toBe(2);
    expect(again.all).toContain('already exists');
    const badId = await cli(
      ['pack', 'init', 'x', '--id', 'Farm', '--style', 's-1', '--version', '1.0.0'],
      work.dir,
    );
    expect(badId.code).toBe(2);
    const badVersion = await cli(
      ['pack', 'init', 'y', '--id', 'farm', '--style', 's-1', '--version', '1.0'],
      work.dir,
    );
    expect(badVersion.code).toBe(2);
  });

  it('names what is wrong in a pack.json, field by field', () => {
    writeFileSync(
      join(packDir, 'pack.json'),
      JSON.stringify({ id: 'farm-tiles', version: 'one', style: 's' }),
    );
    expect(() => readPack(packDir)).toThrow(/version/);
  });

  it('finds a licence the Studio never accepts, a missing credit and a missing file before anything is sent', () => {
    mkdirSync(join(packDir, 'files'));
    writeFileSync(
      join(packDir, 'files', 'a.png'),
      png(1, 1, () => {}),
    );
    const source = { type: 'pack' as const, name: 'P', url: 'https://example.org/p', author: 'A' };
    const pack = readPack(packDir);
    writePack(packDir, {
      ...pack,
      assets: [
        {
          id: 'a',
          kind: 'image',
          file: 'files/a.png',
          tags: [],
          licence: 'CC-BY-NC-4.0',
          attribution: null,
          source,
        },
        {
          id: 'b',
          kind: 'image',
          file: 'files/a.png',
          tags: [],
          licence: 'CC-BY-4.0',
          attribution: null,
          source,
        },
        {
          id: 'c',
          kind: 'image',
          file: 'files/c.png',
          tags: [],
          licence: 'CC0-1.0',
          attribution: null,
          source,
        },
        { id: 'd', kind: 'image', file: '../d.png', tags: [], licence: 'CC0-1.0', attribution: null, source },
      ],
    });
    const problems = lintPack(packDir, readPack(packDir)).map(
      (problem) => `${problem.assetId} ${problem.code}`,
    );
    expect(problems).toEqual([
      'a licence_not_accepted',
      'b attribution_missing',
      'c file_missing',
      'd file_outside',
    ]);
  });

  it("refuses a source without the fields the server's source_incomplete check asks for", () => {
    const pack = readPack(packDir);
    const withSource = (source: unknown) =>
      writeFileSync(
        join(packDir, 'pack.json'),
        JSON.stringify({
          ...pack,
          assets: [
            {
              id: 'a',
              kind: 'image',
              file: 'a.png',
              tags: [],
              licence: 'CC0-1.0',
              attribution: null,
              source,
            },
          ],
        }),
      );
    const ai = {
      type: 'ai',
      vendor: 'v',
      model: 'm',
      prompt: 'a carrot',
      seed: 42,
      date: '2026-10-24',
    };
    withSource(ai);
    expect(readPack(packDir).assets[0]?.source).toEqual(ai);
    withSource({ ...ai, seed: 'abc', date: '2026-10-24T10:00:00Z' });
    expect(() => readPack(packDir)).not.toThrow();
    // `type` names the kind of source, as the server reads it; `kind` is not it.
    for (const source of [
      { kind: 'pack', name: 'P', url: 'https://example.org/p', author: 'A' },
      { type: 'pack', name: 'P', url: 'ftp://example.org/p', author: 'A' },
      { type: 'upload', by: ' ' },
      { type: 'code' },
      { ...ai, seed: undefined },
      { ...ai, date: 'yesterday' },
    ]) {
      withSource(source);
      expect(() => readPack(packDir), JSON.stringify(source)).toThrow(/assets\.0\.source/);
    }
  });
});

describe('import', () => {
  it('takes the tiles of a known source from its zip, with the source and licence filled in', async () => {
    writeFileSync(join(work.dir, 'tiny-farm.zip'), fixtureZip());
    const imported = await cli(['import', 'kenney-tiny-farm', 'farm', '--from', 'tiny-farm.zip'], work.dir);
    expect(imported.code).toBe(0);
    expect(imported.out.join('\n')).toContain('imported 2 asset(s) from Tiny Farm (CC0-1.0');
    const pack = readPack(packDir);
    expect(pack.assets.map((asset) => asset.id)).toEqual(['tiles/tile-0000', 'tiles/tile-0001']);
    expect(pack.assets[0]).toEqual({
      id: 'tiles/tile-0000',
      kind: 'image',
      file: 'files/tiles/tile-0000.png',
      tags: ['farm', 'pixel'],
      licence: 'CC0-1.0',
      attribution: null,
      source: {
        type: 'pack',
        name: 'Tiny Farm',
        url: 'https://kenney.nl/assets/tiny-farm',
        author: 'Kenney (www.kenney.nl)',
        file: 'Tiles/tile_0000.png',
      },
    });
    expect(existsSync(join(packDir, 'files/tiles/tile-0001.png'))).toBe(true);
    expect(lintPack(packDir, pack)).toEqual([]);
  });

  it('takes a subset with --include, and downloads from a URL', async () => {
    const studio = await startFakeStudio();
    try {
      studio.files.set('/tiny-farm.zip', fixtureZip());
      const imported = await cli(
        [
          'import',
          'kenney-tiny-farm',
          'farm',
          '--from',
          `${studio.url}/tiny-farm.zip`,
          '--include',
          'Tilemap/*.png',
        ],
        work.dir,
      );
      expect(imported.code).toBe(0);
      expect(readPack(packDir).assets.map((asset) => asset.id)).toEqual(['tilemap/tilemap']);
    } finally {
      await studio.close();
    }
  });

  it('refuses an unknown source as a usage error, and an archive with nothing to take as a refusal', async () => {
    expect((await cli(['import', 'no-such-pack', 'farm'], work.dir)).code).toBe(2);
    writeFileSync(join(work.dir, 'tiny-farm.zip'), fixtureZip());
    const nothing = await cli(
      ['import', 'kenney-tiny-farm', 'farm', '--from', 'tiny-farm.zip', '--include', 'Nope/*.png'],
      work.dir,
    );
    expect(nothing.code).toBe(1);
    expect(nothing.all).toContain('no picture');
  });

  it('lists the known sources', async () => {
    const listed = await cli(['import', '--list'], work.dir);
    expect(listed.code).toBe(0);
    expect(listed.out.join('\n')).toContain('kenney-tiny-farm');
  });

  it('makes an asset id of an archive path', () => {
    expect(assetIdFromPath('Tiles/tile_0001.png')).toBe('tiles/tile-0001');
    expect(assetIdFromPath('Some Folder/Big  Tree (2).png')).toBe('some-folder/big-tree-2');
    expect(assetIdFromPath('___.png')).toBeNull();
  });
});

describe('draw', () => {
  it('keeps every picture the script saves, with the script as its source', async () => {
    const drawn = await cli(['draw', DRAW_SCRIPT, 'farm'], work.dir);
    expect(drawn.code).toBe(0);
    const pack = readPack(packDir);
    const script = readFileSync(DRAW_SCRIPT, 'utf8');
    expect(pack.assets.map((asset) => asset.id)).toEqual(['shapes/blink', 'shapes/square']);
    const [blink, square] = pack.assets;
    expect(square).toMatchObject({
      kind: 'image',
      file: 'files/shapes/square.png',
      tags: ['shape'],
      licence: 'LicenseRef-Tohe-Internal',
      source: { type: 'code', file: 'draw-squares.mjs', script },
    });
    expect(blink).toMatchObject({ kind: 'spritesheet', frames: { width: 8, height: 8, count: 2 } });
    const file = readFileSync(join(packDir, 'files/shapes/square.png'));
    expect(pngSize(file)).toEqual({ width: 16, height: 16 });
    expect(pngChunkTypes(file)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const { data } = await pixels(file);
    expect([...data.subarray((5 * 16 + 5) * 4, (5 * 16 + 5) * 4 + 4)]).toEqual([255, 0, 0, 255]);
  });

  it('refuses a script without a default function', async () => {
    const script = join(work.dir, 'empty.mjs');
    writeFileSync(script, 'export const nothing = 1;\n');
    const drawn = await cli(['draw', script, 'farm'], work.dir);
    expect(drawn.code).toBe(2);
    expect(drawn.all).toContain('default function');
  });
});

describe('prepare', () => {
  const palette = [
    [0, 0, 0],
    [255, 255, 255],
    [200, 40, 40],
  ] as const;

  it('snaps every opaque pixel to the nearest colour of the palette', async () => {
    const picture = png(2, 1, (context) => {
      context.fillStyle = '#d02020';
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = '#f0f0f0';
      context.fillRect(1, 0, 1, 1);
    });
    const prepared = await preparePicture(picture, { palette });
    expect(prepared.snapped).toBe(2);
    expect([...(await pixels(prepared.png)).data]).toEqual([200, 40, 40, 255, 255, 255, 255, 255]);
  });

  it('makes alpha 0 or 255', async () => {
    const picture = png(2, 1, (context) => {
      context.fillStyle = 'rgba(0, 0, 0, 0.8)';
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(255, 255, 255, 0.2)';
      context.fillRect(1, 0, 1, 1);
    });
    const prepared = await preparePicture(picture, { binaryAlpha: true });
    expect(prepared.alpha).toBe(2);
    const { data } = await pixels(prepared.png);
    expect([data[3], data[7]]).toEqual([255, 0]);
  });

  it('trims transparent borders', async () => {
    const picture = png(8, 8, (context) => {
      context.fillStyle = '#000000';
      context.fillRect(2, 3, 3, 2);
    });
    const prepared = await preparePicture(picture, { trim: true });
    expect(prepared.trimmedFrom).toEqual({ width: 8, height: 8 });
    expect(pngSize(prepared.png)).toEqual({ width: 3, height: 2 });
  });

  it('removes metadata and keeps a picture that needs nothing else as it is', async () => {
    const picture = png(2, 2, (context) => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 2, 2);
    });
    const withText = withChunk(picture, 'tEXt', 'Comment\0made by hand');
    expect(pngChunkTypes(withText)).toContain('tEXt');
    const prepared = await preparePicture(withText, {});
    expect(pngChunkTypes(prepared.png)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect([...(await pixels(prepared.png)).data]).toEqual([...(await pixels(picture)).data]);
  });

  it('prepares a pack in place, reports what changed, and does not trim a sprite sheet', async () => {
    expect((await cli(['draw', DRAW_SCRIPT, 'farm'], work.dir)).code).toBe(0);
    const prepared = await cli(['prepare', 'farm', '--binary-alpha', '--trim'], work.dir);
    expect(prepared.code).toBe(0);
    const out = prepared.out.join('\n');
    expect(out).toContain('shapes/square: trimmed from 16×16 to 8×8');
    expect(out).toContain('shapes/blink: not trimmed: a spritesheet keeps its grid');
    expect(pngSize(readFileSync(join(packDir, 'files/shapes/square.png')))).toEqual({ width: 8, height: 8 });
    const again = await cli(['prepare', 'farm', '--binary-alpha'], work.dir);
    expect(again.out.join('\n')).toContain('prepared 2 picture(s), 0 changed');
  });

  it("fetches the style's palette for --palette", async () => {
    const studio = await startFakeStudio();
    try {
      studio.styles.push(style('tohe-pixel', ['#000000', '#ffffff']));
      expect((await cli(['draw', DRAW_SCRIPT, 'farm'], work.dir)).code).toBe(0);
      const env = { TOHE_STUDIO_URL: studio.url, TOHE_STUDIO_TOKEN: TOKEN };
      const prepared = await cli(['prepare', 'farm', '--palette'], work.dir, env);
      expect(prepared.code).toBe(0);
      expect(prepared.out.join('\n')).toContain('moved to the palette');
      const { data } = await pixels(readFileSync(join(packDir, 'files/shapes/square.png')));
      for (let at = 0; at < data.length; at += 4)
        if (data[at + 3] === 255) expect([0, 255]).toContain(data[at]);
    } finally {
      await studio.close();
    }
  });
});

/** The PNG with one more chunk before IEND, its CRC right. */
function withChunk(picture: Uint8Array, type: string, text: string): Uint8Array {
  const data = new TextEncoder().encode(text);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  const iend = picture.length - 12;
  const out = new Uint8Array(picture.length + chunk.length);
  out.set(picture.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(picture.subarray(iend), iend + chunk.length);
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
