// Typed API client. Types come from the API's OpenAPI document: pnpm --filter @tohe/hub generate:api
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.gen.ts';

type Schemas = components['schemas'];
export type GameSummary = Schemas['GameSummary'];
export type ClientConfig = Schemas['ClientConfig'];
export type MeView = Schemas['MeView'];
export type ProfileView = Schemas['ProfileView'];
export type ProfileOptionsView = Schemas['ProfileOptionsView'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type CreateProfileRequest = Schemas['CreateProfileRequest'];
export type UpdateProfileRequest = Schemas['UpdateProfileRequest'];
export type LeaderboardEntry = Schemas['LeaderboardEntry'];
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
 * docs/architecture/identity.md); `fields` holds validation codes per field.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly fields: Record<string, string[]> = {},
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
  const problem = (error ?? {}) as { code?: unknown; errors?: unknown };
  throw new ApiError(
    response.status,
    typeof problem.code === 'string' ? problem.code : null,
    typeof problem.errors === 'object' && problem.errors !== null
      ? (problem.errors as Record<string, string[]>)
      : {},
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

export const auth = {
  login: (username: string, password: string) =>
    call(api.POST('/api/auth/login', { body: { username, password } })),
  register: (body: RegisterRequest) => call(api.POST('/api/auth/register', { body })),
  logout: () => call(api.POST('/api/auth/logout')),
};

export const session = {
  selectProfile: (profileId: string, pin?: string) =>
    call(api.PUT('/api/session/profile', { body: { profileId, pin: pin ?? null } })),
  clearProfile: () => call(api.DELETE('/api/session/profile')),
  unlockParentGate: (password: string) => call(api.POST('/api/session/parent-gate', { body: { password } })),
  lockParentGate: () => call(api.DELETE('/api/session/parent-gate')),
};

/** The account and the profiles it owns (ADR 0023); every call needs the parent gate. */
export const account = {
  /** Technical telemetry from the account's devices (ADR 0015). */
  setTelemetry: (telemetry: boolean) => call(api.PATCH('/api/account', { body: { telemetry } })),
  addProfile: (body: CreateProfileRequest) => call(api.POST('/api/profiles', { body })),
  updateProfile: (id: string, body: UpdateProfileRequest) =>
    call(api.PATCH('/api/profiles/{id}', { params: { path: { id } }, body })),
  deleteProfile: (id: string) => call(api.DELETE('/api/profiles/{id}', { params: { path: { id } } })),
};

/** Saves and scores of the active profile (M2); the hub calls these from storage/sync.ts, never from games. */
export const progress = {
  listSaves: () => call(api.GET('/api/progress/saves')),
  putSave: (gameId: string, data: unknown) =>
    call(api.PUT('/api/progress/saves/{gameId}', { params: { path: { gameId } }, body: { data } })),
  recordScores: (scores: ScoreInput[]) => call(api.POST('/api/progress/scores', { body: { scores } })),
  leaderboard: (gameId: string) =>
    call(api.GET('/api/progress/leaderboard/{gameId}', { params: { path: { gameId } } })),
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
  /** Online results of a game: the profile's, and its household's board over the last 7 days. */
  stats: (game: string) => call(api.GET('/api/rooms/stats', { params: { query: { game } } })),
  history: (game: string) => call(api.GET('/api/rooms/history', { params: { query: { game } } })),
  /** Watch a table without a seat (when the host allows spectators). */
  watch: (id: string) => call(api.POST('/api/rooms/{id}/watch', { params: { path: { id } } })),
  /** Ask a member of the household to the table; it shows in their hub for 10 minutes. */
  invite: (id: string, profileId: string) =>
    call(api.POST('/api/rooms/{id}/invite', { params: { path: { id } }, body: { profileId } })),
  invites: () => call(api.GET('/api/rooms/invites')),
  replay: (id: string, hand: number) =>
    call(api.GET('/api/rooms/{id}/hands/{hand}', { params: { path: { id, hand } } })),
};
