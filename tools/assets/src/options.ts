// What every command of the tool reads from its environment, and the one kind of error it reports.
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The registry's base URL: the Studio's public storage (no default until the production bucket exists). */
export const REGISTRY_ENV = 'TOHE_ASSETS_REGISTRY';
/** `1`: never fetch; a file missing from the cache fails, named. */
export const OFFLINE_ENV = 'TOHE_ASSETS_OFFLINE';

export interface AssetsOptions {
  /** The registry's base URL; default `$TOHE_ASSETS_REGISTRY`. Needed only when something must be fetched. */
  registry?: string;
  /** The cache of files by hash; default `$XDG_CACHE_HOME/tohe/assets/sha256`, else `~/.cache/tohe/assets/sha256`. */
  cacheDir?: string;
  /** Never fetch; default `$TOHE_ASSETS_OFFLINE` is `1`. */
  offline?: boolean;
}

export interface ResolvedOptions {
  registry: string | undefined;
  cacheDir: string;
  offline: boolean;
}

/** A problem the tool reports to a person, in words: the CLI prints it, the Vite plugin fails the build with it. */
export class AssetsError extends Error {
  override name = 'AssetsError';
}

/** The default cache folder, shared by every worktree on the machine. */
export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CACHE_HOME ? env.XDG_CACHE_HOME : join(homedir(), '.cache');
  return join(base, 'tohe', 'assets', 'sha256');
}

export function resolveOptions(
  options: AssetsOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedOptions {
  return {
    registry: options.registry ?? (env[REGISTRY_ENV] || undefined),
    cacheDir: options.cacheDir ?? defaultCacheDir(env),
    offline: options.offline ?? env[OFFLINE_ENV] === '1',
  };
}

/** The registry's base URL without a trailing slash; fails naming the variable when it is unset. */
export function registryBase(options: ResolvedOptions, why: string): string {
  if (!options.registry)
    throw new AssetsError(`${why}, so the registry is needed: set ${REGISTRY_ENV} to its base URL`);
  return options.registry.replace(/\/+$/, '');
}
