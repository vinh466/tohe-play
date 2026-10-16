import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decide, LEVELS, type Level } from './bots.ts';
import { type Card, classify, DECK, rankOf } from './cards.ts';
import { rules } from './module.ts';
import {
  type Action,
  act,
  check,
  hasInstantWin,
  INSTANT_WINS,
  legalPlays,
  normalizeOptions,
  type Options,
  restore,
  type State,
  setup,
  timeoutAction,
  view,
} from './rules.ts';
import { c, cs, table } from './testing.ts';

function ok(state: State, seat: number, action: Action) {
  const result = act(state, seat, action);
  if (!result.ok) throw new Error(`seat ${seat} ${JSON.stringify(action)}: ${result.error}`);
  return result;
}

const playCards = (text: string): Action => ({ type: 'play', cards: cs(text) });
const PASS: Action = { type: 'pass' };
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('a deal', () => {
  it('gives 13 distinct cards to each player, and the holder of 3♠ leads with it', () => {
    const state = setup({ seats: 4, seed: 7 });
    expect(state.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(state.hands.flat()).size).toBe(52);
    expect(state.hands[state.turn]).toContain(c('3♠'));
    expect(state.mustInclude).toBe(c('3♠'));
    expect(state.first).toBe(true);
  });

  it('without H1 the holder of 3♠ leads anything', () => {
    const state = setup({ seats: 4, seed: 7, options: { firstLeadThree: false } });
    expect(state.hands[state.turn]).toContain(c('3♠'));
    expect(state.mustInclude).toBeNull();
  });

  it('with fewer players the lowest card dealt leads', () => {
    for (let seed = 1; seed < 40; seed++) {
      const state = setup({ seats: 2, seed });
      const lowest = Math.min(...state.hands.flat());
      expect(state.hands[state.turn]).toContain(lowest);
      expect(state.mustInclude).toBe(lowest);
    }
  });

  it("lets the last hand's winner lead anything", () => {
    const state = setup({ seats: 3, seed: 7, carry: { leader: 2 } });
    expect(state.turn).toBe(2);
    expect(state.mustInclude).toBeNull();
    expect(state.first).toBe(false);
  });

  it('ends at once on an instant win, which takes 2 from every other player', () => {
    let found = 0;
    for (let seed = 1; seed < 3000 && found < 5; seed++) {
      const state = setup({ seats: 4, seed });
      if (!state.instant) continue;
      found++;
      expect(state.over).toBe(true);
      expect(hasInstantWin(state.hands[state.instant.seat] as Card[], state.instant.win)).toBe(true);
      expect(state.result?.points[state.instant.seat]).toBe(6);
      expect(sum(state.result?.points ?? [])).toBe(0);
      expect(rules.status(state)).toMatchObject({ over: true, carry: { leader: null } });
    }
    expect(found).toBeGreaterThan(0);
  });

  it('only deals instant wins that are switched on', () => {
    for (let seed = 1; seed < 400; seed++) {
      expect(setup({ seats: 4, seed, options: { instantWins: [] } }).instant).toBeNull();
    }
  });
});

describe('instant-win hands', () => {
  it.each([
    ['dragon', '3♠ 4♠ 5♠ 6♠ 7♠ 8♠ 9♠ 10♠ J♠ Q♠ K♠ A♠ 4♥', true],
    ['dragon', '3♠ 4♠ 5♠ 6♠ 7♠ 8♠ 9♠ 10♠ J♠ Q♠ K♠ 2♠ 4♥', false],
    ['fourTwos', '2♠ 2♣ 2♦ 2♥ 3♠', true],
    ['fivePairs', '5♠ 5♥ 6♠ 6♥ 7♠ 7♥ 8♠ 8♥ 9♠ 9♥', true],
    ['fivePairs', 'J♠ J♥ Q♠ Q♥ K♠ K♥ A♠ A♥ 2♠ 2♥', false],
    ['sixPairs', '3♠ 3♥ 5♠ 5♥ 7♠ 7♥ 9♠ 9♥ J♠ J♥ 2♠ 2♥ A♦', true],
    ['sixPairs', '3♠ 3♥ 3♦ 3♣ 7♠ 7♥ 9♠ 9♥ J♠ J♥ 2♠ 2♥ A♦', true],
    ['sixPairs', '3♠ 3♥ 5♠ 5♥ 7♠ 7♥ 9♠ 9♥ J♠ J♥ 2♠ A♦ K♦', false],
    ['threeTriples', '6♠ 6♥ 6♦ 7♠ 7♥ 7♦ 8♠ 8♥ 8♦', true],
  ] as const)('%s: %s → %s', (win, hand, expected) => {
    expect(hasInstantWin(cs(hand), win)).toBe(expected);
  });
});

describe('a turn', () => {
  const start = () =>
    table(['3♠ 4♠ 9♥ K♣', '5♣ 6♦ 7♥ 8♣', '10♠ J♣ Q♦ A♠', '4♥ 5♦ 2♠ 2♥'], {
      first: true,
      mustInclude: c('3♠'),
    });

  it('refuses what the rules do not allow, with a reason', () => {
    const state = start();
    expect(act(state, 1, playCards('5♣'))).toEqual({ ok: false, error: 'not_your_turn' });
    expect(act(state, 0, playCards('5♣'))).toEqual({ ok: false, error: 'not_your_cards' });
    expect(act(state, 0, playCards('3♠ 9♥'))).toEqual({ ok: false, error: 'not_a_combo' });
    expect(act(state, 0, playCards('4♠'))).toEqual({ ok: false, error: 'must_include' });
    expect(act(state, 0, PASS)).toEqual({ ok: false, error: 'must_lead' });
    const after = ok(state, 0, playCards('3♠')).state;
    expect(act(after, 1, playCards('5♣')).ok).toBe(true);
    expect(act(after, 1, { type: 'nonsense' } as unknown as Action)).toEqual({
      ok: false,
      error: 'not_a_combo',
    });
    const higher = ok(after, 1, playCards('8♣')).state;
    const ace = ok(higher, 2, playCards('A♠')).state;
    expect(act(ace, 3, playCards('4♥'))).toEqual({ ok: false, error: 'must_beat' });
    expect(act(ace, 3, playCards('2♠')).ok).toBe(true);
  });

  it('locks a player who passed out of the round, and the last to play leads the next one', () => {
    let state = ok(start(), 0, playCards('3♠')).state;
    state = ok(state, 1, PASS).state;
    state = ok(state, 2, playCards('10♠')).state;
    expect(state.turn).toBe(3);
    state = ok(state, 3, PASS).state;
    expect(state.turn).toBe(0); // seat 1 passed: skipped
    expect(act(state, 1, playCards('5♣'))).toEqual({ ok: false, error: 'passed' });
    const result = ok(state, 0, PASS);
    expect(result.events).toContainEqual({ type: 'round', winner: 2, leader: 2 });
    expect(result.state).toMatchObject({ table: null, turn: 2, passed: [false, false, false, false] });
  });

  it('gives the lead to the next player when the round winner went out (hưởng sái)', () => {
    let state = table(['5♠', '3♣ 9♦', '4♦ 10♣', '6♥ J♦'], { turn: 0 });
    state = ok(state, 0, playCards('5♠')).state;
    expect(state.finished).toEqual([0]);
    state = ok(state, 1, PASS).state;
    state = ok(state, 2, PASS).state;
    const result = ok(state, 3, PASS);
    expect(result.state.turn).toBe(1);
    expect(result.state.table).toBeNull();
  });

  it('plays on to the last place, which pays the most', () => {
    let state = table(['5♠', '3♣', '4♦ 10♣', '6♥'], { turn: 0 }, { leftovers: false });
    state = ok(state, 0, playCards('5♠')).state;
    state = ok(state, 1, PASS).state;
    state = ok(state, 2, PASS).state;
    state = ok(state, 3, playCards('6♥')).state;
    expect(state.finished).toEqual([0, 3]);
    // Seats 1 and 2 had passed: the round ends, and seat 1 leads after seat 3 who went out.
    expect(state).toMatchObject({ table: null, turn: 1 });
    state = ok(state, 1, playCards('3♣')).state;
    expect(state.over).toBe(true);
    expect(state.result?.ranking).toEqual([0, 3, 1, 2]);
    expect(state.result?.points).toEqual([2, -1, -2, 1]);
  });
});

describe('chops', () => {
  const chopTable = (options: Partial<Options> = {}) =>
    table(
      ['2♥ 3♠ 3♦', '4♠ 4♥ 5♣ 5♦ 6♠ 6♥ 7♣', '9♠ 9♣ 9♦ 9♥ 8♣', 'K♠ K♥ A♣'],
      { turn: 0 },
      { leftovers: false, ...options },
    );

  it('chặt chồng: the last player chopped pays the whole chain when the round ends (H3)', () => {
    let state = ok(chopTable(), 0, playCards('2♥')).state;
    const first = ok(state, 1, playCards('4♠ 4♥ 5♣ 5♦ 6♠ 6♥'));
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'play', chop: 2, chain: 1 }));
    const second = ok(first.state, 2, playCards('9♠ 9♣ 9♦ 9♥'));
    expect(second.events).toContainEqual(expect.objectContaining({ type: 'play', chop: 2, chain: 2 }));
    state = ok(second.state, 3, PASS).state;
    state = ok(state, 0, PASS).state;
    const end = ok(state, 1, PASS);
    expect(end.events).toContainEqual({ type: 'paid', line: { kind: 'chop', from: 1, to: 2, points: 4 } });
  });

  it('without H3 every chop is paid at once by the player chopped', () => {
    let state = ok(chopTable({ chopChain: false }), 0, playCards('2♥')).state;
    const first = ok(state, 1, playCards('4♠ 4♥ 5♣ 5♦ 6♠ 6♥'));
    expect(first.events).toContainEqual({ type: 'paid', line: { kind: 'chop', from: 0, to: 1, points: 2 } });
    state = ok(first.state, 2, playCards('9♠ 9♣ 9♦ 9♥')).state;
    expect(state.lines).toContainEqual({ kind: 'chop', from: 1, to: 2, points: 2 });
  });

  it('counts no chop points with places only (H8)', () => {
    let state = ok(chopTable({ points: 'places' }), 0, playCards('2♥')).state;
    state = ok(state, 1, playCards('4♠ 4♥ 5♣ 5♦ 6♠ 6♥')).state;
    state = ok(state, 2, PASS).state;
    state = ok(state, 3, PASS).state;
    state = ok(state, 0, PASS).state;
    expect(state.lines).toEqual([]);
  });

  it('lets 4 đôi thông chop out of turn, even after passing (H2)', () => {
    const start = table(
      ['2♥ 3♠', '5♣ 6♦', '3♣ 3♦ 4♣ 4♦ 5♠ 5♥ 6♣ 6♥ 9♠', 'K♠ K♥'],
      { turn: 0, passed: [false, false, false, false] },
      { leftovers: false },
    );
    const played = ok(start, 0, playCards('2♥')).state; // seat 1's turn
    const view2 = view(played, 2);
    expect(legalPlays(view2).map((x) => x.kind)).toEqual(['pairs']);
    expect(check(view2, cs('3♣ 3♦ 4♣ 4♦ 5♠ 5♥ 6♣ 6♥'))).toBeNull();
    expect(rules.status(played)).toMatchObject({ over: false, turn: [1], chop: [2] });
    const chop = ok(played, 2, playCards('3♣ 3♦ 4♣ 4♦ 5♠ 5♥ 6♣ 6♥'));
    expect(chop.events).toContainEqual(
      expect.objectContaining({ type: 'play', seat: 2, outOfTurn: true, chop: 2 }),
    );
    expect(chop.state.turn).toBe(3);
    // after passing, too
    const passed = ok(ok(start, 0, playCards('3♠')).state, 1, playCards('5♣')).state;
    const afterPass = ok(passed, 2, PASS).state;
    const two = ok(ok(afterPass, 3, PASS).state, 0, playCards('2♥')).state;
    expect(act(two, 2, playCards('3♣ 3♦ 4♣ 4♦ 5♠ 5♥ 6♣ 6♥')).ok).toBe(true);
    // not with H2 off
    const off = { ...played, options: { ...played.options, chopOutOfTurn: false } };
    expect(act(off, 2, playCards('3♣ 3♦ 4♣ 4♦ 5♠ 5♥ 6♣ 6♥'))).toEqual({ ok: false, error: 'not_your_turn' });
  });
});

describe('the end of a hand', () => {
  it('cóng: a player who never played is out when the first goes out, last, and pays double (H5)', () => {
    let state = table(['5♠', '3♣ 9♦', '4♦ 10♣ 2♥', '6♥ J♦'], {
      turn: 0,
      hasPlayed: [false, true, false, true],
    });
    const result = ok(state, 0, playCards('5♠'));
    expect(result.events).toContainEqual({ type: 'cong', seats: [2] });
    state = result.state;
    state = ok(state, 1, playCards('9♦')).state;
    state = ok(state, 3, playCards('J♦')).state;
    state = ok(state, 1, PASS).state; // round to seat 3
    state = ok(state, 3, playCards('6♥')).state;
    expect(state.over).toBe(true);
    expect(state.result?.ranking).toEqual([0, 3, 1, 2]);
    // seat 2: bét −2, cóng −2, thối of a red 2 −2; seat 1: ba −1
    expect(state.result?.points).toEqual([2 + 2 + 2, -1, -6, 1]);
    expect(sum(state.result?.points ?? [])).toBe(0);
  });

  it('stops at the first out with H7, the winner taking 2 from each', () => {
    let state = table(['5♠', '3♣ 9♦', '4♦ 10♣', '6♥ J♦'], { turn: 0 }, { endAtFirstOut: true });
    state = ok(state, 0, playCards('5♠')).state;
    expect(state.over).toBe(true);
    expect(state.result?.points).toEqual([6, -2, -2, -2]);
  });

  it('reveals every hand only when it is over', () => {
    const state = setup({ seats: 4, seed: 3, options: { instantWins: [] } });
    const seen = view(state, 1);
    expect(seen.hand).toEqual(state.hands[1]);
    expect(seen.revealed).toBeNull();
    expect(JSON.stringify(seen)).not.toContain(JSON.stringify(state.hands[2]));
    expect(view(state, null).hand).toEqual([]);
  });
});

describe('the turn timer', () => {
  it('passes, or leads the lowest card (3♠ when it must)', () => {
    const state = setup({ seats: 4, seed: 11, options: { instantWins: [] } });
    expect(timeoutAction(state, state.turn)).toEqual({ type: 'play', cards: [c('3♠')] });
    const next = ok(state, state.turn, timeoutAction(state, state.turn)).state;
    expect(timeoutAction(next, next.turn)).toEqual({ type: 'pass' });
  });
});

describe('saves', () => {
  it('restores a saved state and refuses others', () => {
    const state = setup({ seats: 3, seed: 5 });
    expect(restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(restore(null)).toBeNull();
    expect(restore({ ...state, v: 2 })).toBeNull();
    expect(restore({ ...state, hands: [[0, 0], [], []] })).toBeNull();
  });

  it('fills in house rules a save does not have', () => {
    expect(normalizeOptions({ cong: false, instantWins: ['dragon', 'bogus'] })).toMatchObject({
      cong: false,
      chopChain: true,
      instantWins: ['dragon'],
    });
  });
});

// ------------------------------------------------------------------ the random-play bot (SPEC.md, "Invariants")

const optionsArb = fc.record({
  firstLeadThree: fc.boolean(),
  chopOutOfTurn: fc.boolean(),
  chopChain: fc.boolean(),
  leftovers: fc.boolean(),
  cong: fc.boolean(),
  instantWins: fc.subarray([...INSTANT_WINS]),
  endAtFirstOut: fc.boolean(),
  points: fc.constantFrom('full' as const, 'places' as const),
  pairsBeatTwoPair: fc.boolean(),
});

/** Plays a hand to the end with random legal actions (and random out-of-turn chops); checks every step. */
function randomHand(seats: number, seed: number, options: Options, picks: number[], levels?: Level[]) {
  let state = setup({ seats, seed, options });
  const actions: [number, Action][] = [];
  let pick = 0;
  const next = () => picks[pick++ % picks.length] as number;
  for (let guard = 0; !state.over; guard++) {
    if (guard > 500) throw new Error('the hand did not end');
    // Someone may chop out of turn first.
    const choppers = rules.status(state);
    const chopper =
      !choppers.over && choppers.chop.length > 0 && next() % 3 === 0 ? choppers.chop[0] : undefined;
    const seat = chopper ?? state.turn;
    const seen = view(state, seat);
    let action: Action;
    if (levels) {
      const decided = decide(seen, levels[seat] as Level, next(), 8);
      action = decided ?? { type: 'pass' };
      if (!decided && seat !== state.turn) continue;
    } else {
      const legal = legalPlays(seen);
      const choice = next() % (legal.length + (state.table && chopper === undefined ? 1 : 0));
      const combo = legal[choice];
      action = combo ? { type: 'play', cards: combo.cards } : { type: 'pass' };
    }
    const before = state;
    const result = act(state, seat, action);
    expect(result.ok, `${JSON.stringify(action)} by ${seat}`).toBe(true);
    if (!result.ok) break;
    state = result.state;
    actions.push([seat, action]);
    checkInvariants(before, state, seat, action);
  }
  return { state, actions };
}

function checkInvariants(before: State, after: State, seat: number, action: Action) {
  // 1. every card is still there, once
  const cards = [...after.hands.flat(), ...after.played];
  expect(new Set(cards).size).toBe(cards.length);
  expect(cards.length).toBe(after.seats === 4 ? DECK : after.seats * 13);
  if (action.type === 'play') {
    // 2. a valid combination from the player's own hand
    expect(classify(action.cards)).not.toBeNull();
    for (const card of action.cards) expect(before.hands[seat]).toContain(card);
    // 3. a player who passed plays only an H2 chop
    if (before.passed[seat] || before.turn !== seat) {
      expect(before.options.chopOutOfTurn).toBe(true);
      expect(classify(action.cards)?.kind).toBe('pairs');
    }
  }
  // 4. the turn belongs to a player still in the hand who has not passed
  if (!after.over) {
    expect(after.hands[after.turn]?.length).toBeGreaterThan(0);
    expect(after.passed[after.turn]).toBe(false);
    expect(after.cong).not.toContain(after.turn);
  } else {
    // 5. places are a permutation and the points sum to zero
    const result = after.result;
    expect(result).not.toBeNull();
    expect([...(result?.ranking ?? [])].sort()).toEqual(Array.from({ length: after.seats }, (_, s) => s));
    expect(sum(result?.points ?? [1])).toBe(0);
  }
}

// The property runs are many hands each: a few seconds on a workstation, more on a shared CI runner.
describe('random play', () => {
  it('keeps every invariant, in every house-rule combination and table size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        optionsArb,
        fc.array(fc.nat(1000), { minLength: 20, maxLength: 60 }),
        (seats, seed, options, picks) => {
          randomHand(seats, seed, options, picks);
        },
      ),
      { numRuns: 300 },
    );
  }, 60_000);

  it('is deterministic: the same seed and actions give the same state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), optionsArb, (seed, options) => {
        const { state, actions } = randomHand(4, seed, options, [3, 1, 4, 1, 5, 9, 2, 6]);
        let replay = setup({ seats: 4, seed, options });
        for (const [seat, action] of actions) replay = ok(replay, seat, action).state;
        expect(replay).toEqual(state);
      }),
      { numRuns: 60 },
    );
  }, 60_000);

  it('bots of every level only ever take legal actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        optionsArb,
        fc.array(fc.constantFrom(...LEVELS), { minLength: 4, maxLength: 4 }),
        (seats, seed, options, levels) => {
          randomHand(seats, seed, options, [7, 2, 9, 4], levels);
        },
      ),
      { numRuns: 30 },
    );
  }, 60_000);

  it('never shows a seat the cards of another', () => {
    const { state } = randomHand(4, 99, normalizeOptions({}), [1, 2, 3]);
    const start = setup({ seats: 4, seed: 99 });
    for (let seat = 0; seat < 4; seat++) {
      const seen = view(start, seat);
      for (let other = 0; other < 4; other++) {
        if (other === seat) continue;
        const theirs = start.hands[other] as Card[];
        expect(seen.hand.some((card) => theirs.includes(card))).toBe(false);
      }
    }
    expect(state.over).toBe(true);
    expect(view(state, 0).revealed).toEqual(state.hands);
  });

  it('lets a 2 be played only as itself, never inside a straight', () => {
    const { actions } = randomHand(4, 5, normalizeOptions({}), [8, 3, 5]);
    for (const [, action] of actions) {
      if (action.type !== 'play' || action.cards.length < 3) continue;
      const combo = classify(action.cards);
      if (combo?.kind === 'straight' || combo?.kind === 'pairs') {
        expect(action.cards.some((card) => rankOf(card) === 12)).toBe(false);
      }
    }
  });
});
