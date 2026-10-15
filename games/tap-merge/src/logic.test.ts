import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Cell,
  COLS,
  type Exponent,
  floorOf,
  hasMove,
  indexOf,
  isStuck,
  MAX_SHUFFLES,
  matches,
  merged,
  newGame,
  nextMilestone,
  ROWS,
  restore,
  type State,
  shuffle,
  spawn,
  tap,
} from './logic.ts';

/** No two neighbours equal, even diagonally: 2×2 tiles of 8, 16, 32, 64 (exponents 3–6). */
const pattern = (col: number, row: number) => 3 + (col % 2) + 2 * (row % 2);

/** A stuck board (no equal neighbours), with some cells set to other exponents. */
function board(set: [col: number, row: number, exp: Exponent][] = [], extra: Partial<State> = {}): State {
  const grid = Array.from({ length: COLS * ROWS }, (_, i) => pattern(i % COLS, Math.floor(i / COLS)));
  for (const [col, row, exp] of set) grid[indexOf({ col, row })] = exp;
  return { ...newGame(1), grid, top: 6, ...extra };
}

const expAt = (state: State, col: number, row: number) => state.grid[indexOf({ col, row })];

function play(state: State, cell: Cell) {
  const result = tap(state, cell);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe('a tap', () => {
  it('absorbs every equal neighbour, diagonals too, into their sum rounded up to a power of two', () => {
    const start = board([
      [2, 1, 1],
      [1, 0, 1], // diagonal, below left
      [2, 2, 1], // above
      [3, 2, 1], // diagonal, above right
    ]);
    const { state, events } = play(start, { col: 2, row: 1 });
    expect(events[0]).toEqual({
      type: 'merge',
      into: { col: 2, row: 1 },
      from: [
        { col: 1, row: 0 },
        { col: 2, row: 2 },
        { col: 3, row: 2 },
      ],
      steps: [1, 1, 1],
      exp: 3, // four 2s: 8
      gained: 8 * 3,
    });
    expect(expAt(state, 2, 1)).toBe(3);
    expect(state.score).toBe(24);
    expect(state.moves).toBe(1);
  });

  it('pulls in the whole group of equal blocks that touch one another, however far it reaches', () => {
    // A diagonal chain of 2s from the bottom-left corner, and one more 2 that touches none of them.
    const start = board([
      [0, 0, 1],
      [1, 1, 1],
      [2, 2, 1],
      [3, 3, 1],
      [4, 4, 1],
      [4, 0, 1],
    ]);
    const { state, events } = play(start, { col: 0, row: 0 });
    const merge = events[0];
    expect(merge?.type === 'merge' && [merge.from, merge.steps, merge.gained]).toEqual([
      [
        { col: 1, row: 1 },
        { col: 2, row: 2 },
        { col: 3, row: 3 },
        { col: 4, row: 4 },
      ],
      [1, 2, 3, 4],
      16 * 4,
    ]);
    expect(expAt(state, 0, 0)).toBe(4); // five 2s add up to 10: 16
    expect(expAt(state, 4, 0)).toBe(1); // not connected: left alone
  });

  it('makes the sum of the group, rounded up to a power of two', () => {
    // From 2s: a pair makes 4, three make 6 → 8, five make 10 → 16, ten make 20 → 32, …
    const sizes = [2, 3, 4, 5, 8, 9, 10, 16, 17];
    expect(sizes.map((size) => 2 ** merged(1, size))).toEqual([4, 8, 8, 16, 16, 32, 32, 32, 64]);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), fc.integer({ min: 2, max: COLS * ROWS }), (exp, size) => {
        const sum = 2 ** exp * size;
        const made = 2 ** merged(exp, size);
        return made >= sum && made < 2 * sum;
      }),
    );
  });

  it('lets the blocks above fall into the holes and fills the board from the top', () => {
    const start = board([
      [2, 1, 1],
      [1, 0, 1],
      [2, 2, 1],
      [3, 2, 1],
    ]);
    const { state, events } = play(start, { col: 2, row: 1 });
    // Column 1 lost its bottom block: everything above moved one row down.
    expect(expAt(state, 1, 0)).toBe(pattern(1, 1));
    expect(expAt(state, 1, 5)).toBe(pattern(1, 6));
    expect(events.find((e) => e.type === 'fall')).toBeDefined();
    const fill = events.find((e) => e.type === 'fill');
    expect(fill?.type === 'fill' && fill.blocks.map((b) => [b.at.col, b.at.row, b.drop])).toEqual([
      [1, 6, 1],
      [2, 6, 1],
      [3, 6, 1],
    ]);
    expect(state.grid.every((exp) => exp >= 1)).toBe(true);
  });

  it('does nothing without an equal neighbour, outside the board or after the end', () => {
    const start = board([[0, 0, 1]]);
    expect(tap(start, { col: 0, row: 0 })).toEqual({ ok: false, reason: 'no_match' });
    expect(tap(start, { col: 5, row: 0 })).toEqual({ ok: false, reason: 'no_such_cell' });
    expect(tap({ ...start, over: true }, { col: 0, row: 0 })).toEqual({ ok: false, reason: 'game_over' });
  });

  it('earns a 🔀 for a new largest block, up to three', () => {
    const start = board([
      [0, 0, 6],
      [1, 0, 6],
    ]);
    // With the pattern's 64 diagonally above, three 64s add up to 192: 256.
    const first = play({ ...start, shuffles: 1 }, { col: 0, row: 0 });
    expect(first.events).toContainEqual({ type: 'top', exp: 8, shuffles: 2, earned: true });
    expect(first.state.top).toBe(8);
    const full = play({ ...start, shuffles: MAX_SHUFFLES }, { col: 0, row: 0 });
    expect(full.events).toContainEqual({ type: 'top', exp: 8, shuffles: MAX_SHUFFLES, earned: false });
  });
});

describe('stuck and the end', () => {
  // One pair on a stuck board: after the tap, whether a move is left depends on the new blocks (the PRNG).
  const lastPair = board([
    [0, 0, 1],
    [1, 0, 1],
  ]);
  const stuckAfterTap = (shuffles: number) => {
    for (let rng = 0; rng < 2000; rng++) {
      const result = play({ ...lastPair, shuffles, rng }, { col: 0, row: 0 });
      if (!hasMove(result.state.grid)) return result;
    }
    throw new Error('no seed leaves the board stuck');
  };

  it('waits for 🔀 when no block has an equal neighbour', () => {
    const { state, events } = stuckAfterTap(1);
    expect(events.at(-1)).toEqual({ type: 'stuck', shuffles: 1 });
    expect(state.over).toBe(false);
    expect(isStuck(state)).toBe(true);
  });

  it('ends without a 🔀 left and records a new best', () => {
    const { state, events } = stuckAfterTap(0);
    expect(state.over).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'over', score: state.score, best: state.score, record: true });
  });

  it('🔀 rearranges the same blocks so that a move exists, and costs one', () => {
    const stuck = board([], { shuffles: 2 });
    expect(hasMove(stuck.grid)).toBe(false);
    const result = shuffle(stuck);
    if (!result.ok) throw new Error(result.reason);
    expect(hasMove(result.state.grid)).toBe(true);
    expect([...result.state.grid].sort()).toEqual([...stuck.grid].sort());
    expect(result.state.shuffles).toBe(1);
    expect(result.events[0]?.type).toBe('shuffle');
  });

  it('keeps 🔀 for when it is needed', () => {
    expect(shuffle(newGame(5))).toEqual({ ok: false, reason: 'not_stuck' });
    expect(shuffle(board([], { shuffles: 0 }))).toEqual({ ok: false, reason: 'no_shuffles' });
  });
});

describe('the rising floor', () => {
  it('retires the 2s at the first 4K, then one more value at every second new largest block', () => {
    const tops = [6, 11, 12, 13, 14, 15, 16, 18, 20, 22];
    expect(tops.map(floorOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 6, 7]);
    expect(tops.map((top) => 2 ** nextMilestone(top))).toEqual([
      4096, 4096, 16384, 16384, 65536, 65536, 262144, 1048576, 4194304, 16777216,
    ]);
  });

  it('clears the blocks under the floor when it rises, each scoring the new largest block', () => {
    // Two 2048s make the first 4K; two 2s on the board leave with it.
    const start = board(
      [
        [0, 0, 11],
        [1, 0, 11],
        [3, 3, 1],
        [0, 5, 1],
      ],
      { top: 11 },
    );
    const { state, events } = play(start, { col: 0, row: 0 });
    expect(events.map((e) => e.type)).toEqual(['merge', 'fall', 'fill', 'top', 'floor', 'fall', 'fill']);
    const floor = events.find((e) => e.type === 'floor');
    if (floor?.type !== 'floor') throw new Error('no floor event');
    expect(floor.floor).toBe(2);
    expect(floor.retired).toEqual([1]);
    expect(floor.cleared.map((b) => b.exp)).toEqual([1, 1]);
    expect(floor.gained).toBe(4096 * 2);
    expect(state.score).toBe(4096 + 4096 * 2);
    expect(state.grid.every((exp) => exp >= 2)).toBe(true);
  });

  it('announces the floor even when no block is under it', () => {
    const start = board(
      [
        [0, 0, 11],
        [1, 0, 11],
      ],
      { top: 11 },
    );
    const { events } = play(start, { col: 0, row: 0 });
    const floor = events.find((e) => e.type === 'floor');
    expect(floor).toEqual({ type: 'floor', floor: 2, retired: [1], cleared: [], gained: 0 });
    expect(events.at(-1)?.type).not.toBe('fill');
  });

  it('leaves the floor alone on an ordinary merge', () => {
    // Two 128s make a 256 with the floor at 4: nothing leaves.
    const start = board(
      [
        [0, 0, 7],
        [1, 0, 7],
      ],
      { top: 13 },
    );
    expect(play(start, { col: 0, row: 0 }).events.some((e) => e.type === 'floor')).toBe(false);
  });

  it('clears blocks left under the floor by a game saved before 0.5.0 at its next tap', () => {
    // A 32K was made (floor: 8), but 2s and a 4 are still on the board.
    const start = board(
      [
        [0, 0, 1],
        [1, 0, 1],
        [4, 6, 2],
        [3, 3, 1],
      ],
      { top: 15 },
    );
    const { state, events } = play(start, { col: 0, row: 0 });
    const floor = events.find((e) => e.type === 'floor');
    if (floor?.type !== 'floor') throw new Error('no floor event');
    // The floor stays at 8; the 4 just made, the lone 2 and the old 4 leave.
    expect(floor.floor).toBe(3);
    expect(floor.retired).toEqual([1, 2]);
    expect(floor.cleared.map((b) => b.exp).sort()).toEqual([1, 2, 2]);
    expect(floor.gained).toBe(32768 * 3);
    expect(state.grid.every((exp) => exp >= 3)).toBe(true);
  });
});

describe('new blocks', () => {
  it('come from the floor up', () => {
    const grid = new Array<Exponent>(COLS * ROWS).fill(9);
    grid[0] = 16;
    let rng = 11;
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const [exp, next] = spawn(grid, rng, 4);
      seen.add(exp);
      rng = next;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('start at 2, 4 and 8 and grow with the largest block, never above 64', () => {
    const seen = new Set<number>();
    let rng = 7;
    const small = new Array<Exponent>(COLS * ROWS).fill(3);
    for (let i = 0; i < 500; i++) {
      const [exp, next] = spawn(small, rng);
      seen.add(exp);
      rng = next;
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    const big = [...small];
    big[0] = 15;
    for (let i = 0; i < 2000; i++) {
      const [exp, next] = spawn(big, rng);
      seen.add(exp);
      rng = next;
    }
    expect(Math.max(...seen)).toBe(6);
  });

  it('a new game is a full board with a move and one 🔀', () => {
    const game = newGame(123);
    expect(game.grid.every((exp) => exp >= 1 && exp <= 3)).toBe(true);
    expect(hasMove(game.grid)).toBe(true);
    expect(game.shuffles).toBe(1);
  });
});

describe('saves', () => {
  it('restores only valid games', () => {
    const game = newGame(3);
    expect(restore(JSON.parse(JSON.stringify(game)))).toEqual(game);
    expect(restore({ ...game, grid: [1, 2] })).toBeNull();
    expect(restore({ ...game, grid: game.grid.map(() => 0) })).toBeNull();
    expect(restore({ ...game, shuffles: 9 })).toBeNull();
    expect(restore({ ...game, version: 2 })).toBeNull();
    expect(restore(null)).toBeNull();
    // Stuck without a 🔀 but not marked over (an old or edited save): it is over.
    expect(restore(board([], { shuffles: 0 }))?.over).toBe(true);
  });
});

type Action = { tap: Cell } | 'shuffle';

/** A game from its start, or a late one: any board between just under the floor and its largest block. */
const startState = fc.oneof(
  fc.integer().map((seed) => newGame(seed)),
  fc.record({ seed: fc.integer(), top: fc.integer({ min: 11, max: 24 }) }).chain(({ seed, top }) =>
    fc
      .array(fc.integer({ min: Math.max(1, floorOf(top) - 1), max: top }), {
        minLength: COLS * ROWS,
        maxLength: COLS * ROWS,
      })
      .map((grid): State => ({ ...newGame(seed), grid, top: Math.max(top, ...grid), shuffles: 2 })),
  ),
);

describe('random play (bot)', () => {
  it('keeps every invariant from SPEC.md', () => {
    const action = fc.oneof(
      {
        weight: 12,
        arbitrary: fc.record({ col: fc.nat(COLS - 1), row: fc.nat(ROWS - 1) }).map((tap) => ({ tap })),
      },
      { weight: 1, arbitrary: fc.constant('shuffle' as const) },
    );
    fc.assert(
      fc.property(startState, fc.array(action, { maxLength: 300 }), (start, actions) => {
        let state = start;
        const done: Action[] = [];
        for (const next of actions) {
          // A player taps blocks that merge: aim at the first merging block from the chosen cell on.
          let act: Action = next;
          if (next !== 'shuffle' && !state.over) {
            const start = indexOf(next.tap);
            const options = state.grid.map((_, i) => (start + i) % state.grid.length);
            const hit = options.find(
              (i) => matches(state.grid, { col: i % COLS, row: Math.floor(i / COLS) }).length,
            );
            act = hit === undefined ? next : { tap: { col: hit % COLS, row: Math.floor(hit / COLS) } };
          }
          const result = act === 'shuffle' ? shuffle(state) : tap(state, act.tap);
          if (!result.ok) {
            if (act === 'shuffle') expect(isStuck(state)).toBe(false);
            else expect(['no_match', 'game_over']).toContain(result.reason);
            continue;
          }
          const before = state;
          state = result.state;
          done.push(act);

          // The board is always full; the score never goes down; 🔀 stays within 0–3.
          expect(state.grid.every((exp) => Number.isInteger(exp) && exp >= 1)).toBe(true);
          expect(state.score).toBeGreaterThanOrEqual(before.score);
          expect(state.shuffles).toBeGreaterThanOrEqual(0);
          expect(state.shuffles).toBeLessThanOrEqual(MAX_SHUFFLES);
          expect(Math.max(...state.grid)).toBeLessThanOrEqual(state.top);
          if (act === 'shuffle') {
            expect([...state.grid].sort()).toEqual([...before.grid].sort());
            expect(hasMove(state.grid)).toBe(true);
            expect(state.shuffles).toBe(before.shuffles - 1);
          } else {
            expect(state.moves).toBe(before.moves + 1);
            expect(state.score).toBeGreaterThan(before.score);
            // The score grows by the merge and the floor's bonus; no block is left under the floor.
            const gained = result.events.reduce(
              (sum, e) => sum + (e.type === 'merge' || e.type === 'floor' ? e.gained : 0),
              0,
            );
            expect(state.score).toBe(before.score + gained);
            expect(floorOf(state.top)).toBeGreaterThanOrEqual(floorOf(before.top));
            expect(Math.min(...state.grid)).toBeGreaterThanOrEqual(floorOf(state.top));
            expect(nextMilestone(state.top)).toBeGreaterThan(state.top);
            // The merged block holds at least its group's sum, and less than twice it.
            const merge = result.events[0];
            if (merge?.type !== 'merge') throw new Error('a tap starts with a merge');
            const sum = 2 ** (before.grid[indexOf(act.tap)] as Exponent) * (merge.from.length + 1);
            expect(2 ** merge.exp).toBeGreaterThanOrEqual(sum);
            expect(2 ** merge.exp).toBeLessThan(2 * sum);
          }
          // Over exactly when nothing merges and no 🔀 is left; stuck in between.
          expect(state.over).toBe(!hasMove(state.grid) && state.shuffles === 0);
          expect(isStuck(state)).toBe(!state.over && !hasMove(state.grid));
          if (state.over) break;
        }

        // Deterministic: the same seed and actions give the same game; a saved game continues identically.
        let again = start;
        for (const act of done) {
          const result = act === 'shuffle' ? shuffle(again) : tap(again, act.tap);
          if (!result.ok) throw new Error(result.reason);
          again = result.state;
        }
        expect(again).toEqual(state);
        expect(restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
      }),
      { numRuns: 120 },
    );
  });
});
