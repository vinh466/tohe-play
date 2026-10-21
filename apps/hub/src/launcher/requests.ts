// What the hub gives a game and answers it (ADR 0045): the profile's kind, what it may ask for in this session, the
// entry it is opened with, and the rules around its requests — one sheet at a time, a decline remembered for ten
// minutes. Pure helpers, tested in hub.test.ts.
import type { EntryResult, GameEntry, HostCan, IdentityLevel, ProfileKind, ShareError } from '@tohe/contract';
import { ApiError, type GameSummary } from '../api/client.ts';
import { highestLevel, type Level, readLevel } from '../entry/codes.ts';
import type { Player } from '../session/session.ts';

/** How long the hub waits for a game's answer to its entry before saying it did not open (ADR 0045). */
export const ENTRY_ANSWER_MS = 5000;

/** How long a player's "Để sau" holds for that game and profile: its requests are declined without asking. */
export const DECLINE_MS = 10 * 60 * 1000;

/** How long the hub waits for a paused game to save before leaving it to sign in. */
export const LEAVE_WAIT_MS = 1000;

/** A device profile, or an account's — a child's profile is an account's (ADR 0043). */
export const profileKind = (player: Pick<Player, 'kind'>): ProfileKind =>
  player.kind === 'device' ? 'device' : 'account';

/** What opening the game asks for (ADR 0045); `any` for an API from before it. */
export const playLevel = (game: Pick<GameSummary, 'identity'>): Level =>
  readLevel(game.identity?.play ?? 'any');

/**
 * What a table of the game asks for at least: the highest of its `play` and its `rooms` (`named` by default) — the
 * table's door may ask more (ADR 0043, 0045).
 */
export const tableLevel = (game: Pick<GameSummary, 'identity'>): Level =>
  highestLevel(playLevel(game), readLevel(game.identity?.rooms ?? 'named'));

/** The build opens this kind of entry itself. */
export const takesEntry = (game: Pick<GameSummary, 'entries'>, kind: GameEntry['kind']): boolean =>
  (game.entries ?? []).includes(kind);

/**
 * What the hub answers in this session (ADR 0045): nothing at a table, in a replay or a ranked replay, or where the
 * page has no session to ask with; `share` only for a game with entries, and not for a child kept to its account.
 */
export function hostCan(options: {
  asking: boolean;
  elsewhere: boolean;
  entries: readonly string[] | undefined;
  mayPlayWithOthers: boolean;
}): HostCan {
  const here = options.asking && !options.elsewhere;
  return {
    require: here,
    share: here && (options.entries ?? []).length > 0 && options.mayPlayWithOthers,
  };
}

/** The level the profile playing has: an account's has them all; a device profile is `named` once on the server. */
export function profileLevel(player: Pick<Player, 'kind'>, named: boolean): Level {
  if (player.kind !== 'device') return 'account';
  return named ? 'named' : 'any';
}

/** A request the profile meets already: answered `ok` at once, without a sheet. */
export const meets = (has: Level, asked: IdentityLevel): boolean => highestLevel(has, asked) === has;

/** "Để sau" for a game and a profile, remembered for ten minutes on this page. */
export function createDeclines(now: () => number = Date.now) {
  const until = new Map<string, number>();
  const key = (gameId: string, profileId: string) => `${gameId}\n${profileId}`;
  return {
    declined(gameId: string, profileId: string): boolean {
      const end = until.get(key(gameId, profileId));
      if (end === undefined) return false;
      if (now() < end) return true;
      until.delete(key(gameId, profileId));
      return false;
    },
    decline(gameId: string, profileId: string): void {
      until.set(key(gameId, profileId), now() + DECLINE_MS);
    },
  };
}

export const declines = createDeclines();

/** Why making the game's link failed, as the game hears it (ADR 0045). */
export function shareErrorOf(error: unknown): ShareError {
  if (error instanceof ApiError) {
    if (error.code === 'link_limit') return 'limit';
    if (error.status === 429) return 'limit';
    if (
      error.code === 'play_with_others_off' ||
      error.code === 'too_young' ||
      error.code === 'entry_not_supported' ||
      error.code === 'game_not_found'
    )
      return 'not_allowed';
    return 'unavailable';
  }
  // fetch() fails with a TypeError when the network is gone.
  if (error instanceof TypeError) return 'offline';
  return 'unavailable';
}

/** Whether the hub shows its notice over the game's menu: the entry did not open (ADR 0045). */
export const entryFailed = (answer: EntryResult | 'none' | 'undeclared'): boolean => answer !== 'handled';

/** The level a game's share asks of whoever opens the link: what it asked, if it is one; the API raises it. */
export const shareLevel = (level: string | undefined): IdentityLevel | undefined =>
  level === 'any' || level === 'named' || level === 'account' ? level : undefined;
