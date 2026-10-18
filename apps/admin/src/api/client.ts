// Typed client of the admin API (ADR 0027). Types come from its own OpenAPI document: pnpm --filter @tohe/admin generate:api
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.gen.ts';

type Schemas = components['schemas'];
export type AdminMe = Schemas['AdminMeView'];
export type AdminOverview = Schemas['AdminOverview'];
export type AdminGame = Schemas['AdminGame'];
export type AdminSystem = Schemas['AdminSystem'];
export type WorkerStatus = Schemas['WorkerStatus'];
export type TelemetryReport = Schemas['TelemetryReport'];
export type GameHealth = Schemas['GameHealth'];
export type AuditEntry = Schemas['AuditEntryView'];
export type AuditPage = Schemas['AuditPage'];
export type TwoFactorView = Schemas['TwoFactorView'];
export type AccountSummary = Schemas['AccountSummary'];
export type AccountDetail = Schemas['AccountDetail'];
export type ProfileDetail = Schemas['ProfileDetail'];
export type SignInSettings = Schemas['SignInSettingsView'];
export type SignInMethod = Schemas['SignInMethodView'];
export type Community = Schemas['CommunityView'];
export type InviteCode = Schemas['InviteCodeView'];
export type ReviewEntry = Schemas['ReviewEntry'];
export type ReviewDetail = Schemas['ReviewDetail'];
export type ProfileCard = Schemas['ProfileCard'];
export type RunReplay = Schemas['RunReplay'];
/** What a person decides about a result (ADR 0029). */
export type ReviewDecision = 'approve' | 'reject' | 'reopen';

/** Same origin: the console is served at /admin/ by the hub's server, which proxies /api. */
const api = createClient<paths>({ baseUrl: '' });

/**
 * A response the API refused: 401 signed out, 403 `admin_required` without a role that may, `two_factor_required`
 * and `step_up_required` until a check passes. `fields` holds validation codes per field, e.g. `code_invalid`.
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

export const admin = {
  me: () => call(api.GET('/api/admin/me')),
  overview: () => call(api.GET('/api/admin/overview')),
  games: () => call(api.GET('/api/admin/games')),
  health: (days: number) => call(api.GET('/api/admin/health', { params: { query: { days } } })),
  system: () => call(api.GET('/api/admin/system')),
  audit: (before?: number) =>
    call(api.GET('/api/admin/audit', { params: { query: before === undefined ? {} : { before } } })),
  setup: () => call(api.GET('/api/admin/setup')),
  claimSetup: (token: string) => call(api.POST('/api/admin/setup/claim', { body: { token } })),
  twoFactor: () => call(api.GET('/api/admin/two-factor')),
  setUpAuthenticator: () => call(api.POST('/api/admin/two-factor/setup')),
  enableTwoFactor: (code: string) => call(api.POST('/api/admin/two-factor/enable', { body: { code } })),
  verifyTwoFactor: (proof: { code?: string; recoveryCode?: string }) =>
    call(
      api.POST('/api/admin/two-factor/verify', {
        body: { code: proof.code ?? null, recoveryCode: proof.recoveryCode ?? null },
      }),
    ),
  newRecoveryCodes: () => call(api.POST('/api/admin/two-factor/recovery-codes')),
  disableTwoFactor: () => call(api.DELETE('/api/admin/two-factor')),
  /** Found by `q`, or — with `deleting` — those whose owner asked to delete them, the soonest due first. */
  users: (q: string, deleting = false) =>
    call(
      api.GET('/api/admin/users', {
        params: { query: { ...(q ? { q } : {}), ...(deleting ? { deleting } : {}) } },
      }),
    ),
  user: (id: string) => call(api.GET('/api/admin/users/{id}', { params: { path: { id } } })),
  suspend: (id: string, reason: string) =>
    call(api.POST('/api/admin/users/{id}/suspend', { params: { path: { id } }, body: { reason } })),
  lift: (id: string) => call(api.DELETE('/api/admin/users/{id}/suspend', { params: { path: { id } } })),
  signOut: (id: string) => call(api.POST('/api/admin/users/{id}/sign-out', { params: { path: { id } } })),
  /** For good, once its owner asked and its seven days are over (ADR 0038). */
  deleteUser: (id: string) => call(api.POST('/api/admin/users/{id}/delete', { params: { path: { id } } })),
  setRole: (id: string, role: string | null) =>
    call(api.PUT('/api/admin/users/{id}/role', { params: { path: { id } }, body: { role } })),
  renameProfile: (id: string, name: string) =>
    call(api.PATCH('/api/admin/profiles/{id}', { params: { path: { id } }, body: { name } })),
  hideProfile: (id: string, reason: string) =>
    call(api.POST('/api/admin/profiles/{id}/hidden', { params: { path: { id } }, body: { reason } })),
  showProfile: (id: string) =>
    call(api.DELETE('/api/admin/profiles/{id}/hidden', { params: { path: { id } } })),
  /** Held results, oldest first; `after` is the last page's `next`. */
  held: (after?: number) =>
    call(api.GET('/api/admin/review', { params: { query: after === undefined ? {} : { after } } })),
  /** Results people decided about or the engine rejected, the latest first; `before` is the last page's `next`. */
  decided: (before?: number) =>
    call(api.GET('/api/admin/review/decided', { params: { query: before === undefined ? {} : { before } } })),
  reviewResult: (id: number) => call(api.GET('/api/admin/review/{id}', { params: { path: { id } } })),
  /** A ranked run's seed and moves, and the build that played it while the games origin serves it (ADR 0032). */
  reviewRun: (id: number) => call(api.GET('/api/admin/review/{id}/run', { params: { path: { id } } })),
  decide: (id: number, decision: ReviewDecision, note: string | null) => {
    const request = { params: { path: { id } }, body: { note } };
    return call(
      decision === 'approve'
        ? api.POST('/api/admin/review/{id}/approve', request)
        : decision === 'reject'
          ? api.POST('/api/admin/review/{id}/reject', request)
          : api.POST('/api/admin/review/{id}/reopen', request),
    );
  },
  signInSettings: () => call(api.GET('/api/admin/settings')),
  /** Only what is given changes: methods by id, the registration mode, the proof-of-work (ADR 0037). */
  saveSignInSettings: (change: {
    methods?: Record<string, boolean>;
    registration?: string;
    proofOfWork?: boolean;
  }) =>
    call(
      api.PUT('/api/admin/settings', {
        body: {
          methods: change.methods ?? null,
          registration: change.registration ?? null,
          proofOfWork: change.proofOfWork ?? null,
        },
      }),
    ),
  communities: () => call(api.GET('/api/admin/communities')),
  createCommunity: (name: string) => call(api.POST('/api/admin/communities', { body: { name } })),
  createInviteCode: (
    communityId: string,
    code: { code: string | null; expiresAt: string | null; maxUses: number | null },
  ) =>
    call(
      api.POST('/api/admin/communities/{id}/codes', { params: { path: { id: communityId } }, body: code }),
    ),
  revokeInviteCode: (code: string) =>
    call(api.DELETE('/api/admin/invite-codes/{code}', { params: { path: { code } } })),
};

/**
 * Step-up level 2 (ADR 0025) is the hub's, not the admin API's: the same endpoints, called by hand. What they answer
 * does not matter here; the console asks /api/admin/me again afterwards.
 */
export const stepUp = {
  password: (password: string) => send('/api/session/step-up', { password }),
  sendCode: async (): Promise<string> =>
    ((await send('/api/session/step-up/code')) as { attemptId: string }).attemptId,
  confirm: (attemptId: string, code: string) => send('/api/session/step-up/confirm', { attemptId, code }),
};

async function send(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await refusal(response);
  return response.status === 204 ? null : response.json();
}
