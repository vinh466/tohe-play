// A registry served by a tiny HTTP server in the test, and a game's folder, both in a temporary folder.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GameAssets } from '@tohe/contract';
import type { PackManifest } from '../src/manifest.ts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export interface FixtureFile {
  id: string;
  kind: PackManifest['files'][number]['kind'];
  ext: string;
  content: string;
  licence: string;
  attribution?: string;
  width?: number;
  height?: number;
  frames?: { width: number; height: number; count: number };
}

export interface FixtureRegistry {
  url: string;
  /** Every path requested, in order. */
  requests: string[];
  /** Paths the server answers with this status instead of their content. */
  failures: Map<string, number>;
  /** Paths the server answers with these bytes instead of their content. */
  overrides: Map<string, Buffer>;
  /** A pack version's manifest, as served, and its sha256. */
  manifest(id: string, version: string): { bytes: Buffer; sha256: string };
  /** A file's sha256 and its path in the registry. */
  file(
    id: string,
    version: string,
    assetId: string,
  ): { sha256: string; ext: string; path: string; bytes: Buffer };
  close(): Promise<void>;
}

/** Serves `packs/<id>/<version>.json` and `blobs/sha256/<sha256>.<ext>` for the packs given. */
export async function startRegistry(
  packs: Record<string, Record<string, FixtureFile[]>>,
): Promise<FixtureRegistry> {
  const content = new Map<string, Buffer>();
  const manifests = new Map<string, { bytes: Buffer; sha256: string }>();
  const files = new Map<string, { sha256: string; ext: string; path: string; bytes: Buffer }>();
  for (const [id, versions] of Object.entries(packs)) {
    for (const [version, list] of Object.entries(versions)) {
      const manifest: PackManifest = {
        manifestVersion: 1,
        id,
        version,
        files: list.map((file) => {
          const bytes = Buffer.from(file.content);
          const hash = sha256(bytes);
          const path = `/blobs/sha256/${hash}.${file.ext}`;
          content.set(path, bytes);
          files.set(`${id}@${version}/${file.id}`, { sha256: hash, ext: file.ext, path, bytes });
          const { content: _, ...rest } = file;
          return { ...rest, sha256: hash, bytes: bytes.length };
        }),
      };
      const bytes = Buffer.from(JSON.stringify(manifest));
      content.set(`/packs/${id}/${version}.json`, bytes);
      manifests.set(`${id}@${version}`, { bytes, sha256: sha256(bytes) });
    }
  }
  const requests: string[] = [];
  const failures = new Map<string, number>();
  const overrides = new Map<string, Buffer>();
  const server: Server = createServer((request, response) => {
    const path = request.url ?? '/';
    requests.push(path);
    const failure = failures.get(path);
    const body = overrides.get(path) ?? content.get(path);
    if (failure !== undefined || !body) {
      response.writeHead(failure ?? 404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    failures,
    overrides,
    manifest: (id, version) => {
      const found = manifests.get(`${id}@${version}`);
      if (!found) throw new Error(`no manifest ${id}@${version}`);
      return found;
    },
    file: (id, version, assetId) => {
      const found = files.get(`${id}@${version}/${assetId}`);
      if (!found) throw new Error(`no file ${id}@${version}/${assetId}`);
      return found;
    },
    close: () =>
      new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

export interface FixtureWorkspace {
  root: string;
  game: string;
  cache: string;
  /** Writes the game's public/game.json with these assets (none when undefined). */
  declare(assets: GameAssets | undefined): void;
  cleanup(): void;
}

/** A temporary folder with a game (package.json, public/game.json, index.html, src/main.ts) and an empty cache. */
export function makeWorkspace(): FixtureWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'tohe-assets-'));
  const game = join(root, 'game');
  const cache = join(root, 'cache', 'tohe', 'assets', 'sha256');
  mkdirSync(join(game, 'public'), { recursive: true });
  mkdirSync(join(game, 'src'), { recursive: true });
  writeFileSync(
    join(game, 'package.json'),
    JSON.stringify({ name: 'fixture-game', private: true, type: 'module' }),
  );
  writeFileSync(
    join(game, 'index.html'),
    '<!doctype html><html><head><title>Fixture</title></head><body><script type="module" src="./src/main.ts"></script></body></html>\n',
  );
  writeFileSync(join(game, 'src', 'main.ts'), 'document.title = "fixture";\n');
  const declare = (assets: GameAssets | undefined) =>
    writeFileSync(
      join(game, 'public', 'game.json'),
      JSON.stringify({ id: 'fixture-game', version: '1.0.0', ...(assets ? { assets } : {}) }, null, 2),
    );
  declare(undefined);
  return { root, game, cache, declare, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
