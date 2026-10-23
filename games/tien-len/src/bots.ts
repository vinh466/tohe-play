// Bots (SPEC.md, "Bots"). They decide from their own seat's view: their hand, the table, card counts and the cards
// already played. Never from hidden cards, so a bot online (run by the API) knows no more than a player would.
import {
  ACE,
  type Card,
  type Combo,
  comboValue,
  DECK,
  isBomb,
  isChop,
  isTwos,
  rankOf,
  split,
  TWO,
  without,
} from './cards.ts';
import { type Action, act, legalPlays, random, type State, stateFrom, type View, view } from './rules.ts';

export type Level = 'easy' | 'normal' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'normal', 'hard'];
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

/**
 * Playouts the hard bot runs for one decision (SPEC.md, "Bots"): 40 plays as well as 160 against the normal bot and
 * costs about 50 ms in a phone's browser (scripts/simulate.ts).
 */
export const HARD_BUDGET = 40;

const play = (combo: Combo): Action => ({ type: 'play', cards: combo.cards });
const PASS: Action = { type: 'pass' };

/**
 * The bot's move for the view's seat: an action on its turn; out of turn, an H2 chop or null (it does nothing).
 * `seed` makes the choice reproducible.
 */
export function decide(v: View, level: Level, seed: number, budget = HARD_BUDGET): Action | null {
  if (v.over || v.seat === null) return null;
  const legal = legalPlays(v);
  const [r] = random(seed);
  if (v.turn !== v.seat) {
    // Out of turn only an H2 chop is legal: a sure gain, which only the easy bot sometimes misses.
    if (legal.length === 0 || (level === 'easy' && r < 0.5)) return null;
    return play(cheapest(legal));
  }
  if (legal.length === 0) return PASS;
  const out = legal.find((combo) => combo.cards.length === v.hand.length);
  if (out) return play(out);
  if (level === 'easy') {
    if (v.table && r < 0.2) return PASS;
    return play(legal[Math.floor(r * legal.length)] as Combo);
  }
  const ranked = rank(v, legal);
  if (level === 'normal' || ranked.length === 1) return ranked[0] as Action;
  return lookAhead(v, ranked.slice(0, 4), seed, budget);
}

function cheapest(combos: Combo[]): Combo {
  return combos.reduce((best, combo) => (combo.top < best.top ? combo : best));
}

/** How hard a hand is to get rid of: one per combination, more for low ones; 2s and bombs nearly free. */
export function burden(hand: readonly Card[]): number {
  let total = 0;
  for (const combo of split(hand)) {
    if (isTwos(combo)) total += 0.25 * combo.cards.length;
    else if (isBomb(combo)) total += 0.2;
    else total += 1 + (ACE - rankOf(combo.top)) / 24;
  }
  return total;
}

/** The normal bot's choices, best first (pass included when the table is not clear). Also the order of the Gợi ý hints. */
export function rank(v: View, legal: Combo[]): Action[] {
  const hand = v.hand;
  const seat = v.seat as number;
  const opponents = Array.from({ length: v.seats }, (_, s) => s).filter(
    (s) => s !== seat && v.counts[s] && !v.cong.includes(s),
  );
  const danger = opponents.some((s) => (v.counts[s] ?? 0) <= 2);
  const lastCard = opponents.some((s) => v.counts[s] === 1);
  const scored: { action: Action; score: number }[] = legal.map((combo) => {
    let score = burden(without(hand, combo.cards)) + rankOf(combo.top) / 40;
    const twos = combo.cards.filter((card) => rankOf(card) === TWO).length;
    if (isChop(combo, v.table)) score -= 0.6 * comboValue(v.table as Combo) + 0.5;
    else if (isBomb(combo)) score += 2;
    if (twos > 0 && !danger && hand.length > 3) score += 0.8 * twos;
    if (v.table) score += (Math.max(0, rankOf(combo.top) - rankOf(v.table.top)) / 12) * 0.6;
    else if (lastCard && combo.kind === 'single') score += (ACE - rankOf(combo.top)) / 5;
    return { action: play(combo), score };
  });
  if (v.table) scored.push({ action: PASS, score: burden(hand) + (danger ? 1.5 : 0.35) });
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.action);
}

/**
 * The hard bot: each candidate is tried against random guesses of the unseen cards, played to the end by the
 * normal bot; the best average points wins.
 */
function lookAhead(v: View, candidates: Action[], seed: number, budget: number): Action {
  const seat = v.seat as number;
  const known = new Set([...v.hand, ...v.played]);
  const unseen = Array.from({ length: DECK }, (_, card) => card).filter((card) => !known.has(card));
  const samples = Math.max(1, Math.floor(budget / candidates.length));
  let rng = seed >>> 0;
  let best = candidates[0] as Action;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    let total = 0;
    for (let k = 0; k < samples; k++) {
      const pool = [...unseen];
      for (let i = pool.length - 1; i > 0; i--) {
        const [r, next] = random(rng);
        rng = next;
        const j = Math.floor(r * (i + 1));
        [pool[i], pool[j]] = [pool[j] as Card, pool[i] as Card];
      }
      let at = 0;
      const hands = v.counts.map((count, s) => {
        if (s === seat) return [...v.hand];
        const hand = pool.slice(at, at + count).sort((a, b) => a - b);
        at += count;
        return hand;
      });
      const first = act(stateFrom(v, hands, rng), seat, candidate);
      if (!first.ok) continue;
      total += playOut(first.state, seat);
    }
    if (total > bestScore) {
      bestScore = total;
      best = candidate;
    }
  }
  return best;
}

/** Plays a guessed state to the end with the normal bot everywhere; the seat's points, and a little for its place. */
function playOut(start: State, seat: number): number {
  let state = start;
  for (let guard = 0; !state.over && guard < 400; guard++) {
    const turn = state.turn;
    const next = act(state, turn, normalMove(state, turn));
    if (!next.ok) break;
    state = next.state;
  }
  const result = state.result;
  if (!result) return 0;
  return (result.points[seat] ?? 0) - result.ranking.indexOf(seat) * 0.1;
}

/** The normal bot's move from a full state (in a look-ahead, every hand is a guess anyway). */
function normalMove(state: State, seat: number): Action {
  const seen = view(state, seat);
  const legal = legalPlays(seen);
  const out = legal.find((combo) => combo.cards.length === seen.hand.length);
  return out ? play(out) : legal.length === 0 ? PASS : (rank(seen, legal)[0] as Action);
}
