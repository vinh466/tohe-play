// How long games last and how big the blocks get (SPEC.md, "Game length"): two bots play the real rules from
// logic.ts. Run with `pnpm --filter @tohe/game-tap-merge simulate` (about a minute).
import {
  blockValue,
  cellAt,
  type Exponent,
  floorOf,
  group,
  hasMove,
  newGame,
  random,
  type State,
  shuffle,
  tap,
} from '../src/logic.ts';

const GAMES = 40;
/** A game still going after this many taps counts as endless. */
const CAP = 50_000;

type Bot = 'child' | 'greedy';

interface Result {
  taps: number;
  top: Exponent;
  score: number;
  ended: boolean;
  stuck: number;
  floor: Exponent;
  absorbed: number[];
  bonus: number;
}

function play(seed: number, bot: Bot): Result {
  let state: State = newGame(seed);
  let botRng = (seed * 7919 + 13) >>> 0;
  const pick = (n: number) => {
    const [r, next] = random(botRng);
    botRng = next;
    return Math.floor(r * n);
  };
  const result: Result = {
    taps: 0,
    top: 0,
    score: 0,
    ended: false,
    stuck: 0,
    floor: 1,
    absorbed: [],
    bonus: 0,
  };
  while (!state.over && result.taps < CAP) {
    if (!hasMove(state.grid)) {
      const rescued = shuffle(state);
      if (!rescued.ok) throw new Error(rescued.reason);
      state = rescued.state;
      result.stuck++;
      continue;
    }
    const options = state.grid
      .map((_, index) => ({ index, size: group(state.grid, cellAt(index)).length }))
      .filter((o) => o.size > 0);
    // A child taps any block that merges; the greedy player takes one of the biggest groups.
    const biggest = Math.max(...options.map((o) => o.size));
    const pool = bot === 'child' ? options : options.filter((o) => o.size === biggest);
    const chosen = pool[pick(pool.length)];
    if (!chosen) throw new Error('no option');
    const played = tap(state, cellAt(chosen.index));
    if (!played.ok) throw new Error(played.reason);
    for (const event of played.events) {
      if (event.type === 'merge') result.absorbed.push(event.from.length);
      if (event.type === 'floor') result.bonus += event.gained;
    }
    state = played.state;
    result.taps++;
  }
  return { ...result, top: state.top, score: state.score, ended: state.over, floor: floorOf(state.top) };
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const at = (xs: number[], p: number) => sorted(xs)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;
const label = (exp: Exponent) => {
  const units = ['', 'K', 'M', 'B', 'T'];
  if (exp < 12) return String(blockValue(exp));
  const unit = Math.min(units.length - 1, Math.floor(exp / 10));
  return `${blockValue(exp - unit * 10)}${units[unit]}`;
};
const big = (x: number) => (x < 1e6 ? Math.round(x).toLocaleString('en') : `${(x / 1e6).toFixed(1)}M`);

for (const bot of ['child', 'greedy'] as const) {
  const games = Array.from({ length: GAMES }, (_, i) => play(1000 + i * 7, bot));
  const taps = games.map((g) => g.taps);
  const tops = games.map((g) => g.top);
  const absorbed = games.flatMap((g) => g.absorbed);
  const scores = games.map((g) => g.score);
  console.log(`\n${bot} (${GAMES} games)`);
  console.log(`  taps per game: median ${at(taps, 0.5)} (p10 ${at(taps, 0.1)} – p90 ${at(taps, 0.9)})`);
  console.log(`  endless (still going after ${CAP} taps): ${games.filter((g) => !g.ended).length}`);
  console.log(`  largest block: median ${label(at(tops, 0.5))}, max ${label(Math.max(...tops))}`);
  const floors = games.map((g) => g.floor);
  console.log(`  smallest value at the end: median ${label(at(floors, 0.5))}`);
  console.log(`  stuck per game: ${(games.reduce((s, g) => s + g.stuck, 0) / GAMES).toFixed(1)}`);
  console.log(
    `  absorbed per tap: ${(absorbed.reduce((s, n) => s + n, 0) / absorbed.length).toFixed(1)} on average, ` +
      `up to ${Math.max(...absorbed)}; 6+ in ${((100 * absorbed.filter((n) => n >= 6).length) / absorbed.length).toFixed(0)}%`,
  );
  console.log(`  score: median ${big(at(scores, 0.5))}, max ${big(Math.max(...scores))}`);
  console.log(
    `  floor bonus: ${((100 * games.reduce((s, g) => s + g.bonus, 0)) / scores.reduce((s, x) => s + x, 0)).toFixed(0)}% of all points`,
  );
}
