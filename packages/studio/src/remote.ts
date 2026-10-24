// What talks to the Studio: styles, the draft a working folder becomes, its files, submitting, and a version's status.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AssetInput,
  describeRefusal,
  fromReport,
  type PackVersionView,
  type StudioClient,
  type StudioUploadView,
  type StyleView,
} from './api.ts';
import { type Problem, Refused } from './errors.ts';
import { type FileFacts, fileFacts } from './files.ts';
import { assetPath, lintPack, type PackFile, readPack } from './pack.ts';

/**
 * Which server draft a working folder became, per server: `{ "<url>": { "versionId", "version", "stripped" } }`.
 * `stripped` maps the sha256 of a file here to the sha256 and size the server kept after stripping its metadata.
 */
export const DRAFT_FILE = '.studio-draft.json';

/** A file as the server kept it, its metadata stripped. */
interface KeptFile {
  sha256: string;
  bytes: number;
}

interface DraftRecord {
  versionId: string;
  version: string;
  /** The local sha256 → the file as the server kept it; only files the server stripped. */
  stripped?: Record<string, KeptFile>;
}

type DraftRecords = Record<string, DraftRecord>;

function readDrafts(dir: string): DraftRecords {
  const path = join(dir, DRAFT_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as DraftRecords;
  } catch {
    return {};
  }
}

function writeDraft(dir: string, url: string, record: DraftRecord | null): void {
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
  /** Files uploaded this time that the server kept with their metadata stripped: the first asset naming each. */
  stripped: { assetId: string; sha256: string }[];
  problems: Problem[];
}

/** The working folder's files: each asset's content and sha256, read once. */
interface LocalFile {
  content: Buffer;
  facts: FileFacts;
}

function readFiles(dir: string, pack: PackFile): Map<string, LocalFile> {
  return new Map(
    pack.assets.map((asset) => {
      const content = readFileSync(assetPath(dir, asset.file));
      return [asset.id, { content, facts: fileFacts(asset.file, content) }];
    }),
  );
}

/**
 * pack.json's assets as the API takes them, each with its file's sha256, size and extension — the sha256 and size the
 * server kept when it stripped the file's metadata.
 */
function assetInputs(
  pack: PackFile,
  files: Map<string, LocalFile>,
  stripped: Record<string, KeptFile>,
): AssetInput[] {
  return pack.assets.map((asset) => {
    const { facts } = files.get(asset.id) as LocalFile;
    const kept = stripped[facts.sha256];
    return {
      id: asset.id,
      kind: asset.kind,
      sha256: kept?.sha256 ?? facts.sha256,
      ext: facts.ext,
      bytes: kept?.bytes ?? facts.bytes,
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

/** The files of a draft's assets the server does not have, though their sha256 is one it kept after stripping. */
const lostKept = (version: PackVersionView, stripped: Record<string, KeptFile>) => {
  const kept = new Set(Object.values(stripped).map((file) => file.sha256));
  return version.assets.some((view) => !view.uploaded && kept.has(view.sha256));
};

/**
 * Makes the server's draft match the working folder — creating it, or replacing the one this folder made before —
 * then uploads every file the server does not have yet. The server checks each file as it arrives, and keeps it with
 * its metadata stripped: a file it changed is named by the server's sha256 in the draft's later updates.
 */
export async function syncDraft(client: StudioClient, url: string, dir: string): Promise<DraftOutcome> {
  const pack = readPack(dir);
  const local = lintPack(dir, pack);
  const refused = (problems: Problem[]): DraftOutcome => ({
    pack,
    version: null,
    uploaded: 0,
    stripped: [],
    problems,
  });
  if (local.length > 0) return refused(local);
  const files = readFiles(dir, pack);
  const ids = pack.assets.map((asset) => asset.id);
  let version: PackVersionView | null = null;

  const known = readDrafts(dir)[url];
  // Only the files still here: one changed since is a new file.
  const shas = new Set([...files.values()].map((file) => file.facts.sha256));
  let stripped: Record<string, KeptFile> = Object.fromEntries(
    Object.entries(known?.stripped ?? {}).filter(([sha]) => shas.has(sha)),
  );
  if (known) {
    let { data, error, response } = await client.PUT('/api/studio/drafts/{versionId}', {
      params: { path: { versionId: known.versionId } },
      body: { version: pack.version, assets: assetInputs(pack, files, stripped) },
    });
    if (data && lostKept(data, stripped)) {
      // The server no longer has a file it stripped, and only it has the stripped bytes: send the files here again.
      stripped = {};
      ({ data, error, response } = await client.PUT('/api/studio/drafts/{versionId}', {
        params: { path: { versionId: known.versionId } },
        body: { version: pack.version, assets: assetInputs(pack, files, stripped) },
      }));
    }
    if (data) version = data;
    else if (codeOf(error) === 'not_a_draft' && known.version === pack.version)
      throw new Refused(
        `${pack.id}@${known.version} is no longer a draft (submitted or reviewed): tohe-studio status ${pack.id}@${known.version} shows it; a change is a new version in pack.json`,
      );
    else if (response.status === 404 || codeOf(error) === 'not_yours' || codeOf(error) === 'not_a_draft') {
      // It expired, names a draft of someone else, or was submitted and pack.json has a new version: a new draft.
      writeDraft(dir, url, null);
    } else return refused(describeRefusal(response.status, error, ids));
  }

  if (!version) {
    // A new draft has none of the files the server kept.
    stripped = {};
    const assets = assetInputs(pack, files, stripped);
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
      return refused(describeRefusal(response.status, error, ids));
    }
  }
  const record = (): DraftRecord => ({
    versionId: (version as PackVersionView).id,
    version: (version as PackVersionView).version,
    ...(Object.keys(stripped).length > 0 ? { stripped } : {}),
  });
  writeDraft(dir, url, record());

  const problems: Problem[] = [];
  const strippedNow: DraftOutcome['stripped'] = [];
  let uploaded = 0;
  const done = new Set<string>();
  for (const view of version.assets) {
    if (view.uploaded || done.has(view.sha256)) continue;
    done.add(view.sha256);
    const local = files.get(view.id);
    if (!local) continue;
    const { data, error, response } = await client.PUT('/api/studio/drafts/{versionId}/files/{sha256}', {
      params: { path: { versionId: version.id, sha256: view.sha256 } },
      // The body is the file itself, sent as it is; the generated type calls a stream a string.
      body: local.content as unknown as string,
      bodySerializer: (body: unknown) => body as BodyInit,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (response.ok) {
      uploaded++;
      const kept = data as StudioUploadView | undefined;
      if (kept && kept.sha256 !== view.sha256) {
        stripped[local.facts.sha256] = { sha256: kept.sha256, bytes: kept.bytes };
        strippedNow.push({ assetId: view.id, sha256: kept.sha256 });
      }
      continue;
    }
    for (const problem of describeRefusal(response.status, error))
      problems.push({ ...problem, assetId: problem.assetId ?? view.id });
  }
  if (strippedNow.length > 0) writeDraft(dir, url, record());
  return { pack, version, uploaded, stripped: strippedNow, problems };
}

/** The server's checks on the draft as it stands — what submitting would check — with nothing saved. */
export async function checkDraft(
  client: StudioClient,
  version: PackVersionView,
): Promise<{ ok: boolean; problems: Problem[] }> {
  const { data, error, response } = await client.POST('/api/studio/drafts/{versionId}/check', {
    params: { path: { versionId: version.id } },
  });
  if (data) return { ok: data.ok, problems: fromReport(data.problems) };
  return {
    ok: false,
    problems: describeRefusal(
      response.status,
      error,
      version.assets.map((asset) => asset.id),
    ),
  };
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
