// The entry a game is opened with (ADR 0045): a share link's payload, from `play` to the game's `init.entry`, and kept
// through signing in when a game asked for an account — the game is opened again with it, and the link is not resolved
// again, so no second use is counted. On this tab only (sessionStorage), for the game named, for an hour, and taken
// once. Tested in entry.test.ts.
// docs/architecture/entry-links.md#the-hubs-entry-pipeline
import type { GameEntry } from '@tohe/contract';
import type { LinkIntent } from '../api/client.ts';
import { readCodeOf } from './codes.ts';
import { type EntryStorage, KEEP_MS, GAME_ENTRY_KEY as KEY } from './intent.ts';

/** Mirrors MAX_ENTRY_PAYLOAD_BYTES in @tohe/contract, so the catalog loads no Zod. */
const MAX_PAYLOAD_BYTES = 2048;

export interface PendingGameEntry {
  gameId: string;
  /** Null when the game opens again after signing in and was opened by no entry. */
  entry: GameEntry | null;
  at: number;
  /** The game asked for an account and the player signed in: it opens again (ADR 0045). */
  reopen?: boolean;
}

const bytes = (value: unknown) => {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? '').byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** An entry read back from storage or from the API, checked as the contract would: else there is none. */
export function wellFormedEntry(entry: unknown): entry is GameEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const { kind, payload, version, from } = entry as Record<string, unknown>;
  const fromOk =
    from === undefined ||
    (typeof from === 'object' &&
      from !== null &&
      typeof (from as { name?: unknown }).name === 'string' &&
      ((from as { avatar?: unknown }).avatar === undefined ||
        typeof (from as { avatar?: unknown }).avatar === 'string'));
  return (
    kind === 'share' &&
    payload !== undefined &&
    bytes(payload) <= MAX_PAYLOAD_BYTES &&
    typeof version === 'string' &&
    SEMVER.test(version) &&
    fromOk
  );
}

/**
 * The entry an `entry` link opens the game at, from what `play` answered: its payload and version, and its maker when
 * the API names them (never a child, ADR 0044). Null for any other link.
 */
export function entryOfLink(link: LinkIntent): GameEntry | null {
  if (link.state !== 'ok' || link.kind !== 'entry' || !link.entry) return null;
  const entry: GameEntry = {
    kind: 'share',
    payload: link.entry.payload as GameEntry['payload'],
    version: link.entry.version,
    ...(link.makerName
      ? {
          from: {
            name: link.makerName.slice(0, 64),
            ...(link.entry.makerAvatar ? { avatar: link.entry.makerAvatar.slice(0, 16) } : {}),
          },
        }
      : {}),
  };
  return wellFormedEntry(entry) ? entry : null;
}

export function createGameEntryStore(storage: EntryStorage | null, now: () => number = Date.now) {
  const read = (): PendingGameEntry | null => {
    try {
      const raw = storage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as PendingGameEntry) : null;
    } catch {
      return null;
    }
  };
  const clear = () => {
    try {
      storage?.removeItem(KEY);
    } catch {
      // Nothing kept.
    }
  };
  return {
    /** The game `gameId` opens next with this entry; `reopen` when it opens again after signing in. */
    keep(gameId: string, entry: GameEntry | null, reopen = false): void {
      if (!entry && !reopen) return;
      try {
        storage?.setItem(KEY, JSON.stringify({ gameId, entry, at: now(), ...(reopen ? { reopen } : {}) }));
      } catch {
        // Private browsing may refuse storage: the game then opens at its menu.
      }
    },

    /** The entry waiting for this game, taken: younger than an hour and well formed, else none. */
    take(gameId: string): PendingGameEntry | null {
      const kept = read();
      if (!kept || kept.gameId !== gameId) return null;
      clear();
      const fresh = typeof kept.at === 'number' && kept.at <= now() && now() - kept.at < KEEP_MS;
      const reopen = kept.reopen === true;
      const entry = wellFormedEntry(kept.entry) ? kept.entry : null;
      return fresh && readCodeOf('play', kept.gameId) && (entry || reopen)
        ? { gameId: kept.gameId, entry, at: kept.at, ...(reopen ? { reopen } : {}) }
        : null;
    },

    /** Another player, a sign-out: what was waiting is someone else's. */
    forget: clear,
  };
}

export type GameEntryStore = ReturnType<typeof createGameEntryStore>;

function sessionStore(): EntryStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** This tab's entry waiting for its game. */
export const gameEntry = createGameEntryStore(sessionStore());
