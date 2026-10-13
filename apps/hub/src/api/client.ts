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

export const household = {
  rename: (name: string) => call(api.PATCH('/api/household', { body: { name } })),
  createInvite: () => call(api.POST('/api/household/invite')),
  revokeInvite: () => call(api.DELETE('/api/household/invite')),
  addProfile: (body: CreateProfileRequest) => call(api.POST('/api/household/profiles', { body })),
  updateProfile: (id: string, body: UpdateProfileRequest) =>
    call(api.PATCH('/api/household/profiles/{id}', { params: { path: { id } }, body })),
  deleteProfile: (id: string) =>
    call(api.DELETE('/api/household/profiles/{id}', { params: { path: { id } } })),
};
