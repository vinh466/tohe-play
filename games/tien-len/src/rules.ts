// The Tiến lên referee (SPEC.md). Pure and deterministic: no DOM, timers, network or Math.random; the PRNG state
// lives in the state. The same code referees a hand against bots on the phone and, online, in the API
// (ADR 0016): `act` checks everything, so a caller can never put the game in a state the rules do not allow.
import {
  beats,
  byRank,
  type Card,
  type Combo,
  classify,
  combosIn,
  comboValue,
  DECK,
  isBigPairs,
  isBomb,
  isChop,
  isTwos,
  leftoverValue,
  TWO,
  without,
} from './cards.ts';

export type InstantWin = 'dragon' | 'fourTwos' | 'fivePairs' | 'sixPairs' | 'threeTriples';
/** In priority order, when several players are dealt one (SPEC.md, "House rules"). */
export const INSTANT_WINS: readonly InstantWin[] = [
  'dragon',
  'fourTwos',
  'fivePairs',
  'sixPairs',
  'threeTriples',
];

/** The house rules H1–H9 (SPEC.md). */
export interface Options {
  /** H1: the first lead must include 3♠ (or the lowest card). */
  firstLeadThree: boolean;
  /** H2: 4 đôi thông may chop out of turn, even after passing. */
  chopOutOfTurn: boolean;
  /** H3: chặt chồng, the last player chopped pays the whole chain. */
  chopChain: boolean;
  /** H4: thối, 2s and bombs left in hand at the end cost points. */
  leftovers: boolean;
  /** H5: cóng, a player who never played when someone goes out pays double. */
  cong: boolean;
  /** H6: the instant wins in play. */
  instantWins: InstantWin[];
  /** H7: the hand stops when the first player goes out. */
  endAtFirstOut: boolean;
  /** H8: places plus chops, thối and cóng (`full`), or places only. */
  points: 'full' | 'places';
  /** H9: 3 đôi thông beats a pair of 2s. */
  pairsBeatTwoPair: boolean;
}

export const DEFAULT_OPTIONS: Readonly<Options> = {
  firstLeadThree: true,
  chopOutOfTurn: true,
  chopChain: true,
  leftovers: true,
  cong: true,
  instantWins: ['dragon', 'fourTwos', 'fivePairs', 'sixPairs'],
  endAtFirstOut: false,
  points: 'full',
  pairsBeatTwoPair: false,
};

export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
export const HAND_SIZE = 13;

export type Action = { type: 'play'; cards: Card[] } | { type: 'pass' };

export type ActError =
  | 'over'
  | 'not_your_turn'
  | 'not_your_cards'
  | 'not_a_combo'
  | 'must_include'
  | 'must_beat'
  | 'must_lead'
  | 'passed';

/** One line of a hand's points: a place, or points paid by one player to another. */
export type Line =
  | { kind: 'place'; seat: number; points: number }
  | { kind: 'chop' | 'leftover' | 'cong' | 'instant'; from: number; to: number; points: number };

/** A chop in the current round: who chopped whom, and the value of what was beaten. */
export interface Chop {
  by: number;
  victim: number;
  value: number;
  /** Already paid (without H3); with H3 the chain is paid when the round ends. */
  paid: boolean;
}

export interface HandResult {
  /** Seats from first to last place: players who went out, then the ones left with cards, then cóng players. */
  ranking: number[];
  /** Points of the hand per seat; they sum to zero. */
  points: number[];
  lines: Line[];
  instant: { seat: number; win: InstantWin } | null;
  cong: number[];
}

export interface State {
  v: 1;
  seats: number;
  options: Options;
  /** The PRNG state after the deal; offline, the seed of the next hand. */
  rng: number;
  /** First-hand rules: the holder of 3♠ (or the lowest card) leads. */
  first: boolean;
  hands: Card[][];
  /** Cards played this hand, in order: public. */
  played: Card[];
  hasPlayed: boolean[];
  turn: number;
  table: Combo | null;
  /** Who played `table`; -1 when the table is clear. */
  tableBy: number;
  passed: boolean[];
  /** Players who played all their cards, in order. */
  finished: number[];
  cong: number[];
  mustInclude: Card | null;
  /** Chops of the current round. */
  chain: Chop[];
  /** Points of this hand so far (chops paid), then the whole hand's when it ends. */
  lines: Line[];
  instant: { seat: number; win: InstantWin } | null;
  over: boolean;
  result: HandResult | null;
  moves: number;
}

export type GameEvent =
  | { type: 'play'; seat: number; combo: Combo; chop: number; chain: number; outOfTurn: boolean }
  | { type: 'pass'; seat: number }
  | { type: 'round'; winner: number; leader: number }
  | { type: 'out'; seat: number; place: number }
  | { type: 'cong'; seats: number[] }
  | { type: 'paid'; line: Line }
  | { type: 'end'; result: HandResult };

export type ActResult = { ok: true; state: State; events: GameEvent[] } | { ok: false; error: ActError };

/** What the next hand needs from the last one: its winner leads, or null for first-hand rules. */
export interface Carry {
  leader: number | null;
}

// ------------------------------------------------------------------ randomness

/** mulberry32: one step returns a float in [0, 1) and the next state. */
export function random(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

function shuffled(rng: number): [Card[], number] {
  const deck = Array.from({ length: DECK }, (_, i) => i);
  let state = rng >>> 0;
  for (let i = DECK - 1; i > 0; i--) {
    const [r, next] = random(state);
    state = next;
    const j = Math.floor(r * (i + 1));
    [deck[i], deck[j]] = [deck[j] as Card, deck[i] as Card];
  }
  return [deck, state];
}

// ------------------------------------------------------------------ setup

export function normalizeOptions(input: unknown): Options {
  const o = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof Options, unknown>>;
  const flag = (key: keyof Options) =>
    typeof o[key] === 'boolean' ? (o[key] as boolean) : DEFAULT_OPTIONS[key];
  const wins = Array.isArray(o.instantWins)
    ? INSTANT_WINS.filter((win) => (o.instantWins as unknown[]).includes(win))
    : [...DEFAULT_OPTIONS.instantWins];
  return {
    firstLeadThree: flag('firstLeadThree') as boolean,
    chopOutOfTurn: flag('chopOutOfTurn') as boolean,
    chopChain: flag('chopChain') as boolean,
    leftovers: flag('leftovers') as boolean,
    cong: flag('cong') as boolean,
    instantWins: wins,
    endAtFirstOut: flag('endAtFirstOut') as boolean,
    points: o.points === 'places' ? 'places' : 'full',
    pairsBeatTwoPair: flag('pairsBeatTwoPair') as boolean,
  };
}

/** Deals a hand. `carry.leader` is the last hand's winner; without it, first-hand rules apply. */
export function setup(ctx: { seats: number; seed: number; options?: unknown; carry?: Carry | null }): State {
  const seats = Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.trunc(ctx.seats)));
  const options = normalizeOptions(ctx.options);
  const [deck, rng] = shuffled(ctx.seed);
  const hands = Array.from({ length: seats }, (_, s) =>
    deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE).sort((a, b) => a - b),
  );
  const leader = ctx.carry?.leader;
  const first = leader === null || leader === undefined || leader < 0 || leader >= seats;
  const lowest = Math.min(...hands.flat());
  const holder = hands.findIndex((hand) => hand.includes(lowest));
  const turn = first ? holder : (leader as number);
  const state: State = {
    v: 1,
    seats,
    options,
    rng,
    first,
    hands,
    played: [],
    hasPlayed: hands.map(() => false),
    turn,
    table: null,
    tableBy: -1,
    passed: hands.map(() => false),
    finished: [],
    cong: [],
    mustInclude: first && options.firstLeadThree ? lowest : null,
    chain: [],
    lines: [],
    instant: null,
    over: false,
    result: null,
    moves: 0,
  };
  // Tới trắng: checked from the player who would lead, in turn order (SPEC.md, "House rules").
  for (const win of INSTANT_WINS) {
    if (!options.instantWins.includes(win)) continue;
    for (let k = 0; k < seats; k++) {
      const seat = (turn + k) % seats;
      if (hasInstantWin(hands[seat] as Card[], win)) {
        state.instant = { seat, win };
        finish(state, []);
        return state;
      }
    }
  }
  return state;
}

export function hasInstantWin(hand: readonly Card[], win: InstantWin): boolean {
  const counts = byRank(hand).map((cards) => cards.length);
  const run = (length: number, min: number) => {
    for (let start = 0; start + length <= TWO; start++) {
      let ok = true;
      for (let rank = start; rank < start + length; rank++) if ((counts[rank] ?? 0) < min) ok = false;
      if (ok) return true;
    }
    return false;
  };
  switch (win) {
    case 'dragon':
      return run(TWO, 1);
    case 'fourTwos':
      return counts[TWO] === 4;
    case 'fivePairs':
      return run(5, 2);
    case 'sixPairs':
      return counts.reduce((pairs, count) => pairs + Math.floor(count / 2), 0) >= 6;
    case 'threeTriples':
      return run(3, 3);
  }
}

// ------------------------------------------------------------------ playing

const fail = (error: ActError): ActResult => ({ ok: false, error });

/** Still playing this hand: holds cards and is not cóng. */
export function inHand(state: Pick<State, 'hands' | 'cong'>, seat: number): boolean {
  return (state.hands[seat]?.length ?? 0) > 0 && !state.cong.includes(seat);
}

/** Whether `seat` may chop `combo` onto the table out of turn now (H2). */
export function mayChopOutOfTurn(
  state: Pick<State, 'options' | 'table' | 'tableBy' | 'over'>,
  seat: number,
  combo: Combo,
): boolean {
  const { table } = state;
  return (
    !state.over &&
    state.options.chopOutOfTurn &&
    table !== null &&
    seat !== state.tableBy &&
    isBigPairs(combo) &&
    (isTwos(table) || isBomb(table)) &&
    beats(combo, table, state.options)
  );
}

export function act(state: State, seat: number, action: Action): ActResult {
  if (state.over) return fail('over');
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.seats || !inHand(state, seat)) {
    return fail('not_your_turn');
  }
  if (action?.type === 'pass') {
    if (seat !== state.turn) return fail('not_your_turn');
    if (!state.table) return fail('must_lead');
    const next = clone(state);
    const events: GameEvent[] = [{ type: 'pass', seat }];
    next.passed[seat] = true;
    next.moves++;
    advance(next, seat, events);
    return { ok: true, state: next, events };
  }
  if (action?.type !== 'play' || !Array.isArray(action.cards)) return fail('not_a_combo');
  const hand = state.hands[seat] as Card[];
  if (!action.cards.every((card) => hand.includes(card))) return fail('not_your_cards');
  const combo = classify(action.cards);
  if (!combo) return fail('not_a_combo');
  const outOfTurn = seat !== state.turn;
  if (outOfTurn && !mayChopOutOfTurn(state, seat, combo)) {
    return fail(state.passed[seat] ? 'passed' : 'not_your_turn');
  }
  if (state.mustInclude !== null && !combo.cards.includes(state.mustInclude)) return fail('must_include');
  if (!beats(combo, state.table, state.options)) return fail('must_beat');

  const next = clone(state);
  const events: GameEvent[] = [];
  next.hands[seat] = without(hand, combo.cards);
  next.played.push(...combo.cards);
  next.hasPlayed[seat] = true;
  next.mustInclude = null;
  next.moves++;
  let chop = 0;
  if (isChop(combo, next.table)) {
    chop = comboValue(next.table as Combo);
    const victim = next.tableBy;
    const paid = next.options.points === 'full' && !next.options.chopChain;
    next.chain.push({ by: seat, victim, value: chop, paid });
    if (paid) pay(next, events, 'chop', victim, seat, chop);
  }
  next.table = combo;
  next.tableBy = seat;
  next.passed[seat] = false;
  events.push({ type: 'play', seat, combo, chop, chain: chop > 0 ? next.chain.length : 0, outOfTurn });
  if (next.hands[seat]?.length === 0) goOut(next, seat, events);
  const playing = activeSeats(next);
  if (playing.length <= 1 || (next.options.endAtFirstOut && next.finished.length > 0)) {
    finish(next, events);
  } else {
    advance(next, seat, events);
  }
  return { ok: true, state: next, events };
}

function activeSeats(state: State): number[] {
  return Array.from({ length: state.seats }, (_, s) => s).filter((s) => inHand(state, s));
}

function goOut(state: State, seat: number, events: GameEvent[]) {
  state.finished.push(seat);
  events.push({ type: 'out', seat, place: state.finished.length });
  if (state.finished.length !== 1 || !state.options.cong) return;
  const cong: number[] = [];
  for (let k = 1; k < state.seats; k++) {
    const other = (seat + k) % state.seats;
    if (inHand(state, other) && !state.hasPlayed[other]) cong.push(other);
  }
  if (cong.length === 0) return;
  state.cong.push(...cong);
  events.push({ type: 'cong', seats: cong });
}

/** The next player after `from` who is still in the hand and has not passed, or -1. */
function nextActive(state: State, from: number): number {
  for (let k = 1; k <= state.seats; k++) {
    const seat = (from + k) % state.seats;
    if (inHand(state, seat) && !state.passed[seat]) return seat;
  }
  return -1;
}

function advance(state: State, from: number, events: GameEvent[]) {
  const next = nextActive(state, from);
  if (next !== -1 && next !== state.tableBy) {
    state.turn = next;
    return;
  }
  // Everybody else passed: the round is won by the last player to play (SPEC.md, "A hand" step 8).
  const winner = state.tableBy;
  settleChain(state, events);
  let leader = winner;
  if (!inHand(state, leader)) {
    for (let k = 1; k <= state.seats; k++) {
      leader = (winner + k) % state.seats;
      if (inHand(state, leader)) break;
    }
  }
  state.table = null;
  state.tableBy = -1;
  state.passed = state.passed.map(() => false);
  state.turn = leader;
  events.push({ type: 'round', winner, leader });
}

/** H3: the last player chopped pays the chain's chops that are not paid yet to the last chopper. */
function settleChain(state: State, events: GameEvent[]) {
  const unpaid = state.chain.filter((chop) => !chop.paid);
  const last = unpaid[unpaid.length - 1];
  if (last && state.options.points === 'full') {
    const total = unpaid.reduce((sum, chop) => sum + chop.value, 0);
    pay(state, events, 'chop', last.victim, last.by, total);
  }
  state.chain = [];
}

function pay(
  state: State,
  events: GameEvent[],
  kind: 'chop' | 'leftover' | 'cong' | 'instant',
  from: number,
  to: number,
  points: number,
) {
  if (points <= 0 || from === to) return;
  const line: Line = { kind, from, to, points };
  state.lines.push(line);
  events.push({ type: 'paid', line });
}

/** Place points by number of players (SPEC.md, "Points"). */
const PLACES: Record<number, number[]> = { 2: [2, -2], 3: [3, -1, -2], 4: [2, 1, -1, -2] };

function finish(state: State, events: GameEvent[]) {
  settleChain(state, events);
  state.over = true;
  const n = state.seats;
  const full = state.options.points === 'full';
  if (state.instant) {
    const { seat } = state.instant;
    const others = Array.from({ length: n - 1 }, (_, k) => (seat + 1 + k) % n);
    for (const other of others) pay(state, events, 'instant', other, seat, 2);
    state.result = result(state, [seat, ...others]);
    events.push({ type: 'end', result: state.result });
    return;
  }
  const winner = state.finished[0] as number;
  // Players still holding cards (not cóng): fewer cards first, then turn order from the winner.
  const left = Array.from({ length: n - 1 }, (_, k) => (winner + 1 + k) % n)
    .filter((seat) => inHand(state, seat))
    .sort((a, b) => (state.hands[a]?.length ?? 0) - (state.hands[b]?.length ?? 0));
  const ranking = [...state.finished, ...left, ...state.cong];
  if (state.options.endAtFirstOut) {
    for (const seat of ranking.slice(1)) state.lines.push({ kind: 'place', seat, points: -2 });
    state.lines.push({ kind: 'place', seat: winner, points: 2 * (n - 1) });
  } else {
    const table = PLACES[n] as number[];
    ranking.forEach((seat, i) => {
      state.lines.push({ kind: 'place', seat, points: table[i] as number });
    });
  }
  if (full) {
    const lastPlace = 2;
    if (state.options.cong)
      for (const seat of state.cong) pay(state, events, 'cong', seat, winner, lastPlace);
    if (state.options.leftovers) {
      for (const seat of ranking) {
        const hand = state.hands[seat] as Card[];
        if (hand.length > 0) pay(state, events, 'leftover', seat, winner, leftoverValue(hand));
      }
    }
  }
  state.result = result(state, ranking);
  events.push({ type: 'end', result: state.result });
}

function result(state: State, ranking: number[]): HandResult {
  const points = Array.from({ length: state.seats }, () => 0);
  for (const line of state.lines) {
    if (line.kind === 'place') points[line.seat] = (points[line.seat] ?? 0) + line.points;
    else {
      points[line.from] = (points[line.from] ?? 0) - line.points;
      points[line.to] = (points[line.to] ?? 0) + line.points;
    }
  }
  return { ranking, points, lines: [...state.lines], instant: state.instant, cong: [...state.cong] };
}

function clone(state: State): State {
  return {
    ...state,
    options: { ...state.options, instantWins: [...state.options.instantWins] },
    hands: state.hands.map((hand) => [...hand]),
    played: [...state.played],
    hasPlayed: [...state.hasPlayed],
    passed: [...state.passed],
    finished: [...state.finished],
    cong: [...state.cong],
    chain: state.chain.map((chop) => ({ ...chop })),
    lines: state.lines.map((line) => ({ ...line })),
  };
}

// ------------------------------------------------------------------ what a seat sees

/** Everything one seat may know: its own hand, and what is public. `seat` null is a spectator. */
export interface View {
  seats: number;
  seat: number | null;
  hand: Card[];
  counts: number[];
  options: Options;
  first: boolean;
  played: Card[];
  hasPlayed: boolean[];
  turn: number;
  table: Combo | null;
  tableBy: number;
  passed: boolean[];
  finished: number[];
  cong: number[];
  mustInclude: Card | null;
  chain: Chop[];
  lines: Line[];
  instant: { seat: number; win: InstantWin } | null;
  over: boolean;
  result: HandResult | null;
  /** Every hand, once the hand is over (they are shown at the end). */
  revealed: Card[][] | null;
  moves: number;
}

export function view(state: State, seat: number | null): View {
  const own = seat !== null && seat >= 0 && seat < state.seats ? seat : null;
  return {
    seats: state.seats,
    seat: own,
    hand: own === null ? [] : [...(state.hands[own] as Card[])],
    counts: state.hands.map((hand) => hand.length),
    options: { ...state.options, instantWins: [...state.options.instantWins] },
    first: state.first,
    played: [...state.played],
    hasPlayed: [...state.hasPlayed],
    turn: state.turn,
    table: state.table,
    tableBy: state.tableBy,
    passed: [...state.passed],
    finished: [...state.finished],
    cong: [...state.cong],
    mustInclude: state.mustInclude,
    chain: state.chain.map((chop) => ({ ...chop })),
    lines: state.lines.map((line) => ({ ...line })),
    instant: state.instant,
    over: state.over,
    result: state.result,
    revealed: state.over ? state.hands.map((hand) => [...hand]) : null,
    moves: state.moves,
  };
}

/** The plays the view's seat may make now: on its turn, or an out-of-turn chop (H2). */
export function legalPlays(v: View): Combo[] {
  if (v.over || v.seat === null || v.hand.length === 0 || v.cong.includes(v.seat)) return [];
  const seat = v.seat;
  const combos = combosIn(v.hand);
  if (v.turn !== seat) return combos.filter((combo) => mayChopOutOfTurn(v, seat, combo));
  return combos.filter(
    (combo) =>
      (v.mustInclude === null || combo.cards.includes(v.mustInclude)) && beats(combo, v.table, v.options),
  );
}

/** Whether the view's seat may play these cards now, and why not. */
export function check(v: View, cards: readonly Card[]): ActError | null {
  if (v.over) return 'over';
  if (v.seat === null || !cards.every((card) => v.hand.includes(card))) return 'not_your_cards';
  const combo = classify(cards);
  if (!combo) return 'not_a_combo';
  if (v.turn !== v.seat) {
    if (mayChopOutOfTurn(v, v.seat, combo)) return null;
    return v.passed[v.seat] ? 'passed' : 'not_your_turn';
  }
  if (v.mustInclude !== null && !combo.cards.includes(v.mustInclude)) return 'must_include';
  if (!beats(combo, v.table, v.options)) return 'must_beat';
  return null;
}

/** Rebuilds a full state from a view and a guess of every hand (the hard bot's look-ahead). */
export function stateFrom(v: View, hands: Card[][], rng: number): State {
  return {
    v: 1,
    seats: v.seats,
    options: { ...v.options, instantWins: [...v.options.instantWins] },
    rng,
    first: v.first,
    hands: hands.map((hand) => [...hand]),
    played: [...v.played],
    hasPlayed: [...v.hasPlayed],
    turn: v.turn,
    table: v.table,
    tableBy: v.tableBy,
    passed: [...v.passed],
    finished: [...v.finished],
    cong: [...v.cong],
    mustInclude: v.mustInclude,
    chain: v.chain.map((chop) => ({ ...chop })),
    lines: v.lines.map((line) => ({ ...line })),
    instant: v.instant,
    over: v.over,
    result: v.result,
    moves: v.moves,
  };
}

/** What the turn timer plays (online): pass, or the lowest single when leading. */
export function timeoutAction(state: State, seat: number): Action {
  if (state.table) return { type: 'pass' };
  const lowest = state.mustInclude ?? Math.min(...(state.hands[seat] as Card[]));
  return { type: 'play', cards: [lowest] };
}

/** Seats that may chop out of turn now (H2). Server-side only: it reveals who holds 4 đôi thông. */
export function chopsNow(state: State): number[] {
  if (!state.table || state.over || !state.options.chopOutOfTurn) return [];
  return Array.from({ length: state.seats }, (_, s) => s).filter(
    (seat) =>
      seat !== state.turn &&
      inHand(state, seat) &&
      combosIn(state.hands[seat] as Card[]).some((combo) => mayChopOutOfTurn(state, seat, combo)),
  );
}

// ------------------------------------------------------------------ saves

/** A saved state, or null if it is not one this version can continue. */
export function restore(saved: unknown): State | null {
  if (!saved || typeof saved !== 'object') return null;
  const s = saved as State;
  const ints = (values: unknown) => Array.isArray(values) && values.every((v) => Number.isInteger(v));
  if (s.v !== 1 || !Number.isInteger(s.seats) || s.seats < MIN_SEATS || s.seats > MAX_SEATS) return null;
  if (!Array.isArray(s.hands) || s.hands.length !== s.seats || !s.hands.every(ints) || !ints(s.played))
    return null;
  const cards = [...s.hands.flat(), ...s.played];
  if (new Set(cards).size !== cards.length || cards.some((card) => card < 0 || card >= DECK)) return null;
  if (!Number.isInteger(s.turn) || s.turn < 0 || s.turn >= s.seats || !Number.isInteger(s.rng)) return null;
  if (!Array.isArray(s.passed) || !Array.isArray(s.hasPlayed) || !ints(s.finished) || !ints(s.cong))
    return null;
  if (s.table !== null && !classify(s.table?.cards ?? [])) return null;
  return { ...s, options: normalizeOptions(s.options), chain: s.chain ?? [], lines: s.lines ?? [] };
}
