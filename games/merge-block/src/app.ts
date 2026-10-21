// What both stages share (ADR 0020): the session, the words, the sounds and the player's save. The menu stage
// (main.ts) reads the save for its summary and settings; the play stage (stage.ts) plays from it and writes it back.
import { createSfx, formatScore } from '@tohe/game-kit';
import { connect, type RankedRun } from '@tohe/game-sdk';
import { type ChallengeSlot, challengePayload, restoreChallenge } from './challenge.ts';
import { restore, type State } from './logic.ts';
import { DEFAULT_PALETTE, isPalette, type PaletteId } from './palette.ts';
import { stringsFor } from './strings.ts';

export interface Saved {
  best: number;
  /** The game in progress, resumed when the game opens again. */
  game: State | null;
  tutorialSeen: boolean;
  /** The id the game in progress reports its score under on the household leaderboard (ADR 0014). */
  run?: string;
  /** The player's block colours (SPEC.md, "Block colours"); absent in saves from before 1.5.0. */
  palette?: PaletteId;
  /** The game in progress is a ranked run (ADR 0030): kept here, so it continues on any device. */
  ranked?: RankedProgress;
  /** The last challenge opened by a link ("Thách bạn", ADR 0045), beside the regular game; absent before 1.11.0. */
  challenge?: ChallengeSlot;
}

/** A ranked run as it goes: the run the server opened, its seed, and every column dropped so far. */
export interface RankedProgress {
  run: string;
  seed: number;
  moves: number[];
}

const isRanked = (value: unknown): value is RankedProgress => {
  const ranked = value as Partial<RankedProgress> | null | undefined;
  return (
    typeof ranked?.run === 'string' &&
    Number.isInteger(ranked.seed) &&
    Array.isArray(ranked.moves) &&
    ranked.moves.every((col) => Number.isInteger(col))
  );
};

export const session = await connect<Saved>({ gameId: 'merge-block' });
export const t = stringsFor(session.locale);

/** A ranked run to watch (ADR 0032): replay.ts plays it back instead of a game, and nothing is saved or scored. */
export const rankedReplay = session.rankedReplay;

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
const resumed = restore(saved?.game);

/** The save in memory. `game` is the last game, finished or not: the next one continues its random sequence. */
export const store: {
  best: number;
  game: State | null;
  tutorialSeen: boolean;
  run: string | null;
  palette: PaletteId;
  ranked: RankedProgress | null;
  challenge: ChallengeSlot | null;
} = {
  best: saved?.best ?? 0,
  game: resumed && !resumed.over ? resumed : null,
  tutorialSeen: saved?.tutorialSeen ?? false,
  run: (resumed && !resumed.over && saved?.run) || null,
  palette: isPalette(saved?.palette) ? saved.palette : DEFAULT_PALETTE,
  ranked: resumed && !resumed.over && isRanked(saved?.ranked) ? saved.ranked : null,
  challenge: restoreChallenge(saved?.challenge),
};

/** How long a new game waits for a ranked run before it starts unranked. */
const RANKED_WAIT_MS = 2500;

/** A ranked run for a new game, or null — offline, a guest, standalone, or no answer in time: play unranked. */
export function startRanked(): Promise<RankedRun | null> {
  return Promise.race([
    session.ranked.start(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), RANKED_WAIT_MS)),
  ]);
}

/** Hands the ranked run of the game in progress in, with the score it reached (ADR 0030); none is kept after. */
export function finishRanked(score: number) {
  const ranked = store.ranked;
  store.ranked = null;
  if (!ranked) return;
  void session.ranked
    .finish(ranked.run, ranked.moves, score)
    .catch((error) => session.log('warn', `ranked run not handed in: ${String(error)}`));
}

/** Writes the save; a finished game is not kept (the next opening starts a fresh one). */
export function persist(): Promise<void> {
  const game = store.game && !store.game.over ? store.game : null;
  const data: Saved = {
    best: Math.max(store.best, store.game?.best ?? 0),
    game,
    tutorialSeen: store.tutorialSeen,
    palette: store.palette,
  };
  // JSON has no undefined: the run id is only there with a game in progress.
  if (game && store.run) data.run = store.run;
  if (game && store.ranked) data.ranked = store.ranked;
  if (store.challenge) {
    const played = store.challenge.game;
    data.challenge = { ...store.challenge, game: played && !played.over ? played : null };
  }
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

/**
 * "Thách bạn" (ADR 0045): asks the hub to share a challenge on `seed` claiming `score` — its sheet; the link is made only
 * if the player sends or copies it. Any answer is fine: cancelled, busy or offline leaves the card as it was.
 */
export function shareChallenge(seed: number, score: number): void {
  void session
    .share({
      payload: challengePayload(seed, score),
      text: t.challenge.text(formatScore(score, session.locale)),
      level: 'any',
    })
    .catch((error) => session.log('info', `challenge not shared: ${String(error)}`));
}
