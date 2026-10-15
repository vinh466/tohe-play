// Test helpers: cards written the way people say them ("3♠ 10♥ 2♦", or "3s 10h 2d"), and tables set up by hand.
import { type Card, cardOf } from './cards.ts';
import { DEFAULT_OPTIONS, type Options, type State } from './rules.ts';

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS: Record<string, number> = { '♠': 0, s: 0, '♣': 1, c: 1, '♦': 2, d: 2, '♥': 3, h: 3 };

export function c(text: string): Card {
  const suit = SUITS[text.slice(-1)];
  const rank = RANKS.indexOf(text.slice(0, -1).toUpperCase());
  if (suit === undefined || rank < 0) throw new Error(`not a card: ${text}`);
  return cardOf(rank, suit);
}

export const cs = (text: string): Card[] =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(c)
    .sort((a, b) => a - b);

/** A hand in progress with the given hands (seat 0 first), seat `turn` to play on a clear table. */
export function table(hands: string[], extra: Partial<State> = {}, options: Partial<Options> = {}): State {
  const parsed = hands.map(cs);
  const all = parsed.flat();
  if (new Set(all).size !== all.length) throw new Error('a card is dealt twice');
  return {
    v: 1,
    seats: hands.length,
    options: { ...DEFAULT_OPTIONS, instantWins: [...DEFAULT_OPTIONS.instantWins], ...options },
    rng: 1,
    first: false,
    hands: parsed,
    played: [],
    hasPlayed: hands.map(() => true),
    turn: 0,
    table: null,
    tableBy: -1,
    passed: hands.map(() => false),
    finished: [],
    cong: [],
    mustInclude: null,
    chain: [],
    lines: [],
    instant: null,
    over: false,
    result: null,
    moves: 0,
    ...extra,
  };
}
