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
export type DeviceProfileData = Schemas['DeviceProfileData'];
export type DeviceProfileUpload = Schemas['DeviceProfileUpload'];
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
export type DeviceProfileRegistration = Schemas['DeviceProfileRegistration'];
export type DeviceProfileView = Schemas['DeviceProfileView'];
export type TransferCodeView = Schemas['TransferCodeView'];
export type TransferStatusView = Schemas['TransferStatusView'];
export type TransferRedemption = Schemas['TransferRedemption'];
export type TransferView = Schemas['TransferView'];
export type ProfileMoveView = Schemas['ProfileMoveView'];
export type LinkIntent = Schemas['LinkIntent'];
export type ShareLinkView = Schemas['ShareLinkView'];
export type MakeLinkRequest = Schemas['MakeLinkRequest'];

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
    /** With `name_refused`: the name rule that refused it (`name_reserved`, `name_inappropriate`…). */
    readonly reason: string | null = null,
    /** With `level_required`: the level a share link asks for (ADR 0044). */
    readonly level: string | null = null,
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
  const problem = (error ?? {}) as {
    code?: unknown;
    errors?: unknown;
    triesLeft?: unknown;
    reason?: unknown;
    level?: unknown;
  };
  throw new ApiError(
    response.status,
    typeof problem.code === 'string' ? problem.code : null,
    typeof problem.errors === 'object' && problem.errors !== null
      ? (problem.errors as Record<string, string[]>)
      : {},
    typeof problem.triesLeft === 'number' ? problem.triesLeft : null,
    typeof problem.reason === 'string' ? problem.reason : null,
    typeof problem.level === 'string' ? problem.level : null,
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
  /**
   * `deviceProfile`: the device profile that started the sign-up, sent only from the device that started it (ADR 0043);
   * the API brings it in when it is the attempt's. `entryCode`: the share link this tab came from, counted once as an
   * account made from it (ADR 0044).
   */
  confirmRegistration: (
    attemptId: string,
    code: string,
    deviceProfile?: DeviceProfileUpload | null,
    entryCode: string | null = null,
  ) =>
    call(
      api.POST('/api/auth/register/confirm', {
        body: { attemptId, code, deviceProfile: deviceProfile ?? null, entryCode },
      }),
    ),
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
  /**
   * Where the browser goes — a full navigation, not a fetch. `link` adds the provider to the signed-in account;
   * `profile` names the device profile signing up, which travels in the provider's state (ADR 0043).
   */
  startUrl: (provider: string, options: { intent?: 'link'; profile?: string } = {}) => {
    const query = new URLSearchParams();
    if (options.intent) query.set('intent', options.intent);
    if (options.profile) query.set('profile', options.profile);
    const search = query.toString();
    return `/api/auth/external/${encodeURIComponent(provider)}${search ? `?${search}` : ''}`;
  },
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
  /**
   * `inviteCode`: needed when registration is by invite, welcome otherwise (ADR 0028). `deviceProfile`: the device
   * profile that started the sign-in with `profile` (ADR 0043). `entryCode`: the share link this tab came from (ADR 0044).
   */
  signUp: (
    displayName: string,
    termsVersion: string,
    inviteCode: string | null,
    deviceProfile: DeviceProfileUpload | null = null,
    entryCode: string | null = null,
  ) =>
    call(
      api.POST('/api/auth/external/pending/signup', {
        body: { displayName, acceptTerms: true, termsVersion, inviteCode, deviceProfile, entryCode },
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
  /** A device profile comes in with its id, saves and scores (ADR 0043): `id_taken`, `name_refused`. */
  adoptProfile: (body: DeviceProfileUpload) => call(api.POST('/api/profiles/adopt', { body })),
  /**
   * A device profile's saves and scores go up under one of the account's profiles; its name joins the history. Its copy
   * on the server, if this device has one (`deviceProfileId`), moves there too and is deleted (ADR 0043).
   */
  mergeProfile: (id: string, name: string, data: DeviceProfileData, deviceProfileId: string | null = null) =>
    call(
      api.POST('/api/profiles/{id}/merge', {
        params: { path: { id } },
        body: { name, data, deviceProfileId },
      }),
    ),
  updateProfile: (id: string, body: UpdateProfileRequest) =>
    call(api.PATCH('/api/profiles/{id}', { params: { path: { id } }, body })),
  /** For good, with everything of the profile (ADR 0034). */
  deleteProfile: (id: string) => call(api.DELETE('/api/profiles/{id}', { params: { path: { id } } })),
  /**
   * Within step-up level 2 (ADR 0034): every session ends, this one too, and the account goes for good after seven
   * days unless someone signs in to it.
   */
  deleteAccount: () => call(api.DELETE('/api/account')),
  /**
   * The authenticator the console's sign-in asks for (ADR 0027, 0042), for an account with a platform role: whether it
   * is on, a new key (step-up level 2), and its first code turns it on and gives the recovery codes once.
   */
  twoFactor: () => call(api.GET('/api/account/two-factor')),
  setUpAuthenticator: () => call(api.POST('/api/account/two-factor/setup')),
  enableTwoFactor: (code: string) => call(api.POST('/api/account/two-factor/enable', { body: { code } })),
};

/**
 * Device profiles on the server (ADR 0043): this device's key — a cookie the API sets — and the copies of its device
 * profiles, made the first time one sits at a table.
 */
export const devices = {
  /** The device's key; a device that has one keeps it. */
  start: () => call(api.POST('/api/devices')),
  /** Makes, or brings up to date, a device profile's server copy with the terms its player accepted. */
  register: (body: DeviceProfileRegistration) => call(api.POST('/api/devices/profiles', { body })),
  /** Deletes a device profile's server copy for good (ADR 0034); its seats read "Người chơi đã xoá". */
  remove: (id: string) => call(api.DELETE('/api/devices/profiles/{id}', { params: { path: { id } } })),
  /** This device's profiles that moved to another device with a transfer code (ADR 0043, I2b). */
  moves: () => call(api.GET('/api/devices/moves')),
};

/**
 * The transfer code (ADR 0043, I2b): a device profile on the server moves to another device — at once with the QR
 * code's secret, or with six digits the old device confirms. docs/architecture/identity.md#the-transfer-code
 */
export const transfers = {
  /** A code for this device's profile, carrying its saves and scores; replaces any before. */
  start: (id: string, body: Schemas['TransferStart']) =>
    call(api.POST('/api/devices/profiles/{id}/transfer', { params: { path: { id } }, body })),
  /** The profile's live code, as the old device polls it: `open`, or `asked`. */
  status: (id: string) => call(api.GET('/api/devices/profiles/{id}/transfer', { params: { path: { id } } })),
  /** The old device's answer to six typed digits. */
  confirm: (id: string, accept: boolean) =>
    call(
      api.POST('/api/devices/profiles/{id}/transfer/confirm', { params: { path: { id } }, body: { accept } }),
    ),
  /** The player left the code's screen. */
  cancel: (id: string) =>
    call(api.DELETE('/api/devices/profiles/{id}/transfer', { params: { path: { id } } })),
  /** The new device redeems the secret, or the six digits. */
  redeem: (body: TransferRedemption) => call(api.POST('/api/devices/transfers/redeem', { body })),
  /** A transfer this device redeemed: asked, done, declined, full or expired. */
  get: (id: string) => call(api.GET('/api/devices/transfers/{id}', { params: { path: { id } } })),
  /** This device's redeemed transfers, newest first: a lost answer is found here. */
  list: () => call(api.GET('/api/devices/transfers')),
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

/**
 * Share links (ADR 0044): the acting profile makes, lists, changes and revokes its own — an account's with its session,
 * a device profile's with its device key (rooms/devicePlayer.ts names it). Anyone resolves one by its code.
 * docs/architecture/entry-links.md
 */
export const links = {
  /** A `game` link to a game's menu; a `named` feature. */
  make: (body: MakeLinkRequest) => call(api.POST('/api/links', { body })),
  /** The acting profile's links, newest first, with their state and counts. */
  mine: () => call(api.GET('/api/links/mine')),
  /** A new expiry, from now: 1 to 2160 hours. */
  change: (code: string, expiresInHours: number) =>
    call(api.PATCH('/api/links/{code}', { params: { path: { code } }, body: { expiresInHours } })),
  revoke: (code: string) => call(api.POST('/api/links/{code}/revoke', { params: { path: { code } } })),
  /** Resolves a code to a typed intent; counts it opened. */
  open: (code: string) => call(api.POST('/api/links/{code}/open', { params: { path: { code } } })),
  /** Resolves it to open the game: takes a use and counts it played — once per reached intent. */
  play: (code: string) => call(api.POST('/api/links/{code}/play', { params: { path: { code } } })),
};
