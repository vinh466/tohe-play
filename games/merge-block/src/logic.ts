// Ghép Khối rules (SPEC.md). Pure: no DOM, no timers, no Math.random — the PRNG state lives in the game state,
// so a saved game resumes exactly and a seed + list of shots replays exactly. `fire` returns the new state and the
// events that happened, in order; the view animates those events and never decides rules itself.

export const COLS = 5;
export const ROWS = 7;
/** The machine shakes when the gauge reaches this. A shot's merge adds 1; the shake's own merges add none. */
export const PRESSURE_MAX = 8;
/** A block this large (256) or larger leaves through the top chute when it rests on the ceiling. */
export const SHIP_EXP = 8;
const SHIP_MULTIPLIER = 3;
const PULSE_MULTIPLIER = 2;

/** A block is stored as its exponent: 1 → 2, 2 → 4, …; 0 is an empty cell. */
export type Exponent = number;

export interface Cell {
  col: number;
  /** 0 is the bottom row; ROWS − 1 is the ceiling. */
  row: number;
}

export interface State {
  version: 2;
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
  /**
   * The seed the game started from, so the same blocks can be dealt again ("Thách bạn", ADR 0045). Games saved before
   * 1.11.0 have none, and offer no challenge.
   */
  seed?: number;
  /** The machine's pressure, 0 … PRESSURE_MAX. A full gauge shakes it once the shot has settled. */
  pressure: number;
  /** How many blocks the chute has taken this game. */
  shipped: number;
  /** The largest block shipped, as its exponent (0 before the first). */
  biggestShipped: Exponent;
}

export type GameEvent =
  | { type: 'land'; at: Cell; exp: Exponent }
  | {
      type: 'merge';
      into: Cell;
      from: Cell[];
      exp: Exponent;
      gained: number;
      combo: number;
      source: 'shot' | 'pulse';
    }
  | { type: 'fall'; moves: { from: Cell; to: Cell; exp: Exponent }[] }
  | { type: 'pressure'; value: number; max: number }
  | { type: 'pulse'; slides: { from: Cell; to: Cell; exp: Exponent }[] }
  | { type: 'ship'; at: Cell; exp: Exponent; gained: number }
  | { type: 'next'; current: Exponent; next: Exponent }
  | { type: 'over'; score: number; best: number; record: boolean };

export type FireResult =
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
  const start = seed >>> 0;
  const [current, rng1] = spawn(grid, start);
  const [next, rng2] = spawn(grid, rng1);
  return {
    version: 2,
    grid,
    current,
    next,
    score: 0,
    best,
    moves: 0,
    over: false,
    rng: rng2,
    seed: start,
    pressure: 0,
    shipped: 0,
    biggestShipped: 0,
  };
}

/**
 * The row a block fired into `col` lands on: just below the lowest block of the column, or the ceiling when the
 * column is empty. A block in row 0 blocks the column; null then.
 */
export function landingRow(grid: readonly Exponent[], col: number): number | null {
  for (let row = 0; row < ROWS; row++) {
    if (grid[indexOf({ col, row })] !== 0) return row === 0 ? null : row - 1;
  }
  return ROWS - 1;
}

/** No column can take a block: every column has a block in row 0. */
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

/** Pull every block up to the ceiling, filling holes; returns the moves made. */
function gravity(grid: Exponent[]): { from: Cell; to: Cell; exp: Exponent }[] {
  const moves: { from: Cell; to: Cell; exp: Exponent }[] = [];
  for (let col = 0; col < COLS; col++) {
    let target = ROWS - 1;
    for (let row = ROWS - 1; row >= 0; row--) {
      const exp = grid[indexOf({ col, row })] ?? 0;
      if (exp === 0) continue;
      if (row !== target) {
        grid[indexOf({ col, row: target })] = exp;
        grid[indexOf({ col, row })] = 0;
        moves.push({ from: { col, row }, to: { col, row: target }, exp });
      }
      target--;
    }
  }
  return moves;
}

/**
 * The machine's shake: every row's blocks slide toward the centre, keeping their left-to-right order. A gap between
 * two equal blocks can close; the blocks themselves keep their row.
 */
function slide(grid: Exponent[]): { from: Cell; to: Cell; exp: Exponent }[] {
  const moves: { from: Cell; to: Cell; exp: Exponent }[] = [];
  for (let row = 0; row < ROWS; row++) {
    const rowBlocks: { col: number; exp: Exponent }[] = [];
    for (let col = 0; col < COLS; col++) {
      const exp = grid[indexOf({ col, row })] ?? 0;
      if (exp !== 0) rowBlocks.push({ col, exp });
    }
    if (rowBlocks.length === 0) continue;
    const start = Math.floor((COLS - rowBlocks.length) / 2);
    for (let col = 0; col < COLS; col++) grid[indexOf({ col, row })] = 0;
    rowBlocks.forEach((block, i) => {
      const to = start + i;
      grid[indexOf({ col: to, row })] = block.exp;
      if (block.col !== to)
        moves.push({ from: { col: block.col, row }, to: { col: to, row }, exp: block.exp });
    });
  }
  return moves;
}

type MergeEvent = Extract<GameEvent, { type: 'merge' }>;
type ShipEvent = Extract<GameEvent, { type: 'ship' }>;

interface Round {
  merges: MergeEvent[];
  ships: ShipEvent[];
  gained: number;
}

/**
 * One round of merges over `active`, then the chute. A block takes part in at most one merge in the round. The
 * top row's blocks of SHIP_EXP or more leave after the merges; `gained` covers both.
 */
function mergeRound(
  grid: Exponent[],
  active: Cell[],
  source: 'shot' | 'pulse',
  combo: number,
  multiplier: number,
): Round {
  const used = new Set<number>();
  const merges: MergeEvent[] = [];
  const ships: ShipEvent[] = [];
  let gained = 0;

  // Bottom-up, left-to-right: a fixed order keeps replays deterministic.
  const ordered = [...active].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of ordered) {
    const index = indexOf(cell);
    if ((grid[index] ?? 0) === 0 || used.has(index)) continue;
    const exp = grid[index] as number;
    const same = neighbours(cell).filter((n) => {
      const i = indexOf(n);
      return !used.has(i) && grid[i] === exp;
    });
    if (same.length === 0) continue;
    for (const n of same) {
      grid[indexOf(n)] = 0;
      used.add(indexOf(n));
    }
    const result = exp + same.length;
    grid[index] = result;
    used.add(index);
    const value = blockValue(result) * combo * multiplier;
    gained += value;
    merges.push({ type: 'merge', into: cell, from: same, exp: result, gained: value, combo, source });
  }

  for (let col = 0; col < COLS; col++) {
    const at = { col, row: ROWS - 1 };
    const exp = grid[indexOf(at)] ?? 0;
    if (exp < SHIP_EXP) continue;
    grid[indexOf(at)] = 0;
    const value = blockValue(exp) * SHIP_MULTIPLIER;
    gained += value;
    ships.push({ type: 'ship', at, exp, gained: value });
  }

  return { merges, ships, gained };
}

/** The cells holding blocks, bottom-up and left-to-right (a deterministic order). */
function occupied(grid: readonly Exponent[]): Cell[] {
  return blocks(grid).map((block) => block.cell);
}

export function fire(state: State, col: number): FireResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: 'no_such_column' };
  const row = landingRow(state.grid, col);
  if (row === null) return { ok: false, reason: 'column_full' };

  const grid = [...state.grid];
  let score = state.score;
  let pressure = state.pressure;
  let shipped = state.shipped;
  let biggestShipped = state.biggestShipped;
  const events: GameEvent[] = [];

  const landed: Cell = { col, row };
  grid[indexOf(landed)] = state.current;
  events.push({ type: 'land', at: landed, exp: state.current });

  /** Resolve merges, the chute and gravity-up until nothing changes. Returns how many merges the chain made. */
  const runChain = (first: Cell[], source: 'shot' | 'pulse', multiplier: number): number => {
    let active = first;
    let combo = 1;
    let mergeCount = 0;
    while (active.length > 0) {
      const round = mergeRound(grid, active, source, combo, multiplier);
      if (round.merges.length === 0 && round.ships.length === 0) break;
      events.push(...round.merges, ...round.ships);
      score += round.gained;
      mergeCount += round.merges.length;
      for (const ship of round.ships) {
        shipped++;
        biggestShipped = Math.max(biggestShipped, ship.exp);
      }
      const moves = gravity(grid);
      if (moves.length > 0) events.push({ type: 'fall', moves });
      const moved = new Map(moves.map((m) => [indexOf(m.from), m.to]));
      const next = new Map<number, Cell>();
      for (const merge of round.merges) {
        const at = moved.get(indexOf(merge.into)) ?? merge.into;
        if ((grid[indexOf(at)] ?? 0) > 0) next.set(indexOf(at), at);
      }
      for (const move of moves) {
        if ((grid[indexOf(move.to)] ?? 0) > 0) next.set(indexOf(move.to), move.to);
      }
      active = [...next.values()];
      if (round.merges.length > 0) combo++;
    }
    return mergeCount;
  };

  const shotMerges = runChain([landed], 'shot', 1);
  if (shotMerges > 0) {
    pressure = Math.min(PRESSURE_MAX, pressure + shotMerges);
    events.push({ type: 'pressure', value: pressure, max: PRESSURE_MAX });
  }

  if (pressure >= PRESSURE_MAX) {
    const slides = slide(grid);
    events.push({ type: 'pulse', slides });
    pressure = 0;
    events.push({ type: 'pressure', value: 0, max: PRESSURE_MAX });
    runChain(occupied(grid), 'pulse', PULSE_MULTIPLIER);
  }

  const [upcoming, rng] = spawn(grid, state.rng);
  const next: State = {
    ...state,
    grid,
    score,
    pressure,
    shipped,
    biggestShipped,
    current: state.next,
    next: upcoming,
    moves: state.moves + 1,
    rng,
  };
  if (isFull(grid)) {
    next.over = true;
    const record = score > state.best;
    next.best = Math.max(state.best, score);
    events.push({ type: 'over', score, best: next.best, record });
  } else {
    events.push({ type: 'next', current: next.current, next: next.next });
  }
  return { ok: true, state: next, events };
}

/**
 * A ranked run played again from its seed (ADR 0030, 0032): the state after its first `upTo` shots, or why shot `at`
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
    const result = fire(state, col);
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
    s.version !== 2 ||
    !Array.isArray(s.grid) ||
    s.grid.length !== COLS * ROWS ||
    !s.grid.every((e) => ints(e) && e <= 40) ||
    ![s.current, s.next, s.score, s.best, s.moves, s.rng, s.pressure, s.shipped, s.biggestShipped].every(
      ints,
    ) ||
    (s.pressure as number) > PRESSURE_MAX ||
    (s.biggestShipped as number) > 40 ||
    typeof s.over !== 'boolean'
  ) {
    return null;
  }
  // A start seed that is not one is dropped: the game plays on, without a challenge to offer.
  if (s.seed !== undefined && !(ints(s.seed) && (s.seed as number) <= 0xffffffff)) {
    const { seed: _dropped, ...rest } = s;
    return rest as State;
  }
  return s as State;
}
