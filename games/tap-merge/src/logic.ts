// Chạm Ghép rules (SPEC.md). Pure: no DOM, no timers, no Math.random — the PRNG state lives in the game state,
// so a saved game resumes exactly and a seed + list of moves replays exactly. `tap` and `shuffle` return the new
// state and the events that happened, in order; the view animates those events and never decides rules itself.

export const COLS = 5;
export const ROWS = 7;
/** Shuffles a player can hold at once. */
export const MAX_SHUFFLES = 3;

/** A block is stored as its exponent: 1 → 2, 2 → 4, …. The board is always full, so there is no empty cell. */
export type Exponent = number;

export interface Cell {
  col: number;
  /** 0 is the bottom row. */
  row: number;
}

export interface State {
  version: 1;
  /** COLS × ROWS exponents, index = row * COLS + col. */
  grid: Exponent[];
  score: number;
  /** Best score before this game. */
  best: number;
  moves: number;
  /** 🔀 left. */
  shuffles: number;
  /** The largest block made in this game (a new one earns a shuffle). */
  top: Exponent;
  over: boolean;
  /** PRNG (mulberry32) state. */
  rng: number;
}

export interface Move {
  from: Cell;
  to: Cell;
  exp: Exponent;
}

export type GameEvent =
  | { type: 'merge'; into: Cell; from: Cell[]; exp: Exponent; gained: number }
  | { type: 'fall'; moves: Move[] }
  /** New blocks slide in from above the board, each falling `drop` cells into place. */
  | { type: 'fill'; blocks: { at: Cell; exp: Exponent; drop: number }[] }
  | { type: 'top'; exp: Exponent; shuffles: number; earned: boolean }
  | { type: 'shuffle'; moves: Move[]; shuffles: number }
  /** No equal neighbours anywhere: only 🔀 can go on. */
  | { type: 'stuck'; shuffles: number }
  | { type: 'over'; score: number; best: number; record: boolean };

export type TapResult =
  | { ok: true; state: State; events: GameEvent[] }
  | { ok: false; reason: 'no_match' | 'game_over' | 'no_such_cell' };

export type ShuffleResult =
  | { ok: true; state: State; events: GameEvent[] }
  | { ok: false; reason: 'not_stuck' | 'no_shuffles' | 'game_over' };

export const blockValue = (exp: Exponent) => 2 ** exp;
export const indexOf = ({ col, row }: Cell) => row * COLS + col;
export const cellAt = (index: number): Cell => ({ col: index % COLS, row: Math.floor(index / COLS) });
const inside = ({ col, row }: Cell) =>
  Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < COLS && row >= 0 && row < ROWS;

/** One step of mulberry32: a float in [0, 1) and the next state. */
export function random(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const SPAWN_WEIGHTS = [6, 5, 4, 3, 2, 1];

/**
 * New blocks: exponents 1 … K, weighted towards small ones, with K = clamp(M − 3, 3, 6) where M is the largest
 * exponent on the board. At the start that is 2, 4 and 8; from a 512 on, up to 64.
 */
export function spawn(grid: readonly Exponent[], rng: number): [Exponent, number] {
  const largest = Math.max(0, ...grid);
  const weights = SPAWN_WEIGHTS.slice(0, Math.min(6, Math.max(3, largest - 3)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const [r, nextRng] = random(rng);
  let pick = r * total;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick < 0) return [i + 1, nextRng];
  }
  return [weights.length, nextRng];
}

/**
 * Which cells count as neighbours: all 8 around a block (sideways, up, down and diagonal), as the owner asked.
 * This one choice sets how long a game lasts (SPEC.md, "Game length"): with only the 4 straight directions a game
 * is about 260 taps instead of about 3,000.
 */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** The cells around a cell, in a fixed order (bottom-left first). */
export function around({ col, row }: Cell): Cell[] {
  return DIRECTIONS.map(([dc, dr]) => ({ col: col + dc, row: row + dr })).filter(inside);
}

/** The blocks a tap on `cell` would absorb: its equal neighbours. */
export function matches(grid: readonly Exponent[], cell: Cell): Cell[] {
  const exp = grid[indexOf(cell)];
  return around(cell).filter((n) => grid[indexOf(n)] === exp);
}

/** Whether any block has an equal neighbour. */
export const hasMove = (grid: readonly Exponent[]) =>
  grid.some((_, index) => matches(grid, cellAt(index)).length > 0);

/** A full board, redrawn until it has a move (a fresh game never starts stuck). */
export function newGame(seed: number, best = 0): State {
  let rng = seed >>> 0;
  let grid: Exponent[] = [];
  do {
    grid = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const [exp, next] = spawn(grid, rng);
      grid.push(exp);
      rng = next;
    }
  } while (!hasMove(grid));
  return {
    version: 1,
    grid,
    score: 0,
    best,
    moves: 0,
    shuffles: 1,
    top: Math.max(...grid),
    over: false,
    rng,
  };
}

/** Pull every block down to fill holes (0 = hole); returns the moves made. */
function gravity(grid: Exponent[]): Move[] {
  const moves: Move[] = [];
  for (let col = 0; col < COLS; col++) {
    let target = 0;
    for (let row = 0; row < ROWS; row++) {
      const exp = grid[indexOf({ col, row })] ?? 0;
      if (exp === 0) continue;
      if (row !== target) {
        grid[indexOf({ col, row: target })] = exp;
        grid[indexOf({ col, row })] = 0;
        moves.push({ from: { col, row }, to: { col, row: target }, exp });
      }
      target++;
    }
  }
  return moves;
}

/** End of a move: stuck (only 🔀 helps), over, or nothing to say. */
function settle(state: State, events: GameEvent[]): State {
  if (hasMove(state.grid)) return state;
  if (state.shuffles > 0) {
    events.push({ type: 'stuck', shuffles: state.shuffles });
    return state;
  }
  const record = state.score > state.best;
  const best = Math.max(state.best, state.score);
  events.push({ type: 'over', score: state.score, best, record });
  return { ...state, over: true, best };
}

/** Tap a block: its equal neighbours merge into it and it doubles; the board falls and refills from the top. */
export function tap(state: State, cell: Cell): TapResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  if (!inside(cell)) return { ok: false, reason: 'no_such_cell' };
  const same = matches(state.grid, cell);
  if (same.length === 0) return { ok: false, reason: 'no_match' };

  const grid = [...state.grid];
  const events: GameEvent[] = [];
  const exp = (grid[indexOf(cell)] ?? 0) + 1;
  for (const n of same) grid[indexOf(n)] = 0;
  grid[indexOf(cell)] = exp;
  const gained = blockValue(exp) * same.length;
  events.push({ type: 'merge', into: cell, from: same, exp, gained });

  const moves = gravity(grid);
  if (moves.length > 0) events.push({ type: 'fall', moves });

  // Holes are now at the top of their columns. Fill them column by column, bottom-up (a fixed order keeps replays
  // deterministic); a column with n holes drops its new blocks n cells, from above the board.
  let rng = state.rng;
  const filled: { at: Cell; exp: Exponent; drop: number }[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[indexOf({ col, row })] !== 0) continue;
      const [value, next] = spawn(grid, rng);
      rng = next;
      grid[indexOf({ col, row })] = value;
      filled.push({ at: { col, row }, exp: value, drop: 0 });
    }
  }
  for (const block of filled) block.drop = filled.filter((b) => b.at.col === block.at.col).length;
  events.push({ type: 'fill', blocks: filled });

  let { shuffles, top } = state;
  if (exp > top) {
    top = exp;
    const earned = shuffles < MAX_SHUFFLES;
    if (earned) shuffles++;
    events.push({ type: 'top', exp, shuffles, earned });
  }

  const next = settle(
    { ...state, grid, score: state.score + gained, moves: state.moves + 1, shuffles, top, rng },
    events,
  );
  return { ok: true, state: next, events };
}

/**
 * 🔀 when the board is stuck: the blocks swap places at random, and if that still leaves no move, one block is
 * moved next to an equal one. Only allowed when stuck, so a child cannot waste the rescue.
 */
export function shuffle(state: State): ShuffleResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  if (hasMove(state.grid)) return { ok: false, reason: 'not_stuck' };
  if (state.shuffles === 0) return { ok: false, reason: 'no_shuffles' };

  // Fisher–Yates over the cell indexes: order[to] = from.
  let rng = state.rng;
  const order = Array.from({ length: COLS * ROWS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const [r, next] = random(rng);
    rng = next;
    const j = Math.floor(r * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  let grid = order.map((from) => state.grid[from] as Exponent);

  if (!hasMove(grid)) {
    // A board holds far more blocks than different values, so some value appears twice: put its second block
    // next to its first one.
    const first = new Map<Exponent, number>();
    for (let index = 0; index < grid.length; index++) {
      const exp = grid[index] as Exponent;
      const twin = first.get(exp);
      if (twin === undefined) {
        first.set(exp, index);
        continue;
      }
      const target = indexOf(around(cellAt(twin))[0] as Cell);
      const swapped = [...grid];
      [swapped[target], swapped[index]] = [swapped[index] as number, swapped[target] as number];
      [order[target], order[index]] = [order[index] as number, order[target] as number];
      grid = swapped;
      break;
    }
  }

  const moves: Move[] = order.flatMap((from, to) =>
    from === to ? [] : [{ from: cellAt(from), to: cellAt(to), exp: grid[to] as Exponent }],
  );
  const shuffles = state.shuffles - 1;
  const events: GameEvent[] = [{ type: 'shuffle', moves, shuffles }];
  const next = settle({ ...state, grid, shuffles, rng }, events);
  return { ok: true, state: next, events };
}

/** Whether the game waits for 🔀. */
export const isStuck = (state: State) => !state.over && !hasMove(state.grid) && state.shuffles > 0;

/** Every block with its cell, for rendering a whole board at once (start, resume). */
export function blocks(grid: readonly Exponent[]): { cell: Cell; exp: Exponent }[] {
  return grid.map((exp, index) => ({ cell: cellAt(index), exp }));
}

/** Accepts only a structurally valid saved game (saves come from storage and may be old or corrupted). */
export function restore(saved: unknown): State | null {
  if (typeof saved !== 'object' || saved === null) return null;
  const s = saved as Partial<State>;
  const ints = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  if (
    s.version !== 1 ||
    !Array.isArray(s.grid) ||
    s.grid.length !== COLS * ROWS ||
    !s.grid.every((e) => ints(e) && e >= 1 && e <= 40) ||
    ![s.score, s.best, s.moves, s.shuffles, s.top, s.rng].every(ints) ||
    (s.shuffles ?? 0) > MAX_SHUFFLES ||
    typeof s.over !== 'boolean'
  ) {
    return null;
  }
  const state = s as State;
  // A game that can no longer go on is over, whatever the save says.
  return !state.over && state.shuffles === 0 && !hasMove(state.grid) ? { ...state, over: true } : state;
}
