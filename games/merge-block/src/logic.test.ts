import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COLS,
  drop,
  type Exponent,
  indexOf,
  isFull,
  landingRow,
  newGame,
  ROWS,
  restore,
  type State,
  spawn,
} from './logic.ts';

/** Build a state from rows written top-down, e.g. ['. . . . .', '1 . 2 . .'] (numbers are exponents). */
function board(rows: string[], current: Exponent, extra: Partial<State> = {}): State {
  const grid = new Array<Exponent>(COLS * ROWS).fill(0);
  rows.forEach((line, i) => {
    const row = rows.length - 1 - i;
    line
      .trim()
      .split(/\s+/)
      .forEach((token, col) => {
        grid[indexOf({ col, row })] = token === '.' ? 0 : Number(token);
      });
  });
  return { ...newGame(1), grid, current, next: 1, ...extra };
}

const expAt = (state: State, col: number, row: number) => state.grid[indexOf({ col, row })];

function play(state: State, col: number) {
  const result = drop(state, col);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe('dropping', () => {
  it('lands on the lowest empty cell and advances current/next', () => {
    const start = newGame(42);
    const { state, events } = play(start, 2);
    expect(expAt(state, 2, 0)).toBe(start.current);
    expect(state.current).toBe(start.next);
    expect(events[0]).toEqual({ type: 'land', at: { col: 2, row: 0 }, exp: start.current });
    expect(state.moves).toBe(1);
  });

  it('refuses a full column without changing anything', () => {
    const full = board(['1', '2', '1', '2', '1', '2', '1'], 3);
    expect(drop(full, 0)).toEqual({ ok: false, reason: 'column_full' });
    expect(drop(full, 7)).toEqual({ ok: false, reason: 'no_such_column' });
  });
});

describe('merging', () => {
  it('merges with one equal neighbour: ×2, scored with combo 1', () => {
    const { state, events } = play(board(['2 . . . .'], 2), 1);
    expect(expAt(state, 0, 0)).toBe(0);
    expect(expAt(state, 1, 0)).toBe(3);
    expect(events).toContainEqual({
      type: 'merge',
      into: { col: 1, row: 0 },
      from: [{ col: 0, row: 0 }],
      exp: 3,
      gained: 8,
      combo: 1,
    });
    expect(state.score).toBe(8);
  });

  it('absorbs every equal neighbour at once: two neighbours give ×4', () => {
    const { state } = play(board(['2 . 2 . .'], 2), 1);
    expect(expAt(state, 1, 0)).toBe(4); // a 4 between two 4s → 16
    expect(state.grid.filter((e) => e > 0)).toEqual([4]);
    expect(state.score).toBe(16);
  });

  it('chains: a merge result that matches a neighbour merges again with a higher combo', () => {
    // Bottom row "8 _ 4": a 4 dropped in the gap merges with the 4 into an 8, which then meets the other 8.
    const { state, events } = play(board(['3 . 2 . .'], 2), 1);
    const merges = events.filter((e) => e.type === 'merge');
    expect(merges.map((m) => [m.exp, m.combo])).toEqual([
      [3, 1],
      [4, 2],
    ]);
    expect(state.grid.filter((e) => e > 0)).toEqual([4]);
    expect(state.score).toBe(8 * 1 + 16 * 2);
  });

  it('lets blocks fall into holes left by a merge and merges what they meet', () => {
    // Column 0: 2 at the bottom, 3 above it. Dropping a 2 into column 1 absorbs the bottom 2 of column 0,
    // the 3 falls down next to nothing equal.
    const { state, events } = play(board(['3 . . . .', '1 . . . .'], 1), 1);
    expect(events.some((e) => e.type === 'fall')).toBe(true);
    expect(expAt(state, 0, 0)).toBe(3);
    expect(expAt(state, 1, 0)).toBe(2);
  });
});

describe('end of game', () => {
  it('ends when every column is full and records a new best', () => {
    // A checkerboard of 2s and 4s with one free cell at the top of column 0.
    const rows = ['. 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1'];
    const start = board(rows, 4, { score: 500, best: 100 });
    expect(isFull(start.grid)).toBe(false);
    const { state, events } = play(start, 0);
    expect(state.over).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'over', score: 500, best: 500, record: true });
    expect(drop(state, 0)).toEqual({ ok: false, reason: 'game_over' });
  });
});

describe('new blocks', () => {
  it('start small and grow with the largest block, never above 64', () => {
    const empty = new Array<Exponent>(COLS * ROWS).fill(0);
    const seen = new Set<number>();
    let rng = 7;
    for (let i = 0; i < 500; i++) {
      const [exp, next] = spawn(empty, rng);
      seen.add(exp);
      rng = next;
    }
    expect([...seen].sort()).toEqual([1]);

    const big = [...empty];
    big[0] = 15;
    for (let i = 0; i < 2000; i++) {
      const [exp, next] = spawn(big, rng);
      seen.add(exp);
      rng = next;
    }
    expect(Math.max(...seen)).toBe(6);
  });
});

describe('saves', () => {
  it('restores only valid games', () => {
    const game = play(newGame(3), 1).state;
    expect(restore(JSON.parse(JSON.stringify(game)))).toEqual(game);
    expect(restore({ ...game, grid: [1, 2] })).toBeNull();
    expect(restore({ ...game, version: 2 })).toBeNull();
    expect(restore(null)).toBeNull();
  });
});

describe('random play (bot)', () => {
  it('keeps every invariant from SPEC.md', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.integer({ min: 0, max: COLS - 1 }), { maxLength: 250 }),
        (seed, columns) => {
          let state = newGame(seed);
          const replay: number[] = [];
          for (const col of columns) {
            const result = drop(state, col);
            if (!result.ok) {
              expect(['column_full', 'game_over']).toContain(result.reason);
              if (result.reason === 'game_over') break;
              continue;
            }
            expect(result.state.score).toBeGreaterThanOrEqual(state.score);
            state = result.state;
            replay.push(col);

            for (let c = 0; c < COLS; c++) {
              for (let r = 0; r < ROWS; r++) {
                const here = state.grid[indexOf({ col: c, row: r })] ?? 0;
                if (here === 0) {
                  // No hole under a block: everything above an empty cell is empty.
                  for (let above = r + 1; above < ROWS; above++)
                    expect(state.grid[indexOf({ col: c, row: above })]).toBe(0);
                  continue;
                }
                if (c + 1 < COLS) expect(state.grid[indexOf({ col: c + 1, row: r })]).not.toBe(here);
                if (r + 1 < ROWS) expect(state.grid[indexOf({ col: c, row: r + 1 })]).not.toBe(here);
              }
            }
            expect(state.over).toBe(isFull(state.grid));
            expect(
              Array.from({ length: COLS }, (_, c) => landingRow(state.grid, c)).some((r) => r !== null),
            ).toBe(!state.over);
          }

          // Deterministic: the same seed and moves give the same game; a saved game continues identically.
          let again = newGame(seed);
          for (const col of replay) again = play(again, col).state;
          expect(again).toEqual(state);
          const restored = restore(JSON.parse(JSON.stringify(state)));
          expect(restored).toEqual(state);
        },
      ),
      { numRuns: 150 },
    );
  });
});
