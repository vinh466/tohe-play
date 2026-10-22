// Reading the device session on a cold start (ADR 0046, docs/architecture/surfaces.md "A quick cold start"). The hub
// waits for `GET /api/auth/me` before it knows who plays; on a weak signal that wait had no end and the player saw
// "Đang tải…". Now the wait ends after ME_TIMEOUT_MS: the hub goes on with the copy of the session it keeps for playing
// offline (ADR 0005) and asks again in the background. Only an answer from the API — "nobody is signed in" — can end
// the account's session (session/ended.ts); a timeout or a network error never does.
import { ApiError, type MeView } from '../api/client.ts';
import { sessionEndedBy } from './ended.ts';

/** How long a cold start waits for the API's answer about the session before it goes on with its copy. */
export const ME_TIMEOUT_MS = 3000;

/** The first, and the longest, wait before asking again in the background after an unanswered start. */
export const ME_RETRY_FIRST_MS = 5_000;
export const ME_RETRY_LAST_MS = 60_000;

/**
 * Whether the API could not be reached, as opposed to having answered: the network is down (a `TypeError` from `fetch`),
 * the proxy or the API is down (5xx), or the request ran out of time or was cut off (`TimeoutError`, `AbortError`).
 */
export function isUnreachable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof ApiError) return error.status >= 500;
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** What loading the session needs from outside, so the logic can be tried without a network or a database. */
export interface MeDeps {
  /** `GET /api/auth/me`: the session, or null when the API answers that nobody is signed in. */
  fetchMe(signal: AbortSignal): Promise<MeView | null>;
  /** The copy of the account's session this device keeps. */
  known(): Promise<MeView | undefined>;
  keep(me: MeView): Promise<void>;
  forget(): Promise<void>;
  ended: { mark(): void; clear(): void };
}

export interface MeAnswer {
  me: MeView | null;
  /** The API answered. False: this is the device's copy (or nothing), and the API is asked again later. */
  confirmed: boolean;
}

export async function loadMe(deps: MeDeps, timeoutMs = ME_TIMEOUT_MS): Promise<MeAnswer> {
  try {
    const me = await deps.fetchMe(AbortSignal.timeout(timeoutMs));
    if (me) {
      await deps.keep(me);
      deps.ended.clear();
    } else {
      const known = await deps.known();
      if (sessionEndedBy(known, me)) deps.ended.mark();
      await deps.forget();
    }
    return { me, confirmed: true };
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    return { me: (await deps.known()) ?? null, confirmed: false };
  }
}

/**
 * Whether the session shown is only the device's copy, and asking the API again in the background until it answers:
 * after ME_RETRY_FIRST_MS, then every wait twice as long as the one before, up to ME_RETRY_LAST_MS. Meanwhile the
 * session counts as stale, so coming back to the app or the network coming back asks at once as well.
 */
export function createMeWatch(
  refetch: () => void,
  timers: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis,
) {
  let unconfirmed = false;
  let wait = ME_RETRY_FIRST_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    get unconfirmed() {
      return unconfirmed;
    },
    /** Call with each answer `loadMe` gives. */
    answered(confirmed: boolean): void {
      unconfirmed = !confirmed;
      if (confirmed) {
        wait = ME_RETRY_FIRST_MS;
        if (timer !== undefined) timers.clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) {
        timer = timers.setTimeout(() => {
          timer = undefined;
          wait = Math.min(wait * 2, ME_RETRY_LAST_MS);
          refetch();
        }, wait);
      }
    },
  };
}
