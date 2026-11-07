// Ghép Khối rules (SPEC.md, 3.0.0). Pure: no DOM, no timers, no Math.random — the PRNG state lives in the game state,
// so a saved game resumes exactly and a seed + list of shots replays exactly. `fire` returns the new state and the
// events that happened, in order; the view animates those events and never decides rules itself.
//
// Four modes share the 2.0.1 machine. Cổ điển is the ranked classic; Ca làm adds three orders and per-run parts;
// Ca hôm nay is the classic on a local-date seed; Thư giãn has no pressure and no jam. The mode-specific fields are
// absent from the classic state, so the ranked replay of the classic is bit-for-bit the old game.

export const COLS = 5;
export const ROWS = 7;
/** The base pressure max; Bình áp adds 2 each. */
export const PRESSURE_MAX = 8;
/** A block this large (256) or larger leaves through the top chute in Cổ điển/Ca hôm nay/Thư giãn. */
export const SHIP_EXP = 8;
const SHIP_MULTIPLIER = 3;
const PULSE_MULTIPLIER = 2;
const ORDER_REWARDS = [4, 6, 10];

/** A block is stored as its exponent: 1 → 2, 2 → 4, …; 0 is an empty cell. */
export type Exponent = number;

export type Mode = 'classic' | 'orders' | 'daily' | 'zen';
export const MODES: readonly Mode[] = ['classic', 'orders', 'daily', 'zen'];
export const isMode = (value: unknown): value is Mode =>
  typeof value === 'string' && MODES.includes(value as Mode);

export type PartId = 'tank' | 'chute' | 'lube' | 'gear';
export const PART_IDS: readonly PartId[] = ['tank', 'chute', 'lube', 'gear'];
export const isPartId = (value: unknown): value is PartId =>
  typeof value === 'string' && PART_IDS.includes(value as PartId);

/** One order of a Ca làm run: ship `count` blocks of at least 2^exp. */
export interface Order {
  exp: Exponent;
  count: number;
  done: number;
}

/** The three first orders: a 16, two 32s, a 64. */
export const ORDERS: readonly Order[] = [
  { exp: 4, count: 1, done: 0 }, // a 16
  { exp: 5, count: 2, done: 0 }, // two 32s
  { exp: 6, count: 1, done: 0 }, // a 64
];

export interface Cell {
  col: number;
  /** 0 is the bottom row; ROWS − 1 is the ceiling. */
  row: number;
}

export interface State {
  version: 3;
  mode: Mode;
  /** COLS × ROWS exponents, index = row * COLS + col. */
  grid: Exponent[];
  current: Exponent;
  next: Exponent;
  score: number;
  /** The best score before this run of this mode. */
  best: number;
  moves: number;
  over: boolean;
  /** PRNG (mulberry32) state. */
  rng: number;
  /** The seed the game started from, so the same blocks can be dealt again ("Thách bạn", ADR 0045). */
  seed?: number;
  /** The machine's pressure, 0 … the mode's max. A full gauge shakes it once the shot has settled. */
  pressure: number;
  /** How many blocks the chute has taken this run. */
  shipped: number;
  /** The largest block shipped, as its exponent (0 before the first). */
  biggestShipped: Exponent;
  /** Ca làm: the three orders of this run. */
  orders?: Order[];
  /** Ca làm: the order in play. */
  orderIndex?: number;
  /** Ca làm: the parts taken this run. */
  parts?: PartId[];
  /** Ca làm: the parts the Workshop has unlocked for this run (the offer pool). */
  unlocked?: PartId[];
  /** Ca làm: the 1-of-3 offer after a completed order. */
  offer?: PartId[];
  /** Ca làm: an order completed; the next shot waits for the part choice. */
  choice?: boolean;
  /** Ca làm: the scrap earned this run. */
  scrap?: number;
  /** The run's XP at the end (score/100). */
  xp?: number;
  /** How the run ended, when it did. */
  ended?: 'jam' | 'clock_out' | null;
  /** Ca hôm nay: the local date the seed came from. */
  daily?: { date: string };
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
  | {
      type: 'order';
      index: number;
      exp: Exponent;
      count: number;
      done: number;
      complete: boolean;
      scrap: number;
    }
  | { type: 'next'; current: Exponent; next: Exponent }
  | { type: 'over'; score: number; best: number; record: boolean };

export type FireResult =
  | { ok: true; state: State; events: GameEvent[] }
  | { ok: false; reason: 'column_full' | 'game_over' | 'choose_part' | 'no_such_column' };

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

/** The parts taken this run, counted. */
export const partCount = (state: State, part: PartId): number =>
  state.parts?.filter((taken) => taken === part).length ?? 0;

/** The gauge's max: 8, +2 for every Bình áp. */
export const pressureMax = (state: State): number => PRESSURE_MAX + 2 * partCount(state, 'tank');
/** How much one merge adds to the gauge: 1, +1 for every Dầu. */
export const pressureGain = (state: State): number => 1 + partCount(state, 'lube');
/** The shake's score multiplier: 2, +1 for every Bánh răng. */
export const pulseMultiplier = (state: State): number => PULSE_MULTIPLIER + partCount(state, 'gear');
/** The order in play, or null (not Ca làm, or the orders are done). */
export const currentOrder = (state: State): Order | null =>
  state.mode === 'orders' ? (state.orders?.[state.orderIndex ?? 0] ?? null) : null;
/**
 * The exponent a block at the ceiling must reach to be shipped. Cổ điển/Ca hôm nay/Thư giãn: 8 (256). Ca làm: the
 * current order's value, one lower for every Cửa xưởng, at least 16; after the last order, 256 again.
 */
export const shipExp = (state: State): number => {
  if (state.mode !== 'orders') return SHIP_EXP;
  const order = currentOrder(state);
  const base = order?.exp ?? SHIP_EXP;
  return Math.max(1, base - partCount(state, 'chute'));
};

export interface NewGameOptions {
  /** Ca làm: the orders (defaults to ORDERS). */
  orders?: readonly Order[];
  /** Ca làm: the parts the Workshop has unlocked (defaults to Bình áp + Cửa xưởng). */
  unlocked?: readonly PartId[];
  /** Ca hôm nay: the local date the seed came from. */
  dailyDate?: string;
}

export function newGame(seed: number, best = 0, mode: Mode = 'classic', options: NewGameOptions = {}): State {
  const grid = new Array<Exponent>(COLS * ROWS).fill(0);
  const start = seed >>> 0;
  const [current, rng1] = spawn(grid, start);
  const [next, rng2] = spawn(grid, rng1);
  const state: State = {
    version: 3,
    mode,
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
    ended: null,
  };
  if (mode === 'orders') {
    state.orders = (options.orders ?? ORDERS).map((order) => ({ ...order, done: 0 }));
    state.orderIndex = 0;
    state.parts = [];
    state.unlocked = [...(options.unlocked ?? ['tank', 'chute'])];
    state.offer = [];
    state.choice = false;
    state.scrap = 0;
    state.xp = 0;
  }
  if (mode === 'daily') state.daily = { date: options.dailyDate ?? '1970-01-01' };
  return state;
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
 * ceiling's blocks of `chute` or more leave after the merges; `gained` covers both.
 */
function mergeRound(
  grid: Exponent[],
  active: Cell[],
  source: 'shot' | 'pulse',
  combo: number,
  multiplier: number,
  chute: number,
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
    if (exp < chute) continue;
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

/** The 1-of-3 offer: three parts from the unlocked pool (repeats while fewer than three are unlocked). */
export function offerParts(unlocked: readonly PartId[], rng: number): [PartId[], number] {
  const pool = unlocked.length > 0 ? [...unlocked] : (['tank', 'chute'] as PartId[]);
  const parts: PartId[] = [];
  let nextRng = rng;
  for (let i = 0; i < 3; i++) {
    const [r, next] = random(nextRng);
    nextRng = next;
    parts.push(pool[Math.floor(r * pool.length)] ?? pool[0] ?? 'tank');
  }
  return [parts, nextRng];
}

/** The scrap a shipped block is worth: its value / 16, at least 1. */
const shipScrap = (exp: Exponent) => Math.max(1, Math.floor(blockValue(exp) / 16));

export function fire(state: State, col: number): FireResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  if (state.choice) return { ok: false, reason: 'choose_part' };
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: 'no_such_column' };
  const row = landingRow(state.grid, col);
  if (row === null) return { ok: false, reason: 'column_full' };

  const grid = [...state.grid];
  let score = state.score;
  let pressure = state.pressure;
  let shipped = state.shipped;
  let biggestShipped = state.biggestShipped;
  let scrap = state.scrap ?? 0;
  let rng = state.rng;
  let choice: boolean = state.choice ?? false;
  let offer = state.offer ? [...state.offer] : undefined;
  const orders = state.orders?.map((order) => ({ ...order }));
  const orderIndex = state.orderIndex ?? 0;
  const gain = pressureGain(state);
  const maxPressure = pressureMax(state);
  const multiplier = pulseMultiplier(state);
  const chute = shipExp(state);
  const events: GameEvent[] = [];

  // A completed order pauses the run until the player picks a part.
  const orderShips = (ships: ShipEvent[]) => {
    if (state.mode !== 'orders' || !orders) return;
    for (const ship of ships) {
      const order = orders[orderIndex];
      if (!order || order.done >= order.count || ship.exp < order.exp) continue;
      order.done++;
      if (order.done >= order.count) {
        order.done = order.count;
        const reward = ORDER_REWARDS[orderIndex] ?? 0;
        scrap += reward;
        events.push({
          type: 'order',
          index: orderIndex,
          exp: order.exp,
          count: order.count,
          done: order.done,
          complete: true,
          scrap: reward,
        });
        if (!choice) {
          choice = true;
          [offer, rng] = offerParts(state.unlocked ?? ['tank', 'chute'], rng);
        }
      } else {
        events.push({
          type: 'order',
          index: orderIndex,
          exp: order.exp,
          count: order.count,
          done: order.done,
          complete: false,
          scrap: 0,
        });
      }
    }
  };

  const landed: Cell = { col, row };
  grid[indexOf(landed)] = state.current;
  events.push({ type: 'land', at: landed, exp: state.current });

  /** Resolve merges, the chute and gravity-up until nothing changes. Returns how many merges the chain made. */
  const runChain = (first: Cell[], source: 'shot' | 'pulse', multiplierForChain: number): number => {
    let active = first;
    let combo = 1;
    let mergeCount = 0;
    while (active.length > 0) {
      const round = mergeRound(grid, active, source, combo, multiplierForChain, chute);
      if (round.merges.length === 0 && round.ships.length === 0) break;
      events.push(...round.merges, ...round.ships);
      score += round.gained;
      mergeCount += round.merges.length;
      for (const ship of round.ships) {
        shipped++;
        biggestShipped = Math.max(biggestShipped, ship.exp);
        scrap += shipScrap(ship.exp);
      }
      orderShips(round.ships);
      const moves = gravity(grid);
      if (moves.length > 0) events.push({ type: 'fall', moves });
      const moved = new Map(moves.map((move) => [indexOf(move.from), move.to]));
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
  if (shotMerges > 0 && state.mode !== 'zen') {
    pressure = Math.min(maxPressure, pressure + shotMerges * gain);
    events.push({ type: 'pressure', value: pressure, max: maxPressure });
  }

  if (pressure >= maxPressure && state.mode !== 'zen') {
    const slides = slide(grid);
    events.push({ type: 'pulse', slides });
    pressure = 0;
    events.push({ type: 'pressure', value: 0, max: maxPressure });
    runChain(occupied(grid), 'pulse', multiplier);
  }

  const [upcoming, nextRng] = spawn(grid, rng);
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
    rng: nextRng,
    ...(state.mode === 'orders' ? { orders, orderIndex, offer, choice } : {}),
    ...(state.mode === 'zen' ? {} : { scrap, xp: Math.floor(score / 100) }),
  };
  if (state.mode !== 'zen' && isFull(grid)) {
    next.over = true;
    next.ended = 'jam';
    const record = score > state.best;
    next.best = Math.max(state.best, score);
    events.push({ type: 'over', score, best: next.best, record });
  } else {
    events.push({ type: 'next', current: next.current, next: next.next });
  }
  return { ok: true, state: next, events };
}

/** Picks one of the offered parts; null when there is no choice or the part is not offered. */
export function choosePart(state: State, part: PartId): State | null {
  if (!state.choice || !state.offer?.includes(part)) return null;
  const orderIndex = (state.orderIndex ?? 0) + 1;
  return {
    ...state,
    parts: [...(state.parts ?? []), part],
    orderIndex,
    choice: false,
    offer: [],
  };
}

/** Ca làm only: clock out after the last order, banking the run; null when it cannot. */
export function clockOut(state: State): { state: State; events: GameEvent[] } | null {
  if (state.mode !== 'orders' || state.over) return null;
  if ((state.orderIndex ?? 0) < (state.orders?.length ?? 0)) return null;
  const score = state.score;
  const record = score > state.best;
  const next: State = {
    ...state,
    over: true,
    ended: 'clock_out',
    best: Math.max(state.best, score),
    xp: Math.floor(score / 100),
  };
  return { state: next, events: [{ type: 'over', score, best: next.best, record }] };
}

/**
 * A ranked run played again from its seed (ADR 0030, 0032): the state after its first `upTo` shots, or why shot `at`
 * is not a legal column. The verify module judges runs with it and the replay stage shows them with it. It is the
 * classic mode; the new modes are unranked and never reach the server.
 */
export function replayMoves(
  seed: number,
  moves: readonly unknown[],
  upTo = moves.length,
  best = 0,
): { state: State } | { error: string; at: number } {
  let state = newGame(seed, best, 'classic');
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
  const s = saved as Partial<Omit<State, 'version'>> & { version?: number };
  const ints = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  const baseOk =
    Array.isArray(s.grid) &&
    s.grid.length === COLS * ROWS &&
    s.grid.every((e) => ints(e) && e <= 40) &&
    [s.current, s.next, s.score, s.best, s.moves, s.rng, s.pressure, s.shipped, s.biggestShipped].every(
      ints,
    ) &&
    (s.biggestShipped as number) <= 40 &&
    typeof s.over === 'boolean';
  if (!baseOk) return null;
  if (s.version === 2) {
    // The 2.0.1 classic save upgrades in place: the mode fields are classic/none.
    const { version: _v2, ...rest } = s;
    return {
      ...(rest as Omit<State, 'version' | 'mode'>),
      version: 3,
      mode: 'classic',
      ended: null,
    };
  }
  if (s.version !== 3 || !isMode(s.mode)) return null;
  const mode = s.mode;
  const max = PRESSURE_MAX + 2 * (s.parts?.filter((part) => part === 'tank').length ?? 0);
  if ((s.pressure as number) > max) return null;
  if (mode === 'orders') {
    if (
      !Array.isArray(s.orders) ||
      s.orders.length === 0 ||
      !s.orders.every(
        (order) =>
          Number.isInteger(order?.exp) &&
          order.exp >= 1 &&
          order.exp <= 40 &&
          Number.isInteger(order.count) &&
          order.count >= 1 &&
          Number.isInteger(order.done) &&
          order.done >= 0 &&
          order.done <= order.count,
      ) ||
      !ints(s.orderIndex) ||
      (s.orderIndex as number) > (s.orders?.length ?? 0) ||
      !Array.isArray(s.parts) ||
      !s.parts.every(isPartId) ||
      !Array.isArray(s.unlocked) ||
      s.unlocked.length === 0 ||
      !s.unlocked.every(isPartId) ||
      !Array.isArray(s.offer) ||
      !s.offer.every(isPartId) ||
      typeof s.choice !== 'boolean' ||
      !ints(s.scrap) ||
      !ints(s.xp) ||
      (s.ended !== null && s.ended !== undefined && s.ended !== 'jam' && s.ended !== 'clock_out')
    ) {
      return null;
    }
  } else if (s.orders !== undefined || s.parts !== undefined || s.choice !== undefined) {
    return null;
  }
  if (mode === 'daily') {
    if (typeof s.daily?.date !== 'string' || s.daily.date.length === 0) return null;
  } else if (s.daily !== undefined) {
    return null;
  }
  // A start seed that is not one is dropped: the game plays on, without a challenge to offer.
  if (s.seed !== undefined && !(ints(s.seed) && (s.seed as number) <= 0xffffffff)) {
    const { seed: _dropped, ...rest } = s;
    return rest as State;
  }
  return s as State;
}
