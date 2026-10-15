// Cards and combinations of Tiến lên miền Nam (SPEC.md, "Cards", "Combinations", "A hand" step 6). Pure functions,
// shared by the referee (rules.ts), the bots and the view's hints.

/** 0–51: rank = card >> 2 (0 = 3 … 11 = A, 12 = 2), suit = card & 3 (♠ ♣ ♦ ♥). A higher number is a higher card. */
export type Card = number;

export const DECK = 52;
export const ACE = 11;
export const TWO = 12;
/** 3♠, the lowest card. */
export const THREE_SPADES = 0;

export const rankOf = (card: Card) => card >> 2;
export const suitOf = (card: Card) => card & 3;
export const cardOf = (rank: number, suit: number): Card => rank * 4 + suit;
export const isRed = (card: Card) => suitOf(card) >= 2;

export type Kind = 'single' | 'pair' | 'triple' | 'straight' | 'pairs' | 'quad';

export interface Combo {
  kind: Kind;
  /** Ascending. */
  cards: Card[];
  /** The highest card, which decides comparisons. */
  top: Card;
  /** Ranks spanned: the length of a straight, the number of pairs of a double straight, 1 otherwise. */
  ranks: number;
}

/** House rules that change what beats what (SPEC.md, H9). */
export interface BeatRules {
  pairsBeatTwoPair: boolean;
}

const ascending = (a: number, b: number) => a - b;

function make(kind: Kind, cards: Card[], ranks: number): Combo {
  const sorted = [...cards].sort(ascending);
  return { kind, cards: sorted, top: sorted[sorted.length - 1] as Card, ranks };
}

/** The combination `cards` form, or null if they form none (or are not distinct cards of the deck). */
export function classify(cards: readonly Card[]): Combo | null {
  const n = cards.length;
  if (n === 0 || new Set(cards).size !== n) return null;
  if (!cards.every((card) => Number.isInteger(card) && card >= 0 && card < DECK)) return null;
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(rankOf(card), (counts.get(rankOf(card)) ?? 0) + 1);
  const ranks = [...counts.keys()].sort(ascending);
  if (ranks.length === 1) {
    const kinds: (Kind | undefined)[] = [undefined, 'single', 'pair', 'triple', 'quad'];
    const kind = kinds[n];
    return kind ? make(kind, [...cards], 1) : null;
  }
  const consecutive = ranks.every((rank, i) => i === 0 || rank === (ranks[i - 1] as number) + 1);
  if (!consecutive || (ranks[ranks.length - 1] as number) >= TWO) return null;
  if (n >= 3 && ranks.length === n) return make('straight', [...cards], n);
  if (n >= 6 && ranks.length * 2 === n && [...counts.values()].every((count) => count === 2)) {
    return make('pairs', [...cards], ranks.length);
  }
  return null;
}

/** A single, pair or triple of 2s. */
export const isTwos = (combo: Combo) =>
  (combo.kind === 'single' || combo.kind === 'pair' || combo.kind === 'triple') && rankOf(combo.top) === TWO;

/** Tứ quý or a double straight of 3 or more pairs. */
export const isBomb = (combo: Combo) => combo.kind === 'quad' || combo.kind === 'pairs';

/** A double straight of 4 or more pairs: what may chop out of turn (H2). */
export const isBigPairs = (combo: Combo) => combo.kind === 'pairs' && combo.ranks >= 4;

/** Whether `play` may follow `table` (null: a lead, anything goes). */
export function beats(play: Combo, table: Combo | null, rules: BeatRules): boolean {
  if (!table) return true;
  if (play.kind === table.kind && play.cards.length === table.cards.length) return play.top > table.top;
  const big = isBigPairs(play);
  if (table.kind === 'single' && rankOf(table.top) === TWO)
    return play.kind === 'quad' || play.kind === 'pairs';
  if (table.kind === 'pair' && rankOf(table.top) === TWO) {
    return play.kind === 'quad' || big || (rules.pairsBeatTwoPair && play.kind === 'pairs');
  }
  if (table.kind === 'pairs' && table.ranks === 3) return play.kind === 'quad' || big;
  if (table.kind === 'quad') return big;
  return false;
}

/** A bomb on 2s or on a bomb: a chop (chặt), worth the value of what it beat. */
export const isChop = (play: Combo, table: Combo | null) =>
  table !== null && isBomb(play) && (isTwos(table) || isBomb(table));

/** Points of a 2 (black 1, red 2) and of bombs (SPEC.md, "Points"). */
export const twoValue = (card: Card) => (isRed(card) ? 2 : 1);

export function comboValue(combo: Combo): number {
  if (isTwos(combo)) return combo.cards.reduce((sum, card) => sum + twoValue(card), 0);
  if (combo.kind === 'quad') return rankOf(combo.top) === TWO ? 6 : 3;
  if (combo.kind === 'pairs') return combo.ranks >= 4 ? 4 : 2;
  return 0;
}

/** Cards grouped by rank, each group ascending. */
export function byRank(hand: readonly Card[]): Card[][] {
  const groups: Card[][] = Array.from({ length: 13 }, () => []);
  for (const card of [...hand].sort(ascending)) groups[rankOf(card)]?.push(card);
  return groups;
}

function choose<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of choose(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}

/**
 * The combinations in a hand worth considering. Straights and double straights take the lowest cards of every rank
 * except the top one, whose every option is tried: enough to beat anything a hand can beat, and the list stays small.
 */
export function combosIn(hand: readonly Card[]): Combo[] {
  const groups = byRank(hand);
  const out: Combo[] = [];
  groups.forEach((cards) => {
    for (const card of cards) out.push(make('single', [card], 1));
    for (const k of [2, 3] as const) {
      for (const set of choose(cards, k)) out.push(make(k === 2 ? 'pair' : 'triple', set, 1));
    }
    if (cards.length === 4) out.push(make('quad', cards, 1));
  });
  for (let start = 0; start < TWO; start++) {
    const base: Card[] = [];
    for (let rank = start; rank < TWO && (groups[rank]?.length ?? 0) > 0; rank++) {
      const cards = groups[rank] as Card[];
      if (rank - start >= 2)
        for (const top of cards) out.push(make('straight', [...base, top], base.length + 1));
      base.push(cards[0] as Card);
    }
  }
  for (let start = 0; start < TWO; start++) {
    const base: Card[] = [];
    for (let rank = start; rank < TWO && (groups[rank]?.length ?? 0) >= 2; rank++) {
      const cards = groups[rank] as Card[];
      if (rank - start >= 2) {
        for (const pair of choose(cards, 2)) out.push(make('pairs', [...base, ...pair], rank - start + 1));
      }
      base.push(cards[0] as Card, cards[1] as Card);
    }
  }
  return out;
}

/** The hand without `cards`. */
export const without = (hand: readonly Card[], cards: readonly Card[]) =>
  hand.filter((card) => !cards.includes(card));

/**
 * A hand split into combinations the way a sensible player sees it: bombs first (four of a kind, then the longest
 * double straights), 2s on their own, then the longest straights, triples, pairs and singles. Used by the bots and to
 * count what is left over (thối).
 */
export function split(hand: readonly Card[]): Combo[] {
  const out: Combo[] = [];
  let rest = [...hand].sort(ascending);
  const groups = byRank(rest);
  for (let rank = 0; rank < TWO; rank++) {
    const cards = groups[rank] as Card[];
    if (cards.length === 4) {
      out.push(make('quad', cards, 1));
      rest = without(rest, cards);
    }
  }
  for (const [kind, min, per] of [
    ['pairs', 3, 2],
    ['straight', 3, 1],
  ] as const) {
    for (;;) {
      const run = longestRun(rest, per, min);
      if (!run) break;
      out.push(make(kind, run, run.length / per));
      rest = without(rest, run);
    }
  }
  const twos = rest.filter((card) => rankOf(card) === TWO);
  if (twos.length === 4) out.push(make('quad', twos, 1));
  else for (const card of twos) out.push(make('single', [card], 1));
  rest = without(rest, twos);
  for (const cards of byRank(rest)) {
    if (cards.length === 0) continue;
    const kind: Kind = cards.length === 3 ? 'triple' : cards.length === 2 ? 'pair' : 'single';
    if (cards.length === 4) for (const card of cards) out.push(make('single', [card], 1));
    else out.push(make(kind, cards, 1));
  }
  return out;
}

/** The longest run of ranks (no 2) with `per` cards each, at least `min` ranks long: the lowest such cards. */
function longestRun(hand: readonly Card[], per: 1 | 2, min: number): Card[] | null {
  const groups = byRank(hand);
  let best: Card[] | null = null;
  for (let start = 0; start < TWO; start++) {
    const run: Card[] = [];
    for (let rank = start; rank < TWO && (groups[rank]?.length ?? 0) >= per; rank++) {
      run.push(...(groups[rank] as Card[]).slice(0, per));
    }
    if (run.length / per >= min && (!best || run.length > best.length)) best = run;
  }
  return best;
}

/** What a hand left at the end costs (thối, H4): its 2s one by one and its bombs. */
export function leftoverValue(hand: readonly Card[]): number {
  let value = 0;
  for (const card of hand) if (rankOf(card) === TWO) value += twoValue(card);
  for (const combo of split(hand.filter((card) => rankOf(card) !== TWO))) {
    if (isBomb(combo)) value += comboValue(combo);
  }
  return value;
}

/** Sorted by rank (the default) or grouped by the combinations `split` finds. */
export function sortHand(hand: readonly Card[], by: 'rank' | 'combos'): Card[] {
  if (by === 'rank') return [...hand].sort(ascending);
  const order: Kind[] = ['straight', 'pairs', 'triple', 'pair', 'single', 'quad'];
  const combos = split(hand).sort((a, b) => {
    const twos = Number(isTwos(a)) - Number(isTwos(b));
    if (twos !== 0) return twos;
    const bombs = Number(isBomb(a)) - Number(isBomb(b));
    if (bombs !== 0) return bombs;
    return (a.cards[0] as Card) - (b.cards[0] as Card) || order.indexOf(a.kind) - order.indexOf(b.kind);
  });
  return combos.flatMap((combo) => combo.cards);
}
