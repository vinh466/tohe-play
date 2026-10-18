// The verify module (ADR 0030): what the API runs in Jint to replay a ranked run of Ghép Khối — the seed it dealt and
// the columns dropped, in order. Pure like logic.ts: no DOM, timers, network, Math.random or Date.now.
import { COLS, drop, landingRow, newGame, random, type State } from './logic.ts';

/** A ranked run as the API replays it. */
export interface RankedRun {
  seed: number;
  /** The columns the player dropped into, 0 to COLS − 1. */
  moves: unknown[];
}

function play(run: RankedRun): { state: State } | { error: string } {
  let state = newGame(run.seed);
  for (let index = 0; index < run.moves.length; index++) {
    const col = run.moves[index];
    if (typeof col !== 'number' || !Number.isInteger(col)) return { error: `move ${index} is not a column` };
    const result = drop(state, col);
    if (!result.ok) return { error: `move ${index}: ${result.reason}` };
    state = result.state;
  }
  return { state };
}

export const verify = {
  /** The run's score — whether it reached game over or the player left it — or why a move was not legal. */
  replay(run: RankedRun): { score: number; over: boolean } | { error: string } {
    const played = play(run);
    return 'error' in played ? played : { score: played.state.score, over: played.state.over };
  },

  /** A legal column for conformance to play runs with, chosen by a PRNG of the run itself; null once it is over. */
  bot(run: RankedRun): number | null {
    const played = play(run);
    if ('error' in played || played.state.over) return null;
    const open = [...Array(COLS).keys()].filter((col) => landingRow(played.state.grid, col) !== null);
    if (open.length === 0) return null;
    const [pick] = random((run.seed ^ Math.imul(run.moves.length + 1, 0x9e3779b1)) >>> 0);
    return open[Math.floor(pick * open.length)] ?? null;
  },
};
