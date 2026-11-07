// "Thách bạn" (ADR 0045, SPEC.md "Challenge a friend"): a finished game shares its start seed and its score; whoever
// opens the link plays the same blocks in a slot of its own, with its own score run, never ranked. 3.0.0 adds the
// daily's share (v3), which carries the sender's local date beside the seed. Pure: what the share sends, what an
// entry may hold, and the challenge slot of the save. The payload is untrusted — anyone can make a share link
// through the API — so everything is checked here, and the score is only the maker's claim.
import { newGame, restore, type State } from './logic.ts';

/** A classic "Thách bạn" (2.0.1): the payload's own version, the seed the game started from, and its score. */
export type ClassicPayload = {
  v: 2;
  seed: number;
  score: number;
};

/** The daily's share (3.0.0): the seed, its score, and the sender's local date, shown as a claim. */
export type DailyPayload = {
  v: 3;
  seed: number;
  score: number;
  date: string;
  mode: 'daily';
};

export type ChallengePayload = ClassicPayload | DailyPayload;

/** The highest score a payload may claim: far above any game, below where numbers lose their digits. */
const MAX_SCORE = 1e12;

const isSeed = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;

const isScore = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SCORE;

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** The payload of a classic challenge on `seed`, claiming `score`. */
export const challengePayload = (seed: number, score: number): ClassicPayload => ({
  v: 2,
  seed: seed >>> 0,
  score: Math.max(0, Math.round(score)),
});

/** The payload of a daily challenge: the same seed and score, plus the sender's local date. */
export const dailyPayload = (seed: number, score: number, date: string): DailyPayload => ({
  v: 3,
  seed: seed >>> 0,
  score: Math.max(0, Math.round(score)),
  date,
  mode: 'daily',
});

/** Whether a payload is a daily one. */
export const isDailyPayload = (payload: ChallengePayload): payload is DailyPayload =>
  payload.v === 3 && payload.mode === 'daily';

/**
 * What an entry asks of this game: `handled` for a challenge it opens, `unsupported` for a payload of another version
 * (a newer game's or an older one's), `invalid` for anything else.
 */
export function readEntry(
  kind: string,
  payload: unknown,
): { result: 'handled'; challenge: ChallengePayload } | { result: 'unsupported' | 'invalid' } {
  if (kind !== 'share') return { result: 'unsupported' };
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return { result: 'invalid' };
  const fields = payload as Record<string, unknown>;
  if (typeof fields.v === 'number' && fields.v !== 2 && fields.v !== 3) return { result: 'unsupported' };
  const keys = Object.keys(fields);
  if (fields.v === 2) {
    if (
      keys.length !== 3 ||
      !keys.every((key) => key === 'v' || key === 'seed' || key === 'score') ||
      !isSeed(fields.seed) ||
      !isScore(fields.score)
    ) {
      return { result: 'invalid' };
    }
    return { result: 'handled', challenge: { v: 2, seed: fields.seed, score: fields.score } };
  }
  if (fields.v === 3) {
    if (
      keys.length !== 5 ||
      !keys.every(
        (key) => key === 'v' || key === 'seed' || key === 'score' || key === 'date' || key === 'mode',
      ) ||
      !isSeed(fields.seed) ||
      !isScore(fields.score) ||
      !isDate(fields.date) ||
      fields.mode !== 'daily'
    ) {
      return { result: 'invalid' };
    }
    return {
      result: 'handled',
      challenge: { v: 3, seed: fields.seed, score: fields.score, date: fields.date, mode: 'daily' },
    };
  }
  return { result: 'invalid' };
}

/** Who sent the challenge, when the hub may say (a child's profile is never named). */
export interface ChallengeFrom {
  name: string;
  avatar?: string;
}

/** The challenge slot of the save: beside the regular game, which it never touches. */
export interface ChallengeSlot {
  seed: number;
  /** The score the link claimed, shown as the maker's claim. */
  target: number;
  /** A classic challenge (v2) or the daily's (v3). */
  mode: 'classic' | 'daily';
  /** The daily's local date, from its payload. */
  date?: string;
  from: ChallengeFrom | null;
  /** The challenge game in progress, or null once it ended. */
  game: State | null;
  /** Its own score run on the household leaderboard (ADR 0014): a normal score, never a ranked run. */
  run: string;
}

/**
 * The challenge to play for an entry: the one in the slot when it is the same challenge and still in progress — the
 * game was opened again, after signing in or by the same link — otherwise a fresh game from the challenge's seed.
 */
export function openChallenge(
  slot: ChallengeSlot | null,
  challenge: ChallengePayload,
  from: ChallengeFrom | null,
  best: number,
  newRun: () => string,
): ChallengeSlot {
  const mode = isDailyPayload(challenge) ? 'daily' : 'classic';
  const date = isDailyPayload(challenge) ? challenge.date : undefined;
  const same =
    slot !== null &&
    slot.seed === challenge.seed &&
    slot.target === challenge.score &&
    slot.mode === mode &&
    slot.date === date &&
    (slot.from?.name ?? null) === (from?.name ?? null);
  if (same && slot.game && !slot.game.over) return slot;
  return {
    seed: challenge.seed,
    target: challenge.score,
    mode,
    ...(date ? { date } : {}),
    from,
    game: newGame(challenge.seed, best, mode, date ? { dailyDate: date } : {}),
    run: newRun(),
  };
}

/** A challenge slot read back from the save, or null for anything that is not one (old or damaged saves). */
export function restoreChallenge(saved: unknown): ChallengeSlot | null {
  if (typeof saved !== 'object' || saved === null) return null;
  const slot = saved as Partial<ChallengeSlot>;
  const from = slot.from as Partial<ChallengeFrom> | null | undefined;
  const fromOk =
    from === null ||
    (typeof from === 'object' &&
      typeof from.name === 'string' &&
      from.name.length > 0 &&
      from.name.length <= 64 &&
      (from.avatar === undefined || typeof from.avatar === 'string'));
  // Saves from 2.0.1 have no mode: their challenge is the classic one.
  const mode = slot.mode === undefined ? 'classic' : slot.mode;
  const daily = mode === 'daily';
  if (
    !isSeed(slot.seed) ||
    !isScore(slot.target) ||
    (mode !== 'classic' && mode !== 'daily') ||
    (daily && !isDate(slot.date)) ||
    (!daily && slot.date !== undefined) ||
    !fromOk ||
    typeof slot.run !== 'string' ||
    !slot.run
  ) {
    return null;
  }
  const game = slot.game === null ? null : restore(slot.game);
  if (slot.game !== null && game === null) return null;
  return {
    seed: slot.seed,
    target: slot.target,
    mode,
    ...(daily ? { date: slot.date as string } : {}),
    from: from ? { name: from.name as string, ...(from.avatar ? { avatar: from.avatar } : {}) } : null,
    game,
    run: slot.run,
  };
}

/** Whether a finished challenge game beat the claimed score, and how far short it fell otherwise (at least 1). */
export function outcome(score: number, target: number): { beaten: boolean; short: number } {
  return score > target ? { beaten: true, short: 0 } : { beaten: false, short: Math.max(1, target - score) };
}
