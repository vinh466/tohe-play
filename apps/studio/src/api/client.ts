// Typed client of the Studio's API (ADR 0051). Types come from its own OpenAPI document:
// pnpm --filter @tohe/codegen api-types (which writes every app's types).
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.gen.ts';

type Schemas = components['schemas'];
export type StudioMe = Schemas['StudioMeView'];
export type StudioConfig = Schemas['StudioConfig'];
export type Pack = Schemas['PackView'];
export type PackVersionSummary = Schemas['PackVersionSummaryView'];
export type PackVersion = Schemas['PackVersionView'];
export type Asset = Schemas['AssetView'];
export type Style = Schemas['StyleView'];
export type StyleSample = Schemas['StyleSampleView'];
export type Creator = Schemas['StudioCreatorView'];

/** Same origin: the Studio's host serves its page and proxies the API's Studio routes, /api/studio. */
const api = createClient<paths>({ baseUrl: '' });

/**
 * A response the API refused: 401 without a Studio session (or one that ended), 403 `studio_required` for a role that
 * may not, 503 `studio_storage_not_configured` while the library has no storage. `fields` holds validation codes per
 * field, e.g. `code_invalid`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(`API ${status}${code ? ` ${code}` : ''}`);
  }

  /** The first problem with the request: its code, or the first field's. */
  get reason(): string | null {
    return this.code ?? Object.values(this.fields)[0]?.[0] ?? null;
  }
}

interface Outcome<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

async function call<T>(request: Promise<Outcome<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (response.ok) return data as T;
  throw await refusal(response, error);
}

async function refusal(response: Response, problem: unknown = undefined): Promise<ApiError> {
  const body = (problem ?? (await response.json().catch(() => ({})))) as { code?: unknown; errors?: unknown };
  return new ApiError(
    response.status,
    typeof body.code === 'string' ? body.code : null,
    typeof body.errors === 'object' && body.errors !== null ? (body.errors as Record<string, string[]>) : {},
  );
}

export const studio = {
  /** What the app needs before anyone signs in: the hub's address. */
  config: () => call(api.GET('/api/studio/config')),
  /**
   * The Studio's own sign-in: email and password, and a code from the authenticator — or a recovery code — when the
   * account has two-factor authentication on (a reviewer always has).
   */
  signIn: (body: { email: string; password: string; code?: string; recoveryCode?: string }) =>
    call(
      api.POST('/api/studio/session', {
        body: { ...body, code: body.code ?? null, recoveryCode: body.recoveryCode ?? null },
      }),
    ),
  /** Ends the Studio's session only; the hub's and the console's stay. */
  endSession: () => call(api.DELETE('/api/studio/session')),
  /** Who is signed in to the Studio; null when nobody is (204). */
  me: async (): Promise<StudioMe | null> => (await call(api.GET('/api/studio/session'))) ?? null,
  /** Every pack with its versions, newest first. */
  packs: () => call(api.GET('/api/studio/packs')),
  pack: (id: string) => call(api.GET('/api/studio/packs/{id}', { params: { path: { id } } })),
  /** A version with its assets, status and review. */
  version: (versionId: string) =>
    call(api.GET('/api/studio/versions/{versionId}', { params: { path: { versionId } } })),
  /** The styles, newest first. */
  styles: () => call(api.GET('/api/studio/styles')),
  style: (id: string) => call(api.GET('/api/studio/styles/{id}', { params: { path: { id } } })),
};

/** A file of a version, from the API with the Studio's cookie: from the drafts until approved, the library after. */
export const versionFileUrl = (versionId: string, sha256: string) =>
  `/api/studio/versions/${encodeURIComponent(versionId)}/files/${encodeURIComponent(sha256)}`;

/** A style's sample picture, from the API with the Studio's cookie. */
export const styleSampleUrl = (styleId: string, sha256: string) =>
  `/api/studio/styles/${encodeURIComponent(styleId)}/samples/${encodeURIComponent(sha256)}`;
