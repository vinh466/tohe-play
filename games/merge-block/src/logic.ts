// Ghép Khối rules (SPEC.md). Pure: no DOM, no timers, no Math.random — the PRNG state lives in the game state,
// so a saved game resumes exactly and a seed + list of moves replays exactly. `drop` returns the new state and
// the events that happened, in order; the view animates those events and never decides rules itself.

export const COLS = 5;
export const ROWS = 7;

/** A block is stored as its exponent: 1 → 2, 2 → 4, …; 0 is an empty cell. */
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
  current: Exponent;
  next: Exponent;
  score: number;
  /** Best score before this game. */
  best: number;
  moves: number;
  over: boolean;
  /** PRNG (mulberry32) state. */
  rng: number;
}

export type GameEvent =
  | { type: 'land'; at: Cell; exp: Exponent }
  | { type: 'merge'; into: Cell; from: Cell[]; exp: Exponent; gained: number; combo: number }
  | { type: 'fall'; moves: { from: Cell; to: Cell; exp: Exponent }[] }
  | { type: 'next'; current: Exponent; next: Exponent }
  | { type: 'over'; score: number; best: number; record: boolean };

export type DropResult =
  | { ok: true; state: State; events: GameEvent[] }
  | { ok: false; reason: 'column_full' | 'game_over' | 'no_such_column' };

export const blockValue = (exp: Exponent) => 2 ** exp;
export const indexOf = ({ col, row }: Cell) => row * COLS + col;
const cellAt = (index: number): Cell => ({ col: index % COLS, row: Math.floor(index / COLS) });

/** One step of mulberry32: a float in [0, 1) and the next state. */
export function random(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const SPAWN_WEIGHTS = [6, 5, 4, 3, 2, 1];

/** New blocks: exponents 1 … min(M − 2, 6) where M is the largest exponent on the board (at least 3). */
export function spawn(grid: readonly Exponent[], rng: number): [Exponent, number] {
  const largest = Math.max(3, ...grid);
  const weights = SPAWN_WEIGHTS.slice(0, Math.max(1, Math.min(largest - 2, 6)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const [r, nextRng] = random(rng);
  let pick = r * total;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick < 0) return [i + 1, nextRng];
  }
  return [weights.length, nextRng];
}

export function newGame(seed: number, best = 0): State {
  const grid = new Array<Exponent>(COLS * ROWS).fill(0);
  const [current, rng1] = spawn(grid, seed >>> 0);
  const [next, rng2] = spawn(grid, rng1);
  return { version: 1, grid, current, next, score: 0, best, moves: 0, over: false, rng: rng2 };
}

/** The row a block dropped in `col` would land on, or null if the column is full. */
export function landingRow(grid: readonly Exponent[], col: number): number | null {
  for (let row = 0; row < ROWS; row++) if (grid[indexOf({ col, row })] === 0) return row;
  return null;
}

export const isFull = (grid: readonly Exponent[]) =>
  Array.from({ length: COLS }, (_, col) => landingRow(grid, col)).every((row) => row === null);

function neighbours({ col, row }: Cell): Cell[] {
  const around: Cell[] = [
    { col: col - 1, row },
    { col: col + 1, row },
    { col, row: row - 1 },
    { col, row: row + 1 },
  ];
  return around.filter((c) => c.col >= 0 && c.col < COLS && c.row >= 0 && c.row < ROWS);
}

/** Pull every block down to fill holes; returns the moves made. */
function gravity(grid: Exponent[]): { from: Cell; to: Cell; exp: Exponent }[] {
  const moves: { from: Cell; to: Cell; exp: Exponent }[] = [];
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

export function drop(state: State, col: number): DropResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: 'no_such_column' };
  const row = landingRow(state.grid, col);
  if (row === null) return { ok: false, reason: 'column_full' };

  const grid = [...state.grid];
  let score = state.score;
  const events: GameEvent[] = [];

  const landed: Cell = { col, row };
  grid[indexOf(landed)] = state.current;
  events.push({ type: 'land', at: landed, exp: state.current });

  // Resolve merges and gravity until nothing changes. Each round of merges is one combo level.
  let active: Cell[] = [landed];
  for (let combo = 1; active.length > 0; combo++) {
    const merged: Cell[] = [];
    // Bottom-up, left-to-right: a fixed order keeps replays deterministic.
    const ordered = [...active].sort((a, b) => a.row - b.row || a.col - b.col);
    for (const cell of ordered) {
      const exp = grid[indexOf(cell)] ?? 0;
      if (exp === 0) continue; // absorbed by an earlier merge this round
      const same = neighbours(cell).filter((n) => grid[indexOf(n)] === exp);
      if (same.length === 0) continue;
      for (const n of same) grid[indexOf(n)] = 0;
      const result = exp + same.length;
      grid[indexOf(cell)] = result;
      const gained = blockValue(result) * combo;
      score += gained;
      events.push({ type: 'merge', into: cell, from: same, exp: result, gained, combo });
      merged.push(cell);
    }
    if (merged.length === 0) break;

    const moves = gravity(grid);
    if (moves.length > 0) events.push({ type: 'fall', moves });
    // Next round: merged blocks (at their new place) and every block that moved.
    const moved = new Map(moves.map((m) => [indexOf(m.from), m.to]));
    const nextActive = new Map<number, Cell>();
    for (const cell of merged) {
      const at = moved.get(indexOf(cell)) ?? cell;
      nextActive.set(indexOf(at), at);
    }
    for (const m of moves) nextActive.set(indexOf(m.to), m.to);
    active = [...nextActive.values()].filter((cell) => (grid[indexOf(cell)] ?? 0) > 0);
  }

  const [upcoming, rng] = spawn(grid, state.rng);
  const next: State = {
    ...state,
    grid,
    score,
    current: state.next,
    next: upcoming,
    moves: state.moves + 1,
    rng,
  };
  events.push({ type: 'next', current: next.current, next: next.next });

  if (isFull(grid)) {
    next.over = true;
    const record = score > state.best;
    next.best = Math.max(state.best, score);
    events.push({ type: 'over', score, best: next.best, record });
  }
  return { ok: true, state: next, events };
}

/**
 * A ranked run played again from its seed (ADR 0030, 0032): the state after its first `upTo` moves, or why move `at`
 * is not a legal column. The verify module judges runs with it and the replay stage shows them with it, so the console
 * shows the game the server judged.
 */
export function replayMoves(
  seed: number,
  moves: readonly unknown[],
  upTo = moves.length,
  best = 0,
): { state: State } | { error: string; at: number } {
  let state = newGame(seed, best);
  for (let at = 0; at < Math.min(upTo, moves.length); at++) {
    const col = moves[at];
    if (typeof col !== 'number' || !Number.isInteger(col)) return { error: `move ${at} is not a column`, at };
    const result = drop(state, col);
    if (!result.ok) return { error: `move ${at}: ${result.reason}`, at };
    state = result.state;
  }
  return { state };
}

/** Cells holding blocks, for rendering a whole board at once (start, resume). */
export function blocks(grid: readonly Exponent[]): { cell: Cell; exp: Exponent }[] {
  return grid.flatMap((exp, index) => (exp > 0 ? [{ cell: cellAt(index), exp }] : []));
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
    !s.grid.every((e) => ints(e) && e <= 40) ||
    ![s.current, s.next, s.score, s.best, s.moves, s.rng].every(ints) ||
    typeof s.over !== 'boolean'
  ) {
    return null;
  }
  return s as State;
}
