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

/** Same origin: the console is served at /admin/ by the hub's server, which proxies /api. */
const api = createClient<paths>({ baseUrl: '' });

/** A response the API refused: 401 signed out, 403 `admin_required` without a role that may. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`API ${status}${code ? ` ${code}` : ''}`);
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
  const problem = (error ?? {}) as { code?: unknown };
  throw new ApiError(response.status, typeof problem.code === 'string' ? problem.code : null);
}

export const admin = {
  me: () => call(api.GET('/api/admin/me')),
  overview: () => call(api.GET('/api/admin/overview')),
  games: () => call(api.GET('/api/admin/games')),
  health: (days: number) => call(api.GET('/api/admin/health', { params: { query: { days } } })),
  system: () => call(api.GET('/api/admin/system')),
};
