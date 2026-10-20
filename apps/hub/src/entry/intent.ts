// The entry kept on this tab (ADR 0044, step 3): an hour, through signing in, a provider's round trip, an email code
// and the terms, in sessionStorage — per tab, gone with it — and for the player the gate let through. Cleared when
// reached, or when another profile is chosen, made or signed out on a shared device. Tested in entry.test.ts.
// docs/architecture/entry-links.md#the-hubs-entry-pipeline
import type { LinkIntent } from '../api/client.ts';
import { type EntryIntent, type EntryKind, isEntryPath, readCodeOf } from './codes.ts';

/** How long an entry is kept. */
export const KEEP_MS = 60 * 60 * 1000;

const INTENT_KEY = 'tohe:entry';
/** The share link this tab came from: an account made within the hour counts for it, once (`entryCode`). */
const SOURCE_KEY = 'tohe:entry-source';
/** Where to go after signing in (session/next.ts): an entry's path there goes with the entry. */
const NEXT_KEY = 'tohe:next';

export interface KeptEntry extends EntryIntent {
  /** When it was first kept (ms since the epoch). */
  at: number;
  /** A share link as `open` resolved it: a reload or a sign-in in between does not open it again. */
  link?: LinkIntent;
  /**
   * The player it is for, once the identity gate let them through: another player on this device — a shared phone —
   * never inherits it.
   */
  player?: string;
}

/** The part of `Storage` the store uses: sessionStorage in the hub, a map in tests. */
export type EntryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KINDS: readonly EntryKind[] = ['room', 'share', 'play'];
const LINK_STATES: readonly string[] = ['ok', 'expired', 'revoked', 'used_up', 'unknown'];
const LEVELS: readonly unknown[] = [null, undefined, 'any', 'named', 'account'];

/** A resolution read back from storage, checked as the API's answer would be: else it is asked again. */
function wellFormedLink(link: unknown, code: string): link is LinkIntent {
  if (typeof link !== 'object' || link === null) return false;
  const { code: own, state, level, gameId } = link as Record<string, unknown>;
  return (
    own === code &&
    typeof state === 'string' &&
    LINK_STATES.includes(state) &&
    LEVELS.includes(level) &&
    (gameId === null ||
      gameId === undefined ||
      (typeof gameId === 'string' && readCodeOf('play', gameId) !== null))
  );
}

function parse<T>(storage: EntryStorage | null, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: EntryStorage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing may refuse storage: the entry then lasts as long as the page.
  }
}

function remove(storage: EntryStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing kept.
  }
}

export function createEntryStore(storage: EntryStorage | null, now: () => number = Date.now) {
  const same = (a: EntryIntent, b: EntryIntent) => a.kind === b.kind && a.code === b.code;

  const store = {
    /**
     * The entry kept, if it is younger than an hour and still a well-formed intent. Given the player now playing, an
     * entry the gate let another player through is forgotten instead.
     */
    current(player?: string | null): KeptEntry | null {
      const kept = parse<KeptEntry>(storage, INTENT_KEY);
      if (
        !kept ||
        !KINDS.includes(kept.kind) ||
        typeof kept.code !== 'string' ||
        typeof kept.at !== 'number'
      ) {
        if (kept) remove(storage, INTENT_KEY);
        return null;
      }
      // Read back through the same check as an address: what storage holds is never a free path.
      const read = readCodeOf(kept.kind, kept.code);
      if (!read || read.code !== kept.code || now() - kept.at >= KEEP_MS || kept.at > now()) {
        remove(storage, INTENT_KEY);
        return null;
      }
      if (player !== undefined && typeof kept.player === 'string' && kept.player !== player) {
        store.forget();
        return null;
      }
      const { link, ...rest } = kept;
      return kept.kind === 'share' && wellFormedLink(link, kept.code) ? { ...rest, link } : rest;
    },

    /** Keeps an intent: the one kept already when it is the same (with its resolution), else this one from now. */
    keep(intent: EntryIntent): KeptEntry {
      const kept = store.current();
      if (kept && same(kept, intent)) return kept;
      const next: KeptEntry = { kind: intent.kind, code: intent.code, at: now() };
      write(storage, INTENT_KEY, next);
      return next;
    },

    /**
     * The identity gate let `player` through for this intent: it is theirs. Kept for another player — someone who
     * chose another profile since — it was theirs and goes; this player's own starts now.
     */
    claim(intent: EntryIntent, player: string): void {
      const kept = store.current();
      if (!kept || !same(kept, intent) || kept.player === player) return;
      if (kept.player === undefined) {
        write(storage, INTENT_KEY, { ...kept, player });
        return;
      }
      store.forget();
      write(storage, INTENT_KEY, { kind: intent.kind, code: intent.code, at: now(), player });
    },

    /** The same player under a new id — its copy on the server was gone, or its id taken (ADR 0043). */
    renamed(from: string, to: string): void {
      const kept = parse<KeptEntry>(storage, INTENT_KEY);
      if (kept?.player === from) write(storage, INTENT_KEY, { ...kept, player: to });
    },

    /** The share link's resolution, kept with its intent. */
    resolved(code: string, link: LinkIntent): void {
      const kept = store.current();
      if (kept?.kind === 'share' && kept.code === code) write(storage, INTENT_KEY, { ...kept, link });
      // The tab came from this link: an account made within the hour of first opening it counts for it. Opened again —
      // a reload — the hour does not start over.
      const source = parse<{ code?: unknown; at?: unknown }>(storage, SOURCE_KEY);
      const live = source?.code === code && typeof source.at === 'number' && now() - source.at < KEEP_MS;
      if (link.state === 'ok' && !live) write(storage, SOURCE_KEY, { code, at: now() });
    },

    /** The intent was reached — the lobby or the game is open — or ended in a dead end: it is not kept any more. */
    reached(intent: EntryIntent): void {
      const kept = parse<KeptEntry>(storage, INTENT_KEY);
      if (kept && same(kept, intent)) remove(storage, INTENT_KEY);
    },

    /**
     * Another profile was chosen on a shared device, a new one made, or the account signed out: what this tab came for
     * is someone else's. The intent, the share link it came from, and an entry's path waiting after sign-in all go.
     */
    forget(): void {
      remove(storage, INTENT_KEY);
      remove(storage, SOURCE_KEY);
      const next = (() => {
        try {
          return storage?.getItem(NEXT_KEY) ?? null;
        } catch {
          return null;
        }
      })();
      if (next && isEntryPath(next)) remove(storage, NEXT_KEY);
    },

    /**
     * A profile chosen in the picker. Chosen by hand ("Đổi người chơi") and not the one playing, the entry was someone
     * else's on a shared device; chosen in the picker the hub sent someone to (`auto`), it is the way on to the entry.
     */
    switched({ auto, from, to }: { auto: boolean | undefined; from: string | null; to: string }): void {
      if (!auto && from !== to) store.forget();
    },

    /** The share link to send as `entryCode` when an account is made now, if this tab came from one within the hour. */
    signUpCode(): string | null {
      const source = parse<{ code?: unknown; at?: unknown }>(storage, SOURCE_KEY);
      if (!source || typeof source.code !== 'string' || typeof source.at !== 'number') return null;
      const read = readCodeOf('share', source.code);
      if (!read || now() - source.at >= KEEP_MS) {
        remove(storage, SOURCE_KEY);
        return null;
      }
      return read.code;
    },

    /** An account was made: the share link counted it, never again. */
    signedUp(): void {
      remove(storage, SOURCE_KEY);
    },
  };
  return store;
}

export type EntryStore = ReturnType<typeof createEntryStore>;

function sessionStore(): EntryStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** This tab's entry. */
export const entry = createEntryStore(sessionStore());

/**
 * Runs a request once per key for the life of the page: `open` and `play` are asked once per reached intent, though
 * the screens around them are drawn again (a session that settles, React's strict mode). A failed request may be asked
 * again.
 */
export function createOnce() {
  const running = new Map<string, Promise<unknown>>();
  return <T>(key: string, send: () => Promise<T>): Promise<T> => {
    const known = running.get(key) as Promise<T> | undefined;
    if (known) return known;
    const sent = send().catch((error: unknown) => {
      running.delete(key);
      throw error;
    });
    running.set(key, sent);
    return sent;
  };
}

export const once = createOnce();
