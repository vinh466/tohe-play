// Typed client of the console's API (ADR 0027, 0042). Types come from its own OpenAPI document:
// pnpm --filter @tohe/hub generate:api (which writes both apps' types).
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.gen.ts';

type Schemas = components['schemas'];
export type AdminMe = Schemas['AdminMeView'];
export type ConsoleConfig = Schemas['ConsoleConfig'];
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
export type DeviceProfileDetail = Schemas['DeviceProfileDetail'];
export type SignInSettings = Schemas['SignInSettingsView'];
export type SignInMethod = Schemas['SignInMethodView'];
export type Community = Schemas['CommunityView'];
export type InviteCode = Schemas['InviteCodeView'];
export type ReviewEntry = Schemas['ReviewEntry'];
export type ReviewDetail = Schemas['ReviewDetail'];
export type ProfileCard = Schemas['ProfileCard'];
export type RunReplay = Schemas['RunReplay'];
export type AdminShareLink = Schemas['AdminShareLinkView'];
export type Agent = Schemas['AgentView'];
export type AgentToken = Schemas['AgentTokenView'];
export type AgentScope = Schemas['AgentScope'];
export type NewAgentToken = Schemas['NewAgentTokenView'];
export type StudioMember = Schemas['StudioMemberView'];
/** The roles of the Asset Studio (ADR 0051): not platform roles. */
export type StudioRole = 'contributor' | 'reviewer';
/** What a person decides about a result (ADR 0029). */
export type ReviewDecision = 'approve' | 'reject' | 'reopen';

/** Same origin: the console's host serves its page and proxies the API's console routes, /api/admin. */
const api = createClient<paths>({ baseUrl: '' });

/**
 * A response the API refused: 401 without a console session (or one that ended), 403 `admin_required` for a role that
 * may not, `step_up_required` until step-up passes. `fields` holds validation codes per field, e.g. `code_invalid`.
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
  config: () => call(api.GET('/api/admin/config')),
  /** The console's own sign-in: email, password, and a code from the authenticator or a recovery code. */
  signIn: (body: { email: string; password: string; code?: string; recoveryCode?: string }) =>
    call(
      api.POST('/api/admin/session', {
        body: { ...body, code: body.code ?? null, recoveryCode: body.recoveryCode ?? null },
      }),
    ),
  /** Ends the console's session only; the hub's stays. */
  endSession: () => call(api.DELETE('/api/admin/session')),
  /** Step-up level 2 in the console session: the password, or a code from the authenticator. */
  stepUp: (proof: { password?: string; code?: string }) =>
    call(
      api.POST('/api/admin/session/step-up', {
        body: { password: proof.password ?? null, code: proof.code ?? null },
      }),
    ),
  /** Who is signed in to the console; null when nobody is (204). */
  me: async (): Promise<AdminMe | null> => (await call(api.GET('/api/admin/me'))) ?? null,
  overview: () => call(api.GET('/api/admin/overview')),
  games: () => call(api.GET('/api/admin/games')),
  health: (days: number) => call(api.GET('/api/admin/health', { params: { query: { days } } })),
  system: () => call(api.GET('/api/admin/system')),
  audit: (before?: number) =>
    call(api.GET('/api/admin/audit', { params: { query: before === undefined ? {} : { before } } })),
  setup: () => call(api.GET('/api/admin/setup')),
  /** The setup token with the email and password of the account that becomes the owner; no session starts. */
  claimSetup: (body: { token: string; email: string; password: string }) =>
    call(api.POST('/api/admin/setup/claim', { body })),
  twoFactor: () => call(api.GET('/api/admin/two-factor')),
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
  /** Takes a profile — an account's or a device's — off every table it sits at or watches (ADR 0043). */
  withdrawProfile: (id: string) =>
    call(api.POST('/api/admin/profiles/{id}/withdraw', { params: { path: { id } } })),
  /** Device profiles on the server by name or id, the latest used first (ADR 0043). */
  deviceProfiles: (q: string) =>
    call(api.GET('/api/admin/device-profiles', { params: { query: q ? { q } : {} } })),
  renameDeviceProfile: (id: string, name: string) =>
    call(api.PATCH('/api/admin/device-profiles/{id}', { params: { path: { id } }, body: { name } })),
  /** A share link by its code, typed any way codes are read (ADR 0044). */
  shareLink: (code: string) => call(api.GET('/api/admin/links/{code}', { params: { path: { code } } })),
  revokeShareLink: (code: string) =>
    call(api.POST('/api/admin/links/{code}/revoke', { params: { path: { code } } })),
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
  /** Agents and their tokens (ADR 0052). */
  agents: () => call(api.GET('/api/admin/agents')),
  agentScopes: () => call(api.GET('/api/admin/agents/scopes')),
  createAgent: (name: string, note: string | null) =>
    call(api.POST('/api/admin/agents', { body: { name, note } })),
  disableAgent: (id: string) =>
    call(api.POST('/api/admin/agents/{id}/disable', { params: { path: { id } } })),
  /** The token is in this answer once, never again. */
  createAgentToken: (id: string, scopes: string[], days: number) =>
    call(api.POST('/api/admin/agents/{id}/tokens', { params: { path: { id } }, body: { scopes, days } })),
  revokeAgentToken: (id: string, tokenId: string) =>
    call(api.POST('/api/admin/agents/{id}/tokens/{tokenId}/revoke', { params: { path: { id, tokenId } } })),
  agentAudit: (id: string, before?: number) =>
    call(
      api.GET('/api/admin/agents/{id}/audit', {
        params: { path: { id }, query: before === undefined ? {} : { before } },
      }),
    ),
  /** Accounts with a studio role (ADR 0051), reviewers first. */
  studioMembers: () => call(api.GET('/api/admin/studio/members')),
  /** Gives a studio role — or changes it — to the account with this email, or this id. */
  grantStudioRole: (account: { email: string } | { accountId: string }, role: StudioRole) =>
    call(
      api.POST('/api/admin/studio/members', {
        body:
          'email' in account
            ? { email: account.email, accountId: null, role }
            : { email: null, accountId: account.accountId, role },
      }),
    ),
  /** Takes it away: the account's Studio session ends at its next request. */
  revokeStudioRole: (accountId: string) =>
    call(api.DELETE('/api/admin/studio/members/{accountId}', { params: { path: { accountId } } })),
};
