// Typed API client. Types come from the API's OpenAPI document: pnpm --filter @tohe/hub generate:api
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.gen.ts';

export type GameSummary = components['schemas']['GameSummary'];
export type ClientConfig = components['schemas']['ClientConfig'];

/** Same origin: the hub serves /api through its reverse proxy (Vite in dev, Caddy in docker/prod). */
export const api = createClient<paths>({ baseUrl: '' });

export async function fetchConfig(): Promise<ClientConfig> {
  const { data, error } = await api.GET('/api/config');
  if (!data) throw new Error(`GET /api/config failed: ${JSON.stringify(error)}`);
  return data;
}

export async function fetchGames(): Promise<GameSummary[]> {
  const { data, error } = await api.GET('/api/games');
  if (!data) throw new Error(`GET /api/games failed: ${JSON.stringify(error)}`);
  return data;
}
