import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Cell,
  COLS,
  type Exponent,
  hasMove,
  indexOf,
  isStuck,
  MAX_SHUFFLES,
  matches,
  newGame,
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
  it('absorbs every equal neighbour, diagonals too, and doubles the tapped block once', () => {
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
      exp: 2,
      gained: 4 * 3,
    });
    expect(expAt(state, 2, 1)).toBe(2);
    expect(state.score).toBe(12);
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
      4 * 4,
    ]);
    expect(expAt(state, 0, 0)).toBe(2);
    expect(expAt(state, 4, 0)).toBe(1); // not connected: left alone
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
    const first = play({ ...start, shuffles: 1 }, { col: 0, row: 0 });
    expect(first.events).toContainEqual({ type: 'top', exp: 7, shuffles: 2, earned: true });
    expect(first.state.top).toBe(7);
    const full = play({ ...start, shuffles: MAX_SHUFFLES }, { col: 0, row: 0 });
    expect(full.events).toContainEqual({ type: 'top', exp: 7, shuffles: MAX_SHUFFLES, earned: false });
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

describe('new blocks', () => {
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
      fc.property(fc.integer(), fc.array(action, { maxLength: 300 }), (seed, actions) => {
        let state = newGame(seed);
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
          }
          // Over exactly when nothing merges and no 🔀 is left; stuck in between.
          expect(state.over).toBe(!hasMove(state.grid) && state.shuffles === 0);
          expect(isStuck(state)).toBe(!state.over && !hasMove(state.grid));
          if (state.over) break;
        }

        // Deterministic: the same seed and actions give the same game; a saved game continues identically.
        let again = newGame(seed);
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
