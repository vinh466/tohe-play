import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COLS,
  type Exponent,
  fire,
  type GameEvent,
  indexOf,
  isFull,
  landingRow,
  newGame,
  PRESSURE_MAX,
  ROWS,
  restore,
  SHIP_EXP,
  type State,
  spawn,
} from './logic.ts';

/** Build a state from rows written top-down, e.g. ['. . . . .', '1 . 2 . .'] (numbers are exponents). */
function board(rows: string[], current: Exponent, extra: Partial<State> = {}): State {
  const grid = new Array<Exponent>(COLS * ROWS).fill(0);
  rows.forEach((line, i) => {
    const row = ROWS - 1 - i;
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
  const result = fire(state, col);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe('firing', () => {
  it('fires the first block to the ceiling and the next just below it', () => {
    const start = newGame(42);
    const first = play(start, 2);
    expect(expAt(first.state, 2, ROWS - 1)).toBe(start.current);
    expect(first.events[0]).toEqual({ type: 'land', at: { col: 2, row: ROWS - 1 }, exp: start.current });
    expect(first.state.current).toBe(start.next);
    expect(first.state.moves).toBe(1);

    const second = play(board(['. . 2 . .'], 1), 2);
    expect(expAt(second.state, 2, ROWS - 2)).toBe(1);
    expect(second.state.moves).toBe(1);
  });

  it('refuses a blocked column, a bad column and a finished game without changing anything', () => {
    // A block in row 0 blocks the column, even with empty cells above it.
    const blocked = board(
      ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '1 . . . .'],
      3,
    );
    expect(landingRow(blocked.grid, 0)).toBeNull();
    expect(fire(blocked, 0)).toEqual({ ok: false, reason: 'column_full' });
    expect(fire(blocked, 7)).toEqual({ ok: false, reason: 'no_such_column' });
    expect(fire({ ...blocked, over: true }, 1)).toEqual({ ok: false, reason: 'game_over' });
  });
});

describe('merging and gravity', () => {
  it('merges with one equal neighbour at the ceiling: ×2, scored with combo 1', () => {
    const { state, events } = play(board(['2 . . . .'], 2), 1);
    expect(expAt(state, 0, ROWS - 1)).toBe(0);
    expect(expAt(state, 1, ROWS - 1)).toBe(3);
    expect(events).toContainEqual({
      type: 'merge',
      into: { col: 1, row: ROWS - 1 },
      from: [{ col: 0, row: ROWS - 1 }],
      exp: 3,
      gained: 8,
      combo: 1,
      source: 'shot',
    });
    expect(state.score).toBe(8);
  });

  it('absorbs every equal neighbour at once: two neighbours give ×4', () => {
    const { state } = play(board(['2 . 2 . .'], 2), 1);
    expect(expAt(state, 1, ROWS - 1)).toBe(4); // a 4 between two 4s → 16
    expect(state.grid.filter((e) => e > 0)).toEqual([4]);
    expect(state.score).toBe(16);
  });

  it('chains: a merge result that matches a neighbour merges again with a higher combo', () => {
    // Ceiling row "8 _ 4": a 4 fired in the gap merges with the 4 into an 8, which then meets the other 8.
    const { state, events } = play(board(['3 . 2 . .'], 2), 1);
    const merges = events.filter((e) => e.type === 'merge');
    expect(merges.map((m) => [m.exp, m.combo])).toEqual([
      [3, 1],
      [4, 2],
    ]);
    expect(state.grid.filter((e) => e > 0)).toEqual([4]);
    expect(state.score).toBe(8 + 32);
  });

  it('pulls a merged block up to the ceiling', () => {
    // The fired 2 lands below the 2 on the ceiling and merges with it; the result has a hole above and floats up.
    const { state, events } = play(board(['1 . . . .'], 1), 0);
    expect(events).toContainEqual({
      type: 'fall',
      moves: [{ from: { col: 0, row: ROWS - 2 }, to: { col: 0, row: ROWS - 1 }, exp: 2 }],
    });
    expect(expAt(state, 0, ROWS - 1)).toBe(2);
    expect(state.score).toBe(4);
  });
});

describe('the machine', () => {
  it('fills the pressure with the shot’s merges, one each', () => {
    const { state, events } = play(board(['2 . . . .'], 2), 1);
    expect(state.pressure).toBe(1);
    expect(events).toContainEqual({ type: 'pressure', value: 1, max: PRESSURE_MAX });
  });

  it('shakes on the shot that fills the last lamp', () => {
    const start = board(['2 . . . .'], 2, { pressure: PRESSURE_MAX - 1 });
    const { state, events } = play(start, 1);
    expect(events).toContainEqual({ type: 'pressure', value: PRESSURE_MAX, max: PRESSURE_MAX });
    expect(events.some((event) => event.type === 'pulse')).toBe(true);
    expect(events).toContainEqual({ type: 'pressure', value: 0, max: PRESSURE_MAX });
    expect(state.pressure).toBe(0);
  });

  it('a chain adds one per merge', () => {
    const { state } = play(board(['3 . 2 . .'], 2), 1);
    expect(state.pressure).toBe(2);
  });

  it('shakes when the gauge is full: rows slide to the centre and touching equals merge', () => {
    // The gauge is already full; the shot adds nothing, so the machine shakes now.
    // Ceiling row "2 _ 2 _ _": the two 2s slide together and merge for double points.
    const start = board(['1 . 1 . .'], 3, { pressure: PRESSURE_MAX });
    const { state, events } = play(start, 4);
    expect(events.some((e) => e.type === 'pulse')).toBe(true);
    const pulse = events.find((e) => e.type === 'pulse');
    expect(pulse).toMatchObject({
      type: 'pulse',
      slides: [
        { from: { col: 0, row: ROWS - 1 }, to: { col: 1, row: ROWS - 1 }, exp: 1 },
        { from: { col: 4, row: ROWS - 1 }, to: { col: 3, row: ROWS - 1 }, exp: 3 },
      ],
    });
    expect(events).toContainEqual({
      type: 'merge',
      into: { col: 1, row: ROWS - 1 },
      from: [{ col: 2, row: ROWS - 1 }],
      exp: 2,
      gained: 8,
      combo: 1,
      source: 'pulse',
    });
    expect(state.pressure).toBe(0);
    expect(expAt(state, 1, ROWS - 1)).toBe(2);
    expect(expAt(state, 3, ROWS - 1)).toBe(3);
    expect(state.score).toBe(8);
  });

  it('ships a block of 256 or more from the ceiling', () => {
    // A 128 fired beside a 128 on the ceiling makes a 256, which leaves through the chute.
    const { state, events } = play(board(['7 . . . .'], 7), 1);
    expect(events).toContainEqual({
      type: 'ship',
      at: { col: 1, row: ROWS - 1 },
      exp: SHIP_EXP,
      gained: 256 * 3,
    });
    expect(state.grid.filter((e) => e > 0)).toEqual([]);
    expect(state.shipped).toBe(1);
    expect(state.biggestShipped).toBe(SHIP_EXP);
    expect(state.score).toBe(256 + 256 * 3);
    // The ship is not a merge: it adds no pressure.
    expect(state.pressure).toBe(1);
  });

  it('pulls the blocks below a shipped block up into its place', () => {
    const { state, events } = play(board(['7 . . . .', '2 . . . .'], 7), 1);
    expect(events).toContainEqual({
      type: 'fall',
      moves: [{ from: { col: 0, row: ROWS - 2 }, to: { col: 0, row: ROWS - 1 }, exp: 2 }],
    });
    expect(expAt(state, 0, ROWS - 1)).toBe(2);
    expect(state.shipped).toBe(1);
  });

  it('chains a second pulse round at a higher combo, doubling again', () => {
    // Ceiling ". 4 2 2 ." plus an 8 fired at column 0: the two 2s become a 4, which then meets the 4.
    const start = board(['. 2 1 1 .'], 3, { pressure: PRESSURE_MAX });
    const { state, events } = play(start, 0);
    const merges = events.filter(
      (event): event is Extract<GameEvent, { type: 'merge' }> =>
        event.type === 'merge' && event.source === 'pulse',
    );
    expect(merges.map((merge) => [merge.exp, merge.combo, merge.gained])).toEqual([
      [2, 1, 8],
      [3, 2, 32],
    ]);
    expect(state.score).toBe(40);
  });

  it('slides 3, 4 and 5 block rows deterministically toward the centre', () => {
    const pulseSlides = (rows: string[], current: Exponent) => {
      const start = board(rows, current, { pressure: PRESSURE_MAX });
      const { events } = play(start, 0);
      const pulse = events.find((event) => event.type === 'pulse');
      return pulse?.type === 'pulse' ? pulse.slides.filter((slide) => slide.from.row === ROWS - 1) : null;
    };

    expect(pulseSlides(['1 . 2 . 1'], 3)).toEqual([
      { from: { col: 0, row: ROWS - 1 }, to: { col: 1, row: ROWS - 1 }, exp: 1 },
      { from: { col: 4, row: ROWS - 1 }, to: { col: 3, row: ROWS - 1 }, exp: 1 },
    ]);
    expect(pulseSlides(['1 2 . 1 2'], 3)).toEqual([
      { from: { col: 3, row: ROWS - 1 }, to: { col: 2, row: ROWS - 1 }, exp: 1 },
      { from: { col: 4, row: ROWS - 1 }, to: { col: 3, row: ROWS - 1 }, exp: 2 },
    ]);
    expect(pulseSlides(['1 2 1 2 1'], 3)).toEqual([]);
  });
});

describe('end of game', () => {
  it('ends when every column is blocked at the bottom and records a new best', () => {
    // A checkerboard of 2s and 4s with one free cell in row 0 of column 0.
    const rows = ['1 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1', '2 1 2 1 2', '. 2 1 2 1'];
    const start = board(rows, 4, { score: 500, best: 100 });
    expect(isFull(start.grid)).toBe(false);
    const { state, events } = play(start, 0);
    expect(state.over).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'over', score: 500, best: 500, record: true });
    expect(fire(state, 0)).toEqual({ ok: false, reason: 'game_over' });
  });

  it('checks for a jam after the shake, not before it', () => {
    const rows = ['1 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1', '2 1 2 1 2', '1 2 1 2 1', '2 1 2 1 2', '. 2 1 2 1'];
    const start = board(rows, 4, { score: 500, best: 100, pressure: PRESSURE_MAX });
    const { state, events } = play(start, 0);
    expect(events.some((event) => event.type === 'pulse')).toBe(true);
    expect(state.over).toBe(true);
    expect(events.at(-1)?.type).toBe('over');
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
    expect(restore({ ...game, version: 1 })).toBeNull();
    expect(restore({ ...game, pressure: PRESSURE_MAX + 1 })).toBeNull();
    expect(restore({ ...game, shipped: -1 })).toBeNull();
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
            const result = fire(state, col);
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
                  // No hole above a block: every cell below an empty one is empty too.
                  for (let below = r - 1; below >= 0; below--)
                    expect(state.grid[indexOf({ col: c, row: below })]).toBe(0);
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
            expect(state.pressure).toBeGreaterThanOrEqual(0);
            expect(state.pressure).toBeLessThan(PRESSURE_MAX);
          }

          // Deterministic: the same seed and shots give the same game; a saved game continues identically.
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
