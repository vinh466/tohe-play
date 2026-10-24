// What the CLI reads from its environment, and where it writes: every line goes through one sink that hides the token.
import { UsageError } from './errors.ts';

/**
 * The Studio's host, which serves `/api/studio`: `https://studio.toheplay.io.vn`, or `http://localhost:4722` in
 * development (until the Studio has a host of its own, the hub's, `http://localhost:4720`).
 */
export const URL_ENV = 'TOHE_STUDIO_URL';
/** An agent token holding `studio.draft` (`tohe_at_…`), given by the owner on the console's Agents page. */
export const TOKEN_ENV = 'TOHE_STUDIO_TOKEN';

const TOKEN_PREFIX = 'tohe_at_';

export interface Settings {
  /** The API's base URL, without a trailing slash. */
  url: string;
  token: string;
}

/** The URL and the token, or a usage error naming the variable that is missing or wrong. Never echoes the token. */
export function readSettings(env: NodeJS.ProcessEnv): Settings {
  const url = env[URL_ENV]?.trim();
  if (!url)
    throw new UsageError(
      `${URL_ENV} is not set: set it to the Studio's host, e.g. https://studio.toheplay.io.vn or http://localhost:4722`,
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UsageError(`${URL_ENV} is not a URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new UsageError(`${URL_ENV} must be an http or https URL: ${url}`);
  const token = env[TOKEN_ENV]?.trim();
  if (!token)
    throw new UsageError(
      `${TOKEN_ENV} is not set: ask the owner for an agent token with studio.draft (the console's Agents page)`,
    );
  if (!token.startsWith(TOKEN_PREFIX) || /\s/.test(token))
    throw new UsageError(`${TOKEN_ENV} is not an agent token: it starts with ${TOKEN_PREFIX}`);
  return { url: url.replace(/\/+$/, ''), token };
}

/** Where a command writes: `out` for results, `err` for problems. */
export interface Io {
  out(line: string): void;
  err(line: string): void;
}

/** An `Io` that replaces every secret it is given by its first characters, whatever the line came from. */
export function redactingIo(io: Io, secrets: () => readonly string[]): Io {
  const redact = (line: string) => {
    let safe = line;
    for (const secret of secrets()) {
      if (secret.length > 0) safe = safe.split(secret).join(`${TOKEN_PREFIX}…`);
    }
    return safe;
  };
  return { out: (line) => io.out(redact(line)), err: (line) => io.err(redact(line)) };
}

export const consoleIo: Io = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};
