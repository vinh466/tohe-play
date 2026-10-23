// Test helpers: a working folder, captured output, tiny pictures and a fake Studio API that answers in the shape of
// services/api/openapi/tohe-api_studio.json.
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import type { components } from '../src/api/schema.gen.ts';
import { run } from '../src/run.ts';

type StyleView = components['schemas']['StyleView'];
type AssetInput = components['schemas']['AssetInput'];
type AssetView = components['schemas']['AssetView'];
type PackVersionView = components['schemas']['PackVersionView'];

export const TOKEN = 'tohe_at_c2VjcmV0LXRlc3QtdG9rZW4tbmV2ZXItcHJpbnRlZA';

export function tempDir(): { dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'tohe-studio-'));
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

export interface Captured {
  code: number;
  out: string[];
  err: string[];
  /** Every line, out and err. */
  all: string;
}

/** Runs the CLI in `cwd` with the environment given, and keeps what it printed. */
export async function cli(argv: string[], cwd: string, env: NodeJS.ProcessEnv = {}): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, {
    env,
    cwd,
    io: { out: (line) => out.push(line), err: (line) => err.push(line) },
  });
  return { code, out, err, all: [...out, ...err].join('\n') };
}

/** A PNG of `width`×`height` painted by `paint`. */
export function png(
  width: number,
  height: number,
  paint: (context: ReturnType<ReturnType<typeof createCanvas>['getContext']>) => void,
): Buffer {
  const canvas = createCanvas(width, height);
  paint(canvas.getContext('2d'));
  return canvas.toBuffer('image/png');
}

/** The RGBA of every pixel of a PNG. */
export async function pixels(
  content: Uint8Array,
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const { loadImage } = await import('@napi-rs/canvas');
  const image = await loadImage(Buffer.from(content));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: context.getImageData(0, 0, image.width, image.height).data,
  };
}

interface FakeVersion {
  id: string;
  packId: string;
  version: string;
  status: string;
  assets: AssetInput[];
  uploaded: Set<string>;
  reason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface FakeStudio {
  url: string;
  styles: StyleView[];
  versions: Map<string, FakeVersion>;
  packs: Map<string, { styleId: string; description: string | null }>;
  /** Every request: method and path. */
  requests: string[];
  /** Files uploaded: their sha256. */
  uploads: string[];
  /** The server's checks of an uploaded file: answer failures to refuse it with 422 checks_failed. */
  checkFile: (asset: AssetInput, content: Buffer) => { code: string; message: string; assetId?: string }[];
  /** Other files the server serves, e.g. a zip: path → bytes. */
  files: Map<string, Uint8Array>;
  /** The field errors of a draft's assets, as the API's 400 names them (`assets[1].tags`). */
  validateDraft: (assets: AssetInput[]) => Record<string, string[]>;
  reject(versionId: string, reason: string): void;
  close(): Promise<void>;
}

const now = () => new Date().toISOString();
const creator = { kind: 'agent', id: '00000000-0000-0000-0000-000000000001' };

export function style(id: string, palette: string[] | null, tileSize: number | null = 16): StyleView {
  return {
    id,
    name: `Style ${id}`,
    status: 'approved',
    tileSize,
    view: 'top-down',
    palette,
    outline: null,
    samples: [],
    createdBy: creator,
    createdAt: now(),
    updatedAt: now(),
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
  };
}

export async function startFakeStudio(token = TOKEN): Promise<FakeStudio> {
  const fake: Omit<FakeStudio, 'url' | 'close'> = {
    styles: [],
    versions: new Map(),
    packs: new Map(),
    requests: [],
    uploads: [],
    checkFile: () => [],
    files: new Map(),
    validateDraft: (assets) => {
      const errors: Record<string, string[]> = {};
      assets.forEach((asset, index) => {
        if (!/^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/.test(asset.licence ?? ''))
          errors[`assets[${index}].licence`] = ['licence_invalid'];
      });
      return errors;
    },
    reject(versionId, reason) {
      const version = fake.versions.get(versionId);
      if (!version) throw new Error(`no version ${versionId}`);
      version.status = 'rejected';
      version.reason = reason;
      version.reviewedAt = now();
    },
  };

  const view = (version: FakeVersion): PackVersionView => ({
    id: version.id,
    packId: version.packId,
    version: version.version,
    status: version.status,
    createdBy: creator,
    createdAt: now(),
    updatedAt: now(),
    submittedAt: version.submittedAt,
    reviewedBy: null,
    reviewedAt: version.reviewedAt,
    reason: version.reason,
    deprecatedAt: null,
    withdrawnAt: null,
    withdrawReason: null,
    manifestSha256: null,
    manifestUrl: null,
    shareAlikeAllowed: false,
    shareAlikeReason: null,
    assets: version.assets.map(
      (asset): AssetView => ({
        id: asset.id ?? '',
        kind: asset.kind ?? '',
        sha256: asset.sha256 ?? '',
        ext: asset.ext ?? '',
        bytes: asset.bytes ?? 0,
        width: asset.width,
        height: asset.height,
        frames: asset.frames,
        wang: null,
        tags: asset.tags ?? [],
        licence: asset.licence ?? '',
        attribution: asset.attribution,
        source: asset.source,
        uploaded: version.uploaded.has(asset.sha256 ?? ''),
        publicUrl: null,
      }),
    ),
  });

  const send = (response: ServerResponse, status: number, body?: unknown, type = 'application/json') => {
    response.writeHead(status, body === undefined ? {} : { 'Content-Type': type });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const problem = (response: ServerResponse, status: number, code: string, title: string, extra = {}) =>
    send(response, status, { title, status, code, ...extra }, 'application/problem+json');
  const body = async (request: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  };
  const validate = (assets: AssetInput[]) => fake.validateDraft(assets);

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://fake');
    const path = url.pathname;
    fake.requests.push(`${request.method} ${path}`);
    const served = fake.files.get(path);
    if (served) {
      response.writeHead(200, { 'Content-Type': 'application/zip' });
      response.end(served);
      return;
    }
    if (request.headers.authorization !== `Bearer ${token}`)
      return problem(response, 401, 'agent_token_invalid', 'The agent token is not valid');
    const parts = path.split('/').filter(Boolean).slice(2);
    const [area, id, sub, sha] = parts;
    try {
      if (request.method === 'GET' && area === 'styles' && !id) return send(response, 200, fake.styles);
      if (request.method === 'GET' && area === 'styles' && id === 'echo')
        // A careless server that repeats the request's header: the CLI must still not print the token.
        return problem(response, 500, 'boom', `failed for ${request.headers.authorization}`);
      if (request.method === 'GET' && area === 'styles' && id) {
        const found = fake.styles.find((candidate) => candidate.id === id);
        return found
          ? send(response, 200, found)
          : problem(response, 404, 'style_not_found', 'No style has this id');
      }
      if (request.method === 'GET' && area === 'packs' && id) {
        const pack = fake.packs.get(id);
        if (!pack) return problem(response, 404, 'pack_not_found', 'No pack has this id');
        const versions = [...fake.versions.values()]
          .filter((version) => version.packId === id)
          .map((version) => ({
            id: version.id,
            version: version.version,
            status: version.status,
            createdBy: creator,
            createdAt: now(),
            submittedAt: version.submittedAt,
            reviewedAt: version.reviewedAt,
          }));
        return send(response, 200, {
          id,
          styleId: pack.styleId,
          description: pack.description,
          createdBy: creator,
          createdAt: now(),
          versions,
        });
      }
      if (request.method === 'GET' && area === 'versions' && id && !sub) {
        const version = fake.versions.get(id);
        return version
          ? send(response, 200, view(version))
          : problem(response, 404, 'version_not_found', 'No pack version has this id');
      }
      if (request.method === 'POST' && area === 'drafts' && !id) {
        const draft = JSON.parse((await body(request)).toString('utf8'));
        const errors = validate(draft.assets ?? []);
        if (Object.keys(errors).length > 0)
          return send(response, 400, {
            title: 'One or more validation errors occurred.',
            status: 400,
            errors,
          });
        if (!fake.packs.has(draft.packId)) {
          if (!fake.styles.some((candidate) => candidate.id === draft.styleId))
            return problem(response, 404, 'style_not_found', 'No style has this id');
          fake.packs.set(draft.packId, { styleId: draft.styleId, description: draft.description });
        }
        const version: FakeVersion = {
          id: randomUUID(),
          packId: draft.packId,
          version: draft.version,
          status: 'draft',
          assets: draft.assets,
          uploaded: new Set(),
          reason: null,
          submittedAt: null,
          reviewedAt: null,
        };
        fake.versions.set(version.id, version);
        return send(response, 200, view(version));
      }
      if (request.method === 'PUT' && area === 'drafts' && id && !sub) {
        const version = fake.versions.get(id);
        if (!version) return problem(response, 404, 'version_not_found', 'No pack version has this id');
        if (version.status !== 'draft')
          return problem(response, 409, 'not_a_draft', 'This pack version is no longer a draft');
        const draft = JSON.parse((await body(request)).toString('utf8'));
        const errors = validate(draft.assets ?? []);
        if (Object.keys(errors).length > 0)
          return send(response, 400, {
            title: 'One or more validation errors occurred.',
            status: 400,
            errors,
          });
        version.version = draft.version;
        version.assets = draft.assets;
        return send(response, 200, view(version));
      }
      if (request.method === 'PUT' && area === 'drafts' && id && sub === 'files' && sha) {
        const version = fake.versions.get(id);
        if (!version) return problem(response, 404, 'version_not_found', 'No pack version has this id');
        const asset = version.assets.find((candidate) => candidate.sha256 === sha);
        if (!asset)
          return problem(response, 404, 'file_not_in_draft', 'No asset of this draft names this file');
        const content = await body(request);
        if (createHash('sha256').update(content).digest('hex') !== sha)
          return send(response, 400, {
            title: 'Bad file',
            status: 400,
            errors: { file: ['sha256_mismatch'] },
          });
        const failures = fake.checkFile(asset, content);
        if (failures.length > 0)
          return problem(response, 422, 'checks_failed', "The Studio's checks refused it", { failures });
        version.uploaded.add(sha);
        fake.uploads.push(sha);
        return send(response, 204);
      }
      if (request.method === 'POST' && area === 'drafts' && id && sub === 'submit') {
        const version = fake.versions.get(id);
        if (!version) return problem(response, 404, 'version_not_found', 'No pack version has this id');
        const missing = version.assets
          .filter((asset) => !version.uploaded.has(asset.sha256 ?? ''))
          .map((asset) => asset.id);
        if (missing.length > 0)
          return problem(response, 409, 'files_missing', 'Some files are not uploaded', { assets: missing });
        version.status = 'submitted';
        version.submittedAt = now();
        return send(response, 200, view(version));
      }
      return problem(response, 404, 'not_found', `no route ${request.method} ${path}`);
    } catch (error) {
      return problem(response, 500, 'error', (error as Error).message);
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  // The same object the server reads, so a test that sets checkFile changes what the server does.
  return Object.assign(fake, {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  });
}
