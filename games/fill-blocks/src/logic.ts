// Lấp Ô rules (SPEC.md). Pure: no DOM, no timers, no Math.random — the PRNG state lives in the game state, so a
// saved game resumes exactly and a fixed seed gives the same trays on every device. `place` returns the new state
// and the events that happened; the play stage only animates them.
import { bounds, isLarge, SHAPES, type Shape, shapeById } from './content/shapes.ts';

export const SIZE = 8;
export const TRAY = 3;
export const MAX_COMBO = 5;
export const PERFECT_BONUS = 300;
export const RESCUE_FIRST = 1000;
export const RESCUE_STEP = 2000;
export const MAX_RESCUE = 2;

export type Mode = 'endless' | 'journey' | 'daily';
export type PieceProfile = 'small' | 'mixed' | 'all';
export type GoalKind = 'score' | 'lines' | 'clear' | 'combo' | 'perfect';

export interface Goal {
  readonly kind: GoalKind;
  readonly value: number;
}

export interface State {
  readonly version: 1;
  /** SIZE × SIZE cells: 0 empty, 1 … 8 a colour index. */
  board: number[];
  /** SIZE × SIZE: 1 is a hole in the board. */
  blocked: number[];
  /** 1 … 3 shape ids. */
  tray: string[];
  score: number;
  /** Best score before this game. */
  best: number;
  moves: number;
  lines: number;
  combo: number;
  maxCombo: number;
  maxClear: number;
  perfects: number;
  over: boolean;
  /** PRNG (mulberry32) state. */
  rng: number;
  /** The seed the game started from, so a fixed level is reproducible. */
  seed: number;
  /** How many Đổi khay are left. */
  rescue: number;
  /** The score at which the next Đổi khay is earned. */
  nextRescue: number;
  mode: Mode;
  level: string | null;
  /** A journey/daily level's move limit; null for endless. */
  moveLimit: number | null;
  /** The piece bag this game draws from; a level keeps its own profile when the tray refills. */
  profile: PieceProfile;
}

export interface CellFill {
  row: number;
  col: number;
  colour: number;
}

export type GameEvent =
  | { type: 'place'; piece: string; cells: CellFill[] }
  | {
      type: 'clear';
      rows: number[];
      cols: number[];
      cells: CellFill[];
      lines: number;
      gained: number;
      combo: number;
      perfect: boolean;
    }
  | { type: 'draw'; tray: string[] }
  | { type: 'rescue'; tray: string[]; left: number }
  | { type: 'over'; score: number; best: number; record: boolean };

export type PlaceError = 'game_over' | 'no_piece' | 'no_fit';

export interface NewGameOptions {
  mode?: Mode;
  level?: string | null;
  moveLimit?: number | null;
  profile?: PieceProfile;
  blocked?: readonly number[];
}

const indexOf = (row: number, col: number) => row * SIZE + col;

/** One step of mulberry32: a float in [0, 1) and the next state. */
export function random(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const fitsAt = (
  board: readonly number[],
  blocked: readonly number[],
  shape: Shape,
  row: number,
  col: number,
) => {
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    const index = indexOf(r, c);
    if (blocked[index] === 1 || board[index] !== 0) return false;
  }
  return true;
};

export interface Placement {
  row: number;
  col: number;
}

/** Every top-left position where the shape fits. */
export function placements(board: readonly number[], blocked: readonly number[], shape: Shape): Placement[] {
  const { rows, cols } = bounds(shape);
  const out: Placement[] = [];
  for (let row = 0; row <= SIZE - rows; row++) {
    for (let col = 0; col <= SIZE - cols; col++) {
      if (fitsAt(board, blocked, shape, row, col)) out.push({ row, col });
    }
  }
  return out;
}

export const anyShapeFits = (state: Pick<State, 'board' | 'blocked'>): boolean =>
  SHAPES.some((shape) => placements(state.board, state.blocked, shape).length > 0);

export const anyPieceFits = (state: Pick<State, 'board' | 'blocked' | 'tray'>): boolean =>
  state.tray.some((id) => {
    const shape = shapeById(id);
    return shape !== undefined && placements(state.board, state.blocked, shape).length > 0;
  });

const weightOf = (shape: Shape, profile: PieceProfile, score: number): number => {
  const late = Math.min(1, score / 3000);
  const size = shape.cells.length;
  if (profile === 'small') {
    if (size === 1) return 0.5;
    if (size === 2) return 14;
    if (size === 3) return 12;
    if (size === 4) return 2.5;
    return 0;
  }
  if (profile === 'mixed') {
    if (size === 1) return 0.5;
    if (size === 2) return 12;
    if (size === 3) return 11;
    if (size === 4) return 3.5;
    if (size === 5) return 0.5;
    return 0.1;
  }
  if (size === 1) return 0.5;
  if (size === 2) return 12;
  if (size === 3) return 11;
  if (size === 4) return 3 + late * 3;
  if (size === 5) return 0.25 + late * 2;
  return 0.05 + late * 0.7;
};

const SMALL = SHAPES.filter((shape) => shape.cells.length <= 4);

/** One weighted draw, with the helpful-draw guarantee and at most one large piece early. */
export function drawTray(
  board: readonly number[],
  blocked: readonly number[],
  rng: number,
  score: number,
  profile: PieceProfile = 'all',
): { tray: string[]; rng: number } {
  let nextRng = rng;
  const weights = SHAPES.map((shape) => weightOf(shape, profile, score));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const pick = (): Shape => {
    const [r, after] = random(nextRng);
    nextRng = after;
    let point = r * total;
    for (let i = 0; i < SHAPES.length; i++) {
      point -= weights[i] ?? 0;
      if (point < 0) return SHAPES[i] as Shape;
    }
    return SHAPES[SHAPES.length - 1] as Shape;
  };
  const tray: Shape[] = [pick(), pick(), pick()];

  // A child's first chapter should not open with two 5-cell/3 × 3 pieces.
  if (score < 500) {
    let largeSeen = false;
    for (let i = 0; i < tray.length; i++) {
      const shape = tray[i] as Shape;
      if (!isLarge(shape)) continue;
      if (!largeSeen) {
        largeSeen = true;
        continue;
      }
      const [r, after] = random(nextRng);
      nextRng = after;
      tray[i] = SMALL[Math.floor(r * SMALL.length)] as Shape;
    }
  }

  // Helpful draw: while any shape fits, a fresh tray has at least one piece that fits.
  const fitting = SHAPES.filter((shape) => placements(board, blocked, shape).length > 0);
  const haveFit = tray.some((shape) => placements(board, blocked, shape).length > 0);
  if (fitting.length > 0 && !haveFit) {
    const smallest = fitting.reduce((min, shape) => Math.min(min, shape.cells.length), Infinity);
    const choices = fitting.filter((shape) => shape.cells.length === smallest);
    const [r, after] = random(nextRng);
    nextRng = after;
    tray[TRAY - 1] = choices[Math.floor(r * choices.length)] as Shape;
  }

  return { tray: tray.map((shape) => shape.id), rng: nextRng };
}

const normaliseBlocked = (blocked: readonly number[] | undefined): number[] => {
  const out = new Array<number>(SIZE * SIZE).fill(0);
  if (!blocked) return out;
  for (let i = 0; i < SIZE * SIZE; i++) out[i] = blocked[i] === 1 ? 1 : 0;
  return out;
};

export function newGame(seed: number, best = 0, options: NewGameOptions = {}): State {
  const start = seed >>> 0;
  const blocked = normaliseBlocked(options.blocked);
  const board = new Array<number>(SIZE * SIZE).fill(0);
  const drawn = drawTray(board, blocked, start, 0, options.profile ?? 'all');
  return {
    version: 1,
    board,
    blocked,
    tray: drawn.tray,
    score: 0,
    best,
    moves: 0,
    lines: 0,
    combo: 1,
    maxCombo: 1,
    maxClear: 0,
    perfects: 0,
    over: false,
    rng: drawn.rng,
    seed: start,
    rescue: 0,
    nextRescue: RESCUE_FIRST,
    mode: options.mode ?? 'endless',
    level: options.level ?? null,
    moveLimit: options.moveLimit ?? null,
    profile: options.profile ?? 'all',
  };
}

const fullRows = (board: readonly number[], blocked: readonly number[]): number[] => {
  const rows: number[] = [];
  for (let row = 0; row < SIZE; row++) {
    let full = true;
    for (let col = 0; col < SIZE; col++) {
      const index = indexOf(row, col);
      if (blocked[index] === 0 && board[index] === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(row);
  }
  return rows;
};

const fullCols = (board: readonly number[], blocked: readonly number[]): number[] => {
  const cols: number[] = [];
  for (let col = 0; col < SIZE; col++) {
    let full = true;
    for (let row = 0; row < SIZE; row++) {
      const index = indexOf(row, col);
      if (blocked[index] === 0 && board[index] === 0) {
        full = false;
        break;
      }
    }
    if (full) cols.push(col);
  }
  return cols;
};

const emptyBoard = (board: readonly number[], blocked: readonly number[]): boolean => {
  for (let i = 0; i < board.length; i++) {
    if (blocked[i] === 0 && board[i] !== 0) return false;
  }
  return true;
};

/** The state after a placement, without drawing a new tray: used by the hint and the bot. */
function outcome(
  board: readonly number[],
  blocked: readonly number[],
  shape: Shape,
  row: number,
  col: number,
  combo: number,
): { board: number[]; lines: number; gained: number; perfect: boolean; cells: CellFill[] } {
  const next = [...board];
  const cells: CellFill[] = [];
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    const index = indexOf(r, c);
    next[index] = shape.colour;
    cells.push({ row: r, col: c, colour: shape.colour });
  }
  const rows = fullRows(next, blocked);
  const cols = fullCols(next, blocked);
  const cleared = new Set<number>();
  for (const line of rows) for (let c = 0; c < SIZE; c++) cleared.add(indexOf(line, c));
  for (const line of cols) for (let r = 0; r < SIZE; r++) cleared.add(indexOf(r, line));
  for (const index of cleared) next[index] = 0;
  const lines = rows.length + cols.length;
  const gained = lines > 0 ? 10 * lines * lines * combo : 0;
  const perfect = lines > 0 && emptyBoard(next, blocked);
  return { board: next, lines, gained, perfect, cells };
}

export type PlaceResult = { ok: true; state: State; events: GameEvent[] } | { ok: false; reason: PlaceError };

export function place(state: State, pieceIndex: number, row: number, col: number): PlaceResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  const id = state.tray[pieceIndex];
  const shape = id === undefined ? undefined : shapeById(id);
  if (!shape) return { ok: false, reason: 'no_piece' };
  if (!fitsAt(state.board, state.blocked, shape, row, col)) return { ok: false, reason: 'no_fit' };

  const played = outcome(state.board, state.blocked, shape, row, col, state.combo);
  const board = played.board;
  const score = state.score + shape.cells.length + played.gained + (played.perfect ? PERFECT_BONUS : 0);
  const combo = played.lines > 0 ? Math.min(MAX_COMBO, state.combo + 1) : Math.max(1, state.combo - 1);
  const perfects = state.perfects + (played.perfect ? 1 : 0);
  const lines = state.lines + played.lines;
  const maxCombo = Math.max(state.maxCombo, combo);
  const maxClear = Math.max(state.maxClear, played.lines);
  const moves = state.moves + 1;

  let rescue = state.rescue;
  let nextRescue = state.nextRescue;
  if (score >= nextRescue && rescue < MAX_RESCUE) {
    rescue++;
    nextRescue += RESCUE_STEP;
  }
  if (played.perfect && rescue < MAX_RESCUE) rescue++;

  const tray = state.tray.filter((_, index) => index !== pieceIndex);
  let rng = state.rng;
  const events: GameEvent[] = [{ type: 'place', piece: shape.id, cells: played.cells }];
  if (played.lines > 0) {
    const cleared = new Set<number>();
    // The view gets the cleared cells from the played board before it was emptied: recompute the same lines.
    const before = [...state.board];
    for (const [dr, dc] of shape.cells) before[indexOf(row + dr, col + dc)] = shape.colour;
    const rows = fullRows(before, state.blocked);
    const cols = fullCols(before, state.blocked);
    const cells: CellFill[] = [];
    for (const line of rows) for (let c = 0; c < SIZE; c++) cleared.add(indexOf(line, c));
    for (const line of cols) for (let r = 0; r < SIZE; r++) cleared.add(indexOf(r, line));
    for (const index of cleared) {
      const colour = before[index] ?? 0;
      if (colour !== 0) cells.push({ row: Math.floor(index / SIZE), col: index % SIZE, colour });
    }
    events.push({
      type: 'clear',
      rows,
      cols,
      cells,
      lines: played.lines,
      gained: played.gained,
      combo: state.combo,
      perfect: played.perfect,
    });
  }

  if (tray.length === 0) {
    const drawn = drawTray(board, state.blocked, rng, score, state.profile);
    tray.push(...drawn.tray);
    rng = drawn.rng;
    events.push({ type: 'draw', tray: [...tray] });
  }

  const stuck = !tray.some((piece) => {
    const pieceShape = shapeById(piece);
    return pieceShape !== undefined && placements(board, state.blocked, pieceShape).length > 0;
  });
  const over = (state.moveLimit !== null && moves >= state.moveLimit) || (stuck && rescue === 0);
  const next: State = {
    ...state,
    board,
    tray,
    score,
    moves,
    lines,
    combo,
    maxCombo,
    maxClear,
    perfects,
    over,
    rng,
    rescue,
    nextRescue,
  };
  if (over) events.push({ type: 'over', score, best: state.best, record: score > state.best });
  return { ok: true, state: next, events };
}

export type RescueResult =
  | { ok: true; state: State; events: GameEvent[] }
  | { ok: false; reason: 'not_stuck' | 'none_left' | 'no_shape' | 'game_over' };

export function rescue(state: State): RescueResult {
  if (state.over) return { ok: false, reason: 'game_over' };
  if (anyPieceFits(state)) return { ok: false, reason: 'not_stuck' };
  if (!anyShapeFits(state)) return { ok: false, reason: 'no_shape' };
  if (state.rescue <= 0) return { ok: false, reason: 'none_left' };
  const drawn = drawTray(state.board, state.blocked, state.rng, state.score, state.profile);
  const left = state.rescue - 1;
  const stuck = !drawn.tray.some((piece) => {
    const shape = shapeById(piece);
    return shape !== undefined && placements(state.board, state.blocked, shape).length > 0;
  });
  const over = stuck && left === 0;
  const next: State = { ...state, tray: drawn.tray, rng: drawn.rng, rescue: left, over };
  const events: GameEvent[] = [{ type: 'rescue', tray: [...drawn.tray], left }];
  if (over)
    events.push({ type: 'over', score: state.score, best: state.best, record: state.score > state.best });
  return { ok: true, state: next, events };
}

/** Marks a journey/daily level as finished when its goals are met before a move limit. */
export const finish = (state: State): State => ({ ...state, over: true });

export interface Hint {
  pieceIndex: number;
  row: number;
  col: number;
}

/** A good first placement: the one that clears the most, then the largest piece. */
export function hint(state: State): Hint | null {
  let best: Hint | null = null;
  let bestScore = -Infinity;
  for (let pieceIndex = 0; pieceIndex < state.tray.length; pieceIndex++) {
    const shape = shapeById(state.tray[pieceIndex] ?? '');
    if (!shape) continue;
    for (const spot of placements(state.board, state.blocked, shape)) {
      const played = outcome(state.board, state.blocked, shape, spot.row, spot.col, state.combo);
      const value = played.lines * 1000 + shape.cells.length * 10 + (played.perfect ? 5000 : 0);
      if (value > bestScore) {
        bestScore = value;
        best = { pieceIndex, row: spot.row, col: spot.col };
      }
    }
  }
  return best;
}

export const goalMet = (state: State, goal: Goal): boolean => {
  switch (goal.kind) {
    case 'score':
      return state.score >= goal.value;
    case 'lines':
      return state.lines >= goal.value;
    case 'clear':
      return state.maxClear >= goal.value;
    case 'combo':
      return state.maxCombo >= goal.value;
    case 'perfect':
      return state.perfects >= goal.value;
  }
};

export const starsFor = (state: State, goals: readonly Goal[]): number =>
  goals.reduce((stars, goal) => stars + (goalMet(state, goal) ? 1 : 0), 0);

export const completed = (state: State, goals: readonly Goal[]): boolean =>
  goals.length > 0 && goalMet(state, goals[0] as Goal);

/** Validates a saved state; a damaged save starts a new game instead of throwing. */
export function restore(value: unknown): State | null {
  const state = value as Partial<State> | null | undefined;
  if (!state || state.version !== 1) return null;
  if (!Array.isArray(state.board) || state.board.length !== SIZE * SIZE) return null;
  if (!Array.isArray(state.blocked) || state.blocked.length !== SIZE * SIZE) return null;
  if (!Array.isArray(state.tray) || state.tray.length < 1 || state.tray.length > TRAY) return null;
  if (!state.tray.every((id) => typeof id === 'string' && shapeById(id) !== undefined)) return null;
  const int = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!int(state.score) || !int(state.best) || !int(state.moves) || !int(state.lines)) return null;
  if (!int(state.combo) || !int(state.maxCombo) || !int(state.maxClear) || !int(state.perfects)) return null;
  if (!int(state.rng) || !int(state.seed) || !int(state.rescue) || !int(state.nextRescue)) return null;
  if (typeof state.over !== 'boolean') return null;
  if (state.mode !== 'endless' && state.mode !== 'journey' && state.mode !== 'daily') return null;
  if (state.level !== null && typeof state.level !== 'string') return null;
  if (state.moveLimit !== null && !int(state.moveLimit)) return null;
  if (state.profile !== 'small' && state.profile !== 'mixed' && state.profile !== 'all') return null;
  return {
    version: 1,
    board: state.board.map((cell) => (Number.isFinite(cell) ? cell : 0)),
    blocked: state.blocked.map((cell) => (cell === 1 ? 1 : 0)),
    tray: [...state.tray],
    score: state.score,
    best: state.best,
    moves: state.moves,
    lines: state.lines,
    combo: Math.min(MAX_COMBO, Math.max(1, state.combo)),
    maxCombo: Math.max(1, state.maxCombo),
    maxClear: state.maxClear,
    perfects: state.perfects,
    over: state.over,
    rng: state.rng >>> 0,
    seed: state.seed >>> 0,
    rescue: Math.min(MAX_RESCUE, Math.max(0, state.rescue)),
    nextRescue: state.nextRescue,
    mode: state.mode,
    level: state.level ?? null,
    moveLimit: state.moveLimit ?? null,
    profile: state.profile,
  };
}
