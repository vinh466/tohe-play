// The Studio's API, typed from its OpenAPI document (services/api/openapi/tohe-api_studio.json), and its refusals in
// words.
import createClient from 'openapi-fetch';
import type { components, paths } from './api/schema.gen.ts';
import { type Problem, UsageError } from './errors.ts';
import type { Settings } from './settings.ts';

export type StyleView = components['schemas']['StyleView'];
export type PackView = components['schemas']['PackView'];
export type PackVersionView = components['schemas']['PackVersionView'];
export type AssetInput = components['schemas']['AssetInput'];
export type StudioUploadView = components['schemas']['StudioUploadView'];
export type StudioCheckReport = components['schemas']['StudioCheckReport'];
export type StudioCheckProblem = components['schemas']['StudioCheckProblem'];

/** The checks' problems in the CLI's shape: the server's `asset` becomes `assetId`. */
export const fromReport = (problems: readonly StudioCheckProblem[]): Problem[] =>
  problems.map((problem) => ({
    code: problem.code,
    message: problem.message,
    assetId: problem.asset ?? null,
  }));

export type StudioClient = ReturnType<typeof createClient<paths>>;

/** A client that sends the agent token as a bearer; a server it cannot reach is a configuration error. */
export function studioClient(settings: Settings, fetchImpl: typeof fetch = globalThis.fetch): StudioClient {
  return createClient<paths>({
    baseUrl: settings.url,
    headers: { Authorization: `Bearer ${settings.token}` },
    fetch: async (request) => {
      try {
        return await fetchImpl(request);
      } catch (error) {
        const cause = (error as Error & { cause?: Error }).cause?.message ?? (error as Error).message;
        throw new UsageError(
          `cannot reach the Studio at ${settings.url} (${cause}): is TOHE_STUDIO_URL right?`,
        );
      }
    },
  });
}

/** What the API answers when it refuses: RFC 9457 with a `code`, field errors, or the checks' problems. */
interface ProblemBody {
  title?: string | null;
  code?: string;
  errors?: Record<string, string[]>;
  /** `422 checks_failed`: the report's problems (docs/architecture/asset-studio.md#checks). */
  problems?: StudioCheckProblem[];
  assets?: string[];
  maxBytes?: number;
}

const WHY: Record<number, string> = {
  401: 'the token is refused (unknown, expired or revoked): ask the owner for a new one',
  403: 'the token may not do this',
  503: 'the Studio has no storage on this server',
};

/**
 * The refusal as problems, each naming its asset when it is about one. `assetIds` are the ids in the order the
 * request sent them, so `assets[3].licence` names its asset.
 */
export function describeRefusal(status: number, body: unknown, assetIds: readonly string[] = []): Problem[] {
  const problem = (typeof body === 'object' && body !== null ? body : {}) as ProblemBody;
  if (Array.isArray(problem.problems) && problem.problems.length > 0) return fromReport(problem.problems);
  if (problem.errors && Object.keys(problem.errors).length > 0)
    return Object.entries(problem.errors).flatMap(([field, codes]) => {
      const index = /^assets\[(\d+)\]\.?(.*)$/.exec(field);
      const assetId = index ? (assetIds[Number(index[1])] ?? null) : null;
      const name = index ? index[2] || 'asset' : field;
      return codes.map((code) => ({ code, message: `${name} is not accepted`, assetId }));
    });
  if (problem.code === 'files_missing' && problem.assets)
    return problem.assets.map((assetId) => ({
      code: 'files_missing',
      message: 'its file is not uploaded',
      assetId,
    }));
  const code = problem.code ?? `http_${status}`;
  const extra = problem.maxBytes ? ` (at most ${problem.maxBytes} bytes)` : '';
  const said = problem.title ? `${problem.title}${extra}` : null;
  const why = WHY[status];
  const message =
    said && why && status === 401 ? `${said}: ${why}` : (said ?? why ?? `the server answered ${status}`);
  return [{ code, message }];
}
