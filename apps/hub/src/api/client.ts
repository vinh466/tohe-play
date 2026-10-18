// Typed API client. Types come from the API's OpenAPI document: pnpm --filter @tohe/hub generate:api
import type { JsonValue } from '@tohe/game-sdk';
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.gen.ts';

type Schemas = components['schemas'];
export type GameSummary = Schemas['GameSummary'];
export type ClientConfig = Schemas['ClientConfig'];
export type MeView = Schemas['MeView'];
export type ProfileView = Schemas['ProfileView'];
export type ProfileCardView = Schemas['ProfileCardView'];
export type ProfileOptionsView = Schemas['ProfileOptionsView'];
export type SignUpRequest = Schemas['SignUpRequest'];
export type ProofOfWorkChallenge = Schemas['ProofOfWorkChallenge'];
export type ProofOfWorkSolution = Schemas['ProofOfWorkSolution'];
export type AttemptView = Schemas['AttemptView'];
export type PendingSignInView = Schemas['PendingSignInView'];
export type ExternalOutcome = Schemas['ExternalOutcome'];
export type ExternalProvider = Schemas['ExternalProvider'];
export type CreateProfileRequest = Schemas['CreateProfileRequest'];
export type UpdateProfileRequest = Schemas['UpdateProfileRequest'];
export type AccountBoardView = Schemas['AccountBoardView'];
export type BoardRow = Schemas['BoardRow'];
export type PublicBoardView = Schemas['PublicBoardView'];
export type PublicRow = Schemas['PublicRow'];
export type ScoreInput = Schemas['ScoreInput'];
export type RoomView = Schemas['RoomView'];
export type RoomSummary = Schemas['RoomSummary'];
export type SeatView = Schemas['SeatView'];
export type CreateRoomRequest = Schemas['CreateRoomRequest'];
export type UpdateRoomRequest = Schemas['UpdateRoomRequest'];
export type RoomStatsView = Schemas['RoomStatsView'];
export type HandSummary = Schemas['HandSummary'];
export type HandReplay = Schemas['HandReplay'];
export type RoomInvite = Schemas['RoomInvite'];

/** Same origin: the hub serves /api through its reverse proxy (Vite in dev, Caddy in docker/UAT). */
export const api = createClient<paths>({ baseUrl: '' });

/**
 * A response the API refused. `code` is the machine-readable reason from problem details (see
 * docs/architecture/identity.md); `fields` holds validation codes per field; `triesLeft` comes with a wrong code
 * from an email (ADR 0024).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly fields: Record<string, string[]> = {},
    readonly triesLeft: number | null = null,
  ) {
    super(`API ${status}${code ? ` ${code}` : ''}`);
  }

  /** First validation code for a field (field names are matched case-insensitively). */
  field(name: string): string | undefined {
    const key = Object.keys(this.fields).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? this.fields[key]?.[0] : undefined;
  }
}

interface Outcome<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Unwraps an openapi-fetch result: the data, or an ApiError. Network failures surface as TypeError. */
export async function call<T>(request: Promise<Outcome<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (response.ok) return data as T;
  const problem = (error ?? {}) as { code?: unknown; errors?: unknown; triesLeft?: unknown };
  throw new ApiError(
    response.status,
    typeof problem.code === 'string' ? problem.code : null,
    typeof problem.errors === 'object' && problem.errors !== null
      ? (problem.errors as Record<string, string[]>)
      : {},
    typeof problem.triesLeft === 'number' ? problem.triesLeft : null,
  );
}

export const fetchConfig = () => call(api.GET('/api/config'));
export const fetchGames = () => call(api.GET('/api/games'));
export const fetchProfileOptions = () => call(api.GET('/api/profiles/options'));

/** The device session, or null when nobody is signed in (the API answers 204 then). */
export async function fetchMe(): Promise<MeView | null> {
  const me: MeView | undefined = await call(api.GET('/api/auth/me'));
  return me ?? null;
}

/** Signing up, in and out by email (ADR 0024). Every code goes with the attempt it was sent for. */
export const auth = {
  /** `email` may be an old account's username, until it adds an email. */
  login: (email: string, password: string) =>
    call(api.POST('/api/auth/login', { body: { email, password } })),
  /** A code goes to the email; the account exists once it comes back. */
  register: (body: SignUpRequest) => call(api.POST('/api/auth/register', { body })),
  confirmRegistration: (attemptId: string, code: string) =>
    call(api.POST('/api/auth/register/confirm', { body: { attemptId, code } })),
  forgotPassword: (email: string, proof: ProofOfWorkSolution | null) =>
    call(api.POST('/api/auth/password/forgot', { body: { email, proof } })),
  /** A proof-of-work to solve first, when the config says `proofOfWork` (ADR 0037). */
  challenge: () => call(api.GET('/api/auth/challenge')),
  resetPassword: (attemptId: string, code: string, password: string) =>
    call(api.POST('/api/auth/password/reset', { body: { attemptId, code, password } })),
  logout: () => call(api.POST('/api/auth/logout')),
};

/**
 * Signing in with a provider (ADR 0026). The browser goes to the provider and back; a first sign-in then waits on this
 * browser for one more step: an address, a proof for the account that has it, or a name and the terms.
 */
export const external = {
  /** Where the browser goes — a full navigation, not a fetch. `link` adds the provider to the signed-in account. */
  startUrl: (provider: string, intent?: 'link') =>
    `/api/auth/external/${encodeURIComponent(provider)}${intent ? `?intent=${intent}` : ''}`,
  /** The step waiting on this browser, or null when nothing waits. */
  pending: async (): Promise<PendingSignInView | null> => {
    try {
      return await call(api.GET('/api/auth/external/pending'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  sendEmailCode: (email: string) => call(api.POST('/api/auth/external/pending/email', { body: { email } })),
  confirmEmail: (code: string) =>
    call(api.POST('/api/auth/external/pending/email/confirm', { body: { code } })),
  sendLinkCode: () => call(api.POST('/api/auth/external/pending/link-code')),
  link: (proof: { code?: string; password?: string }) =>
    call(
      api.POST('/api/auth/external/pending/link', {
        body: { code: proof.code ?? null, password: proof.password ?? null },
      }),
    ),
  /** `inviteCode`: needed when registration is by invite, welcome otherwise (ADR 0028). */
  signUp: (displayName: string, termsVersion: string, inviteCode: string | null) =>
    call(
      api.POST('/api/auth/external/pending/signup', {
        body: { displayName, acceptTerms: true, termsVersion, inviteCode },
      }),
    ),
  cancel: () => call(api.DELETE('/api/auth/external/pending')),
};

export const session = {
  selectProfile: (profileId: string, pin?: string) =>
    call(api.PUT('/api/session/profile', { body: { profileId, pin: pin ?? null } })),
  clearProfile: () => call(api.DELETE('/api/session/profile')),
  /** The manage PIN opens profile management on this device (step-up level 1, ADR 0025). */
  unlockParentGate: (pin: string) => call(api.POST('/api/session/parent-gate', { body: { pin } })),
  /** Closes both levels of step-up on this device. */
  lockParentGate: () => call(api.DELETE('/api/session/parent-gate')),
  /** Level 2 with the password: account security, and profile management with it. */
  stepUp: (password: string) => call(api.POST('/api/session/step-up', { body: { password } })),
  /** Level 2 without the password: a code to the account's email. */
  stepUpCode: () => call(api.POST('/api/session/step-up/code')),
  confirmStepUp: (attemptId: string, code: string) =>
    call(api.POST('/api/session/step-up/confirm', { body: { attemptId, code } })),
};

/**
 * The account and the profiles it owns (ADR 0023, 0024, 0025). Profiles change within step-up level 1; the email,
 * the password and the manage PIN within level 2.
 */
export const account = {
  /** A code goes to the new sign-in email. `password` when level 2 is not open on this device. */
  changeEmail: (email: string, password?: string) =>
    call(api.POST('/api/account/email', { body: { email, password: password ?? null } })),
  confirmEmailChange: (attemptId: string, code: string) =>
    call(api.POST('/api/account/email/confirm', { body: { attemptId, code } })),
  setManagePin: (pin: string) => call(api.PUT('/api/account/manage-pin', { body: { pin } })),
  /** Never the last way in (ADR 0026). */
  unlink: (provider: string) =>
    call(api.DELETE('/api/account/logins/{provider}', { params: { path: { provider } } })),
  setPassword: (password: string) => call(api.PUT('/api/account/password', { body: { password } })),
  /** The terms and privacy notice in the version the hub shows (legal/documents.tsx). */
  acceptTerms: (version: string) => call(api.POST('/api/account/terms', { body: { version } })),
  /** Technical telemetry from the account's devices (ADR 0015). */
  setTelemetry: (telemetry: boolean) => call(api.PATCH('/api/account', { body: { telemetry } })),
  addProfile: (body: CreateProfileRequest) => call(api.POST('/api/profiles', { body })),
  updateProfile: (id: string, body: UpdateProfileRequest) =>
    call(api.PATCH('/api/profiles/{id}', { params: { path: { id } }, body })),
  /** For good, with everything of the profile (ADR 0034). */
  deleteProfile: (id: string) => call(api.DELETE('/api/profiles/{id}', { params: { path: { id } } })),
  /**
   * Within step-up level 2 (ADR 0034): every session ends, this one too, and the account goes for good after seven
   * days unless someone signs in to it.
   */
  deleteAccount: () => call(api.DELETE('/api/account')),
};

/** Saves and scores of the active profile (M2); the hub calls these from storage/sync.ts, never from games. */
export const progress = {
  listSaves: () => call(api.GET('/api/progress/saves')),
  putSave: (gameId: string, data: unknown) =>
    call(api.PUT('/api/progress/saves/{gameId}', { params: { path: { gameId } }, body: { data } })),
  recordScores: (scores: ScoreInput[]) => call(api.POST('/api/progress/scores', { body: { scores } })),
};

/** Ranked runs (ADR 0030): the API deals the seed, then replays the moves the game hands in. */
export const runs = {
  start: (gameId: string) => call(api.POST('/api/runs', { body: { gameId } })),
  finish: (run: string, moves: JsonValue[], score: number) =>
    call(api.POST('/api/runs/{id}/finish', { params: { path: { id: run } }, body: { moves, score } })),
};

/** Boards read by trust (ADR 0029): the account's board of a game, this week or all time. */
export const boards = {
  account: (gameId: string, period: 'week' | 'all') =>
    call(api.GET('/api/boards/{gameId}', { params: { path: { gameId }, query: { period } } })),
  /** A community's board — the account's — or the server's: the first 50 and the viewer's place. */
  public: (gameId: string, scope: 'community' | 'server', period: 'week' | 'all') =>
    call(api.GET('/api/boards/{gameId}/public', { params: { path: { gameId }, query: { scope, period } } })),
};

/** Online rooms (ADR 0016): the lobby and the host's controls. What happens at the table goes through the hub. */
export const rooms = {
  list: (game: string) => call(api.GET('/api/rooms', { params: { query: { game } } })),
  mine: () => call(api.GET('/api/rooms/mine')),
  create: (body: CreateRoomRequest) => call(api.POST('/api/rooms', { body })),
  byCode: (code: string) => call(api.GET('/api/rooms/code/{code}', { params: { path: { code } } })),
  get: (id: string) => call(api.GET('/api/rooms/{id}', { params: { path: { id } } })),
  join: (id: string) => call(api.POST('/api/rooms/{id}/join', { params: { path: { id } } })),
  leave: (id: string) => call(api.POST('/api/rooms/{id}/leave', { params: { path: { id } } })),
  update: (id: string, body: UpdateRoomRequest) =>
    call(api.PATCH('/api/rooms/{id}', { params: { path: { id } }, body })),
  setSeat: (id: string, seat: number, bot: string | null) =>
    call(api.PUT('/api/rooms/{id}/seats/{seat}', { params: { path: { id, seat } }, body: { bot } })),
  start: (id: string) => call(api.POST('/api/rooms/{id}/start', { params: { path: { id } } })),
  /** Online results of a game: the profile's, and its account's board this week. */
  stats: (game: string) => call(api.GET('/api/rooms/stats', { params: { query: { game } } })),
  history: (game: string) => call(api.GET('/api/rooms/history', { params: { query: { game } } })),
  /** Watch a table without a seat (when the host allows spectators). */
  watch: (id: string) => call(api.POST('/api/rooms/{id}/watch', { params: { path: { id } } })),
  /**
   * Ask a profile to the table — one of the account's, or another account's as its owner allows (ADR 0033); it shows
   * in their hub for 10 minutes.
   */
  invite: (id: string, profileId: string) =>
    call(api.POST('/api/rooms/{id}/invite', { params: { path: { id } }, body: { profileId } })),
  /** The card of the profile with this public ID, to confirm before asking it (ADR 0033). */
  findProfile: (publicId: string) =>
    call(api.GET('/api/profiles/by-id/{publicId}', { params: { path: { publicId } } })),
  invites: () => call(api.GET('/api/rooms/invites')),
  replay: (id: string, hand: number) =>
    call(api.GET('/api/rooms/{id}/hands/{hand}', { params: { path: { id, hand } } })),
};
