// What talks to the Studio: styles, the draft a working folder becomes, its files, submitting, and a version's status.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AssetInput,
  describeRefusal,
  type PackVersionView,
  type StudioClient,
  type StyleView,
} from './api.ts';
import { type Problem, Refused } from './errors.ts';
import { fileFacts } from './files.ts';
import { assetPath, lintPack, type PackFile, readPack } from './pack.ts';

/** Which server draft a working folder became, per server: `{ "<url>": { "versionId", "version" } }`. */
export const DRAFT_FILE = '.studio-draft.json';

type DraftRecords = Record<string, { versionId: string; version: string }>;

function readDrafts(dir: string): DraftRecords {
  const path = join(dir, DRAFT_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as DraftRecords;
  } catch {
    return {};
  }
}

function writeDraft(dir: string, url: string, record: { versionId: string; version: string } | null): void {
  const drafts = readDrafts(dir);
  if (record) drafts[url] = record;
  else delete drafts[url];
  writeFileSync(join(dir, DRAFT_FILE), `${JSON.stringify(drafts, null, 2)}\n`);
}

/** The code of a refusal, when it has one. */
const codeOf = (body: unknown) =>
  typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined;

// --------------------------------------------------------------------------------------------------------- styles

export async function listStyles(client: StudioClient): Promise<StyleView[]> {
  const { data, error, response } = await client.GET('/api/studio/styles');
  if (!data) throw refusal('reading the styles', response.status, error);
  return data;
}

export async function getStyle(client: StudioClient, id: string): Promise<StyleView> {
  const { data, error, response } = await client.GET('/api/studio/styles/{id}', { params: { path: { id } } });
  if (!data) throw refusal(`reading the style ${id}`, response.status, error);
  return data;
}

function refusal(what: string, status: number, body: unknown, assetIds: readonly string[] = []): Refused {
  const problems = describeRefusal(status, body, assetIds);
  return new Refused(
    `${what}: ${problems.map((problem) => `${problem.code} — ${problem.message}`).join('; ')}`,
  );
}

// ---------------------------------------------------------------------------------------------------------- drafts

/** Where a working folder stands on the server after `check` or `submit` sent it. */
export interface DraftOutcome {
  pack: PackFile;
  /** The version on the server; none when the pack was refused before or by the draft's request. */
  version: PackVersionView | null;
  /** Files uploaded this time. */
  uploaded: number;
  problems: Problem[];
}

/** pack.json's assets as the API takes them, each with its file's sha256, size and extension. */
function assetInputs(dir: string, pack: PackFile): AssetInput[] {
  return pack.assets.map((asset) => {
    const facts = fileFacts(asset.file, readFileSync(assetPath(dir, asset.file)));
    return {
      id: asset.id,
      kind: asset.kind,
      sha256: facts.sha256,
      ext: facts.ext,
      bytes: facts.bytes,
      width: facts.width,
      height: facts.height,
      frames: asset.frames ?? null,
      // Wang edges (ADR 0051 checks): not written by pack.json yet.
      wang: null,
      tags: asset.tags,
      licence: asset.licence,
      attribution: asset.attribution,
      source: asset.source,
    };
  });
}

/**
 * Makes the server's draft match the working folder — creating it, or replacing the one this folder made before —
 * then uploads every file the server does not have yet. The server checks each file as it arrives.
 */
export async function syncDraft(client: StudioClient, url: string, dir: string): Promise<DraftOutcome> {
  const pack = readPack(dir);
  const local = lintPack(dir, pack);
  if (local.length > 0) return { pack, version: null, uploaded: 0, problems: local };
  const assets = assetInputs(dir, pack);
  const ids = assets.map((asset) => asset.id ?? '');
  let version: PackVersionView | null = null;

  const known = readDrafts(dir)[url];
  if (known) {
    const { data, error, response } = await client.PUT('/api/studio/drafts/{versionId}', {
      params: { path: { versionId: known.versionId } },
      body: { version: pack.version, assets },
    });
    if (data) version = data;
    else if (codeOf(error) === 'not_a_draft' && known.version === pack.version)
      throw new Refused(
        `${pack.id}@${known.version} is no longer a draft (submitted or reviewed): tohe-studio status ${pack.id}@${known.version} shows it; a change is a new version in pack.json`,
      );
    else if (response.status === 404 || codeOf(error) === 'not_yours' || codeOf(error) === 'not_a_draft') {
      // It expired, names a draft of someone else, or was submitted and pack.json has a new version: a new draft.
      writeDraft(dir, url, null);
    } else
      return { pack, version: null, uploaded: 0, problems: describeRefusal(response.status, error, ids) };
  }

  if (!version) {
    for (let attempt = 0; ; attempt++) {
      const { data, error, response } = await client.POST('/api/studio/drafts', {
        body: {
          packId: pack.id,
          version: pack.version,
          styleId: pack.style,
          description: pack.description || null,
          assets,
        },
      });
      if (data) {
        version = data;
        break;
      }
      // Someone made the pack that moment: sending again lands in theirs.
      if (codeOf(error) === 'pack_exists' && attempt === 0) continue;
      return { pack, version: null, uploaded: 0, problems: describeRefusal(response.status, error, ids) };
    }
  }
  writeDraft(dir, url, { versionId: version.id, version: version.version });

  const problems: Problem[] = [];
  let uploaded = 0;
  const done = new Set<string>();
  for (const view of version.assets) {
    if (view.uploaded || done.has(view.sha256)) continue;
    done.add(view.sha256);
    const asset = pack.assets.find((candidate) => candidate.id === view.id);
    if (!asset) continue;
    const content = readFileSync(assetPath(dir, asset.file));
    const { error, response } = await client.PUT('/api/studio/drafts/{versionId}/files/{sha256}', {
      params: { path: { versionId: version.id, sha256: view.sha256 } },
      // The body is the file itself, sent as it is; the generated type calls a stream a string.
      body: content as unknown as string,
      bodySerializer: (body: unknown) => body as BodyInit,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (response.ok) {
      uploaded++;
      continue;
    }
    for (const problem of describeRefusal(response.status, error))
      problems.push({ ...problem, assetId: problem.assetId ?? view.id });
  }
  return { pack, version, uploaded, problems };
}

/** Submits the draft the working folder made; answers the version, or the problems that refused it. */
export async function submitDraft(
  client: StudioClient,
  version: PackVersionView,
): Promise<{ version: PackVersionView | null; problems: Problem[] }> {
  const { data, error, response } = await client.POST('/api/studio/drafts/{versionId}/submit', {
    params: { path: { versionId: version.id } },
  });
  if (data) return { version: data, problems: [] };
  return {
    version: null,
    problems: describeRefusal(
      response.status,
      error,
      version.assets.map((asset) => asset.id),
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------- status

export interface VersionStatus {
  id: string;
  version: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** Why it was rejected. */
  reason: string | null;
}

/** Every version of the pack with this number — two drafts may share one — and, when rejected, why. */
export async function versionStatus(
  client: StudioClient,
  packId: string,
  version: string,
): Promise<VersionStatus[]> {
  const { data, error, response } = await client.GET('/api/studio/packs/{id}', {
    params: { path: { id: packId } },
  });
  if (!data) throw refusal(`reading the pack ${packId}`, response.status, error);
  const found: VersionStatus[] = [];
  for (const summary of data.versions.filter((candidate) => candidate.version === version)) {
    let reason: string | null = null;
    if (summary.status === 'rejected') {
      const detail = await client.GET('/api/studio/versions/{versionId}', {
        params: { path: { versionId: summary.id } },
      });
      if (!detail.data) throw refusal(`reading ${packId}@${version}`, detail.response.status, detail.error);
      reason = detail.data.reason;
    }
    found.push({
      id: summary.id,
      version: summary.version,
      status: summary.status,
      submittedAt: summary.submittedAt,
      reviewedAt: summary.reviewedAt,
      reason,
    });
  }
  return found;
}
