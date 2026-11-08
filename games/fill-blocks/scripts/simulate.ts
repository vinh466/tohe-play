// A greedy bot plays every journey level and today's daily. It prints the result and fails if a level's primary goal
// cannot be reached: a level that cannot be finished is a content bug. Run with
// `pnpm --filter @tohe/game-fill-blocks simulate`.
import { DAILY_GOALS, DAILY_MOVES, dailySeed, LEVELS } from '../src/content/levels.ts';
import { shapeById } from '../src/content/shapes.ts';
import {
  anyShapeFits,
  completed,
  type Goal,
  goalMet,
  newGame,
  place,
  placements,
  rescue,
  type State,
  starsFor,
} from '../src/logic.ts';
import { todayId } from '../src/strings.ts';

interface Result {
  id: string;
  score: number;
  lines: number;
  maxClear: number;
  maxCombo: number;
  perfects: number;
  stars: number;
  moves: number;
  completed: boolean;
}

const holes = (state: State): number => {
  let count = 0;
  for (let col = 0; col < 8; col++) {
    let seen = false;
    for (let row = 0; row < 8; row++) {
      const index = row * 8 + col;
      if (state.board[index] !== 0) seen = true;
      else if (seen && state.blocked[index] === 0) count++;
    }
  }
  return count;
};

/** Rows and columns that are one or two cells from a clear: a good move sets one up. */
const nearLines = (state: State): number => {
  let near = 0;
  for (let row = 0; row < 8; row++) {
    let filled = 0;
    for (let col = 0; col < 8; col++) if (state.board[row * 8 + col] !== 0) filled++;
    if (filled >= 6) near++;
  }
  for (let col = 0; col < 8; col++) {
    let filled = 0;
    for (let row = 0; row < 8; row++) if (state.board[row * 8 + col] !== 0) filled++;
    if (filled >= 6) near++;
  }
  return near;
};

const bumpiness = (state: State): number => {
  const heights: number[] = [];
  for (let col = 0; col < 8; col++) {
    let height = 8;
    for (let row = 0; row < 8; row++)
      if (state.board[row * 8 + col] !== 0) {
        height = row;
        break;
      }
    heights.push(height);
  }
  let score = 0;
  for (let i = 1; i < heights.length; i++) score += Math.abs((heights[i] ?? 0) - (heights[i - 1] ?? 0));
  return score;
};

const play = (
  id: string,
  seed: number,
  goals: readonly Goal[],
  moveLimit: number,
  profile: 'small' | 'mixed' | 'all',
): Result => {
  let state = newGame(seed, 0, { mode: 'journey', level: id, moveLimit, profile });
  let steps = 0;
  while (!state.over && steps < moveLimit) {
    const options: { piece: number; row: number; col: number; value: number }[] = [];
    for (let piece = 0; piece < state.tray.length; piece++) {
      const shape = shapeById(state.tray[piece] ?? '');
      if (!shape) continue;
      for (const spot of placements(state.board, state.blocked, shape)) {
        const result = place(state, piece, spot.row, spot.col);
        if (!result.ok) continue;
        const gained = result.state.score - state.score;
        const clear = result.state.lines - state.lines;
        const value =
          gained +
          clear * 140 +
          nearLines(result.state) * 12 -
          holes(result.state) * 8 -
          bumpiness(result.state) * 2;
        options.push({ piece, row: spot.row, col: spot.col, value });
      }
    }
    if (options.length === 0) {
      if (state.rescue > 0 && anyShapeFits(state)) {
        const helped = rescue(state);
        if (!helped.ok) break;
        state = helped.state;
        continue;
      }
      break;
    }
    options.sort((a, b) => b.value - a.value);
    const best = options[0];
    if (!best) break;
    const result = place(state, best.piece, best.row, best.col);
    if (!result.ok) break;
    state = result.state;
    steps++;
    if (goals.every((goal) => goalMet(state, goal))) break;
  }
  return {
    id,
    score: state.score,
    lines: state.lines,
    maxClear: state.maxClear,
    maxCombo: state.maxCombo,
    perfects: state.perfects,
    stars: starsFor(state, goals),
    moves: state.moves,
    completed: completed(state, goals),
  };
};

let failed = false;
for (const level of LEVELS) {
  const result = play(level.id, level.seed, level.goals, level.moveLimit, level.profile);
  const goals = level.goals
    .map((goal, index) => `${index === 0 ? '*' : ''}${goal.kind}:${goal.value}`)
    .join(' ');
  console.log(
    `${result.id.padEnd(5)} score ${String(result.score).padStart(5)} · lines ${String(result.lines).padStart(3)} · clear ${result.maxClear} · combo ${result.maxCombo} · perfect ${result.perfects} · moves ${result.moves}/${level.moveLimit} · stars ${result.stars}/3 ${result.completed ? 'OK' : 'FAIL'} · ${goals}`,
  );
  if (!result.completed) failed = true;
}

const date = todayId();
const daily = play(`daily-${date}`, dailySeed(date), DAILY_GOALS, DAILY_MOVES, 'all');
console.log(
  `${daily.id.padEnd(14)} score ${daily.score} · lines ${daily.lines} · clear ${daily.maxClear} · stars ${daily.stars}/3 ${daily.completed ? 'OK' : 'FAIL'}`,
);
if (!daily.completed) failed = true;

if (failed)
  throw new Error('a level is not completable by the greedy bot; tune its seed, goals or move limit');
