// "Thách bạn" (ADR 0045, SPEC.md "Challenge a friend"): a finished game shares its start seed and its score; whoever
// opens the link plays the same blocks in a slot of its own, with its own score run, never ranked. Pure: what the
// share sends, what an entry may hold, and the challenge slot of the save. The payload is untrusted — anyone can make
// a share link through the API — so everything is checked here, and the score is only the maker's claim.
import { newGame, restore, type State } from './logic.ts';

/** What "Thách bạn" shares: the payload's own version, the seed the game started from, and its score. */
export type ChallengePayload = {
  v: 1;
  seed: number;
  score: number;
};

/** The highest score a payload may claim: far above any game, below where numbers lose their digits. */
const MAX_SCORE = 1e12;

const isSeed = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;

const isScore = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SCORE;

/** The payload of a challenge on `seed`, claiming `score`. */
export const challengePayload = (seed: number, score: number): ChallengePayload => ({
  v: 1,
  seed: seed >>> 0,
  score: Math.max(0, Math.round(score)),
});

/**
 * What an entry asks of this game: `handled` for a challenge it opens, `unsupported` for a payload of another version
 * (a newer game's), `invalid` for anything else.
 */
export function readEntry(
  kind: string,
  payload: unknown,
): { result: 'handled'; challenge: ChallengePayload } | { result: 'unsupported' | 'invalid' } {
  if (kind !== 'share') return { result: 'unsupported' };
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return { result: 'invalid' };
  const fields = payload as Record<string, unknown>;
  if (typeof fields.v === 'number' && fields.v !== 1) return { result: 'unsupported' };
  const keys = Object.keys(fields);
  if (
    fields.v !== 1 ||
    keys.length !== 3 ||
    !keys.every((key) => key === 'v' || key === 'seed' || key === 'score') ||
    !isSeed(fields.seed) ||
    !isScore(fields.score)
  ) {
    return { result: 'invalid' };
  }
  return { result: 'handled', challenge: { v: 1, seed: fields.seed, score: fields.score } };
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
  const same =
    slot !== null &&
    slot.seed === challenge.seed &&
    slot.target === challenge.score &&
    (slot.from?.name ?? null) === (from?.name ?? null);
  if (same && slot.game && !slot.game.over) return slot;
  return {
    seed: challenge.seed,
    target: challenge.score,
    from,
    game: newGame(challenge.seed, best),
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
  if (!isSeed(slot.seed) || !isScore(slot.target) || !fromOk || typeof slot.run !== 'string' || !slot.run) {
    return null;
  }
  const game = slot.game === null ? null : restore(slot.game);
  if (slot.game !== null && game === null) return null;
  return {
    seed: slot.seed,
    target: slot.target,
    from: from ? { name: from.name as string, ...(from.avatar ? { avatar: from.avatar } : {}) } : null,
    game,
    run: slot.run,
  };
}

/** Whether a finished challenge game beat the claimed score, and how far short it fell otherwise (at least 1). */
export function outcome(score: number, target: number): { beaten: boolean; short: number } {
  return score > target ? { beaten: true, short: 0 } : { beaten: false, short: Math.max(1, target - score) };
}
