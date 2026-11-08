import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RANKS, rankOf } from './content/ranks.ts';
import { SHAPES, shapeById } from './content/shapes.ts';
import {
  anyPieceFits,
  anyShapeFits,
  drawTray,
  goalMet,
  hint,
  newGame,
  PERFECT_BONUS,
  place,
  placements,
  preview,
  rescue,
  restore,
  SIZE,
  type State,
  starsFor,
} from './logic.ts';

/** Builds a state from rows written top-down, e.g. ['. . . . . . . .', '1 . 2 . . . . .']. */
function boardState(rows: string[], tray: string[], extra: Partial<State> = {}): State {
  const board = new Array<number>(SIZE * SIZE).fill(0);
  rows.forEach((line, row) => {
    line
      .trim()
      .split(/\s+/)
      .forEach((token, col) => {
        board[row * SIZE + col] = token === '.' ? 0 : Number(token);
      });
  });
  return { ...newGame(1), board, tray, ...extra };
}

const filledRow = (colour: number) => Array.from({ length: SIZE - 1 }, () => colour).join(' ');

describe('the shape set', () => {
  it('has unique ids and cells inside their own bounds', () => {
    expect(new Set(SHAPES.map((shape) => shape.id)).size).toBe(SHAPES.length);
    for (const shape of SHAPES) {
      const seen = new Set<string>();
      for (const [row, col] of shape.cells) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(seen.has(`${row},${col}`)).toBe(false);
        seen.add(`${row},${col}`);
      }
      expect(shape.colour).toBeGreaterThanOrEqual(1);
      expect(shape.colour).toBeLessThanOrEqual(8);
    }
  });
});

describe('new games', () => {
  it('are deterministic for a seed and different for another', () => {
    expect(newGame(42).tray).toEqual(newGame(42).tray);
    expect(newGame(42).tray).not.toEqual(newGame(43).tray);
    expect(newGame(42).rng).toBe(newGame(42).rng);
  });

  it('starts empty and with three pieces that fit the empty board', () => {
    const game = newGame(7);
    expect(game.board.every((cell) => cell === 0)).toBe(true);
    expect(game.tray).toHaveLength(3);
    expect(anyPieceFits(game)).toBe(true);
    expect(goalMet(game, { kind: 'score', value: 1 })).toBe(false);
  });
});

describe('placing', () => {
  it('scores one per cell and removes the piece from the tray', () => {
    const state = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single', 'domino-h', 'tri-h'],
    );
    const result = place(state, 0, 0, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board[0]).toBe(shapeById('single')?.colour);
    expect(result.state.score).toBe(1);
    expect(result.state.tray).toEqual(['domino-h', 'tri-h']);
    expect(result.state.moves).toBe(1);
  });

  it('clears a full row and raises the combo', () => {
    const rows = [
      `${filledRow(2)} .`,
      ...Array.from({ length: 6 }, () => '. . . . . . . .'),
      '3 . . . . . . .',
    ];
    const state = boardState(rows, ['single']);
    const result = place(state, 0, 0, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lines).toBe(1);
    expect(result.state.combo).toBe(2);
    expect(result.state.maxCombo).toBe(2);
    expect(result.state.score).toBe(1 + 10);
    expect(result.state.board.slice(0, SIZE)).toEqual(new Array(SIZE).fill(0));
    expect(result.events.some((event) => event.type === 'clear')).toBe(true);
  });

  it('clears a row and a column together: 10 × 2²', () => {
    const rows = [
      `${filledRow(2)} .`,
      '. . . . . . . 3',
      '. . . . . . . 3',
      '. . . . . . . 3',
      '. . . . . . . 3',
      '. . . . . . . 3',
      '. . . . . . . 3',
      '3 . . . . . . 3',
    ];
    const state = boardState(rows, ['single']);
    const result = place(state, 0, 0, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lines).toBe(2);
    expect(result.state.score).toBe(1 + 40);
    expect(result.state.combo).toBe(2);
  });

  it('lowers the combo by one when a placement clears nothing', () => {
    const state = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single'],
      { combo: 4, maxCombo: 4 },
    );
    const result = place(state, 0, 0, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.combo).toBe(3);
    expect(result.state.maxCombo).toBe(4);
  });

  it('reaches a milestone at ×3: bonus points, a shield and a banner event', () => {
    const rows = [
      `${filledRow(2)} .`,
      ...Array.from({ length: 6 }, () => '. . . . . . . .'),
      '3 . . . . . . .',
    ];
    const state = boardState(rows, ['single'], { combo: 2, maxCombo: 2 });
    const result = place(state, 0, 0, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.combo).toBe(3);
    expect(result.state.shields).toBe(1);
    expect(result.state.score).toBe(1 + 20 + 25);
    const clear = result.events.find((event) => event.type === 'clear');
    expect(clear).toMatchObject({ milestone: { combo: 3, bonus: 25, shield: true }, bonus: 25 });
  });

  it('a shield absorbs a non-clearing placement and keeps the combo', () => {
    const state = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single'],
      {
        combo: 3,
        maxCombo: 3,
        shields: 1,
      },
    );
    const result = place(state, 0, 0, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.combo).toBe(3);
    expect(result.state.shields).toBe(0);
    expect(result.events).toContainEqual({ type: 'shield', left: 0, combo: 3 });
  });

  it('without a shield a non-clearing placement lowers the combo by one', () => {
    const state = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single'],
      {
        combo: 3,
        maxCombo: 3,
        shields: 0,
      },
    );
    const result = place(state, 0, 0, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.combo).toBe(2);
  });

  it('previews the rows and columns a placement would clear', () => {
    const rows = [`${filledRow(2)} .`, ...Array.from({ length: 7 }, () => '. . . . . . . .')];
    const state = boardState(rows, ['single']);
    const look = preview(state, 0, 0, 7);
    expect(look).toEqual({ rows: [0], cols: [], lines: 1, gained: 10, perfect: true });
  });

  it('adds the perfect-clear bonus and counts it', () => {
    const rows = [`${filledRow(2)} .`, ...Array.from({ length: 7 }, () => '. . . . . . . .')];
    const state = boardState(rows, ['single']);
    const result = place(state, 0, 0, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.every((cell) => cell === 0)).toBe(true);
    expect(result.state.perfects).toBe(1);
    expect(result.state.score).toBe(1 + 10 + PERFECT_BONUS);
    expect(result.state.rescue).toBe(1);
    expect(result.state.shields).toBe(1);
  });

  it('refuses a placement that overlaps, leaves the board or on a finished game', () => {
    const state = boardState(
      ['1 . . . . . . .', ...Array.from({ length: 7 }, () => '. . . . . . . .')],
      ['domino-h', 'single', 'single'],
    );
    expect(place(state, 0, 0, 0)).toEqual({ ok: false, reason: 'no_fit' });
    expect(place(state, 0, 7, 7)).toEqual({ ok: false, reason: 'no_fit' });
    expect(place(state, 9, 1, 1)).toEqual({ ok: false, reason: 'no_piece' });
    expect(place({ ...state, over: true }, 0, 1, 1)).toEqual({ ok: false, reason: 'game_over' });
  });
});

describe('the helpful draw', () => {
  it('always offers a fitting shape while any shape fits', () => {
    // Every cell is taken except (7, 7): only the single fits.
    const rows = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (_, col) => (row === 7 && col === 7 ? '.' : '2')).join(' '),
    );
    const state = boardState(rows, ['single']);
    expect(anyShapeFits(state)).toBe(true);
    for (let seed = 0; seed < 50; seed++) {
      const drawn = drawTray(state.board, state.blocked, seed, 0, 'all');
      const fits = drawn.tray.some((id) => {
        const shape = shapeById(id);
        return shape !== undefined && placements(state.board, state.blocked, shape).length > 0;
      });
      expect(fits).toBe(true);
    }
  });
});

describe('rescue', () => {
  it('redraws a stuck tray while a shape can still fit', () => {
    // A board with one hole, and a tray of pieces that cannot fit it.
    const rows = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (_, col) => (row === 7 && col === 7 ? '.' : '2')).join(' '),
    );
    const state = boardState(rows, ['domino-h', 'domino-v', 'tri-h'], { rescue: 1 });
    expect(anyPieceFits(state)).toBe(false);
    expect(anyShapeFits(state)).toBe(true);
    const result = rescue(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.rescue).toBe(0);
    expect(anyPieceFits(result.state)).toBe(true);
    expect(result.events[0]?.type).toBe('rescue');
  });

  it('refuses when nothing fits, nothing is left, or the tray is not stuck', () => {
    const rows = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '2').join(' '));
    const stuck = boardState(rows, ['single'], { rescue: 0 });
    expect(rescue(stuck)).toEqual({ ok: false, reason: 'no_shape' });
    const withOne = boardState(rows, ['single'], { rescue: 1 });
    expect(rescue(withOne)).toEqual({ ok: false, reason: 'no_shape' });
    const open = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single'],
      { rescue: 1 },
    );
    expect(rescue(open)).toEqual({ ok: false, reason: 'not_stuck' });
  });
});

describe('hints', () => {
  it('finds a legal placement, or none on a full board', () => {
    const open = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single', 'domino-h', 'tri-h'],
    );
    const move = hint(open);
    expect(move).not.toBeNull();
    if (move) expect(place(open, move.pieceIndex, move.row, move.col).ok).toBe(true);
    const full = boardState(
      Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '2').join(' ')),
      ['single'],
      { rescue: 0 },
    );
    expect(hint(full)).toBeNull();
  });
});

describe('levels', () => {
  it('counts stars by the goals met', () => {
    const state = boardState(
      Array.from({ length: SIZE }, () => '. . . . . . . .'),
      ['single'],
      {
        score: 100,
        lines: 3,
        maxClear: 2,
      },
    );
    expect(
      starsFor(state, [
        { kind: 'score', value: 50 },
        { kind: 'lines', value: 3 },
        { kind: 'clear', value: 3 },
      ]),
    ).toBe(2);
  });
});

describe('ranks', () => {
  it('moves up at each threshold and stops at the top', () => {
    expect(rankOf(0).rank.id).toBe(RANKS[0]?.id);
    expect(rankOf(99).rank.id).toBe(RANKS[0]?.id);
    expect(rankOf(100).rank.id).toBe(RANKS[1]?.id);
    expect(rankOf(1_000_000).rank.id).toBe(RANKS[RANKS.length - 1]?.id);
    expect(rankOf(1_000_000).next).toBeNull();
  });
});

describe('saves', () => {
  it('restores valid games and rejects damaged ones', () => {
    const game = place(newGame(3), 0, 0, 0);
    expect(game.ok).toBe(true);
    if (!game.ok) return;
    expect(restore(JSON.parse(JSON.stringify(game.state)))).toEqual(game.state);
    expect(restore({ ...game.state, board: [1, 2] })).toBeNull();
    expect(restore({ ...game.state, version: 2 })).toBeNull();
    expect(restore({ ...game.state, tray: [] })).toBeNull();
    expect(restore({ ...game.state, mode: 'other' })).toBeNull();
    expect(restore(null)).toBeNull();
    const { shields: _shields, streak: _streak, maxStreak: _maxStreak, ...old } = game.state;
    const restored = restore(old);
    expect(restored?.shields).toBe(0);
    expect(restored?.streak).toBe(0);
    expect(restored?.maxStreak).toBe(0);
  });
});

describe('random play (bot)', () => {
  it('keeps the invariants, replays exactly and survives a save round trip', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (seed) => {
        let state = newGame(seed, 0, { profile: 'all' });
        const moves: { piece: number; row: number; col: number }[] = [];
        // A deterministic local choice stream, so the same seed produces the same game.
        let choice = seed >>> 0;
        const next = () => {
          choice = (choice * 1664525 + 1013904223) >>> 0;
          return choice / 4294967296;
        };
        for (let step = 0; step < 400; step++) {
          const legal: { piece: number; row: number; col: number }[] = [];
          for (let piece = 0; piece < state.tray.length; piece++) {
            const shape = shapeById(state.tray[piece] ?? '');
            if (!shape) continue;
            for (const spot of placements(state.board, state.blocked, shape)) {
              legal.push({ piece, row: spot.row, col: spot.col });
            }
          }
          if (legal.length === 0) {
            if (state.rescue > 0 && anyShapeFits(state)) {
              const helped = rescue(state);
              expect(helped.ok).toBe(true);
              if (!helped.ok) break;
              state = helped.state;
              continue;
            }
            break;
          }
          const move = legal[Math.floor(next() * legal.length)];
          if (!move) break;
          const result = place(state, move.piece, move.row, move.col);
          expect(result.ok).toBe(true);
          if (!result.ok) break;
          expect(result.state.score).toBeGreaterThanOrEqual(state.score);
          state = result.state;
          moves.push(move);
          expect(state.tray.length).toBeGreaterThanOrEqual(1);
          expect(state.tray.length).toBeLessThanOrEqual(3);
          expect(state.combo).toBeGreaterThanOrEqual(1);
          expect(state.combo).toBeLessThanOrEqual(8);
          expect(state.shields).toBeGreaterThanOrEqual(0);
          expect(state.shields).toBeLessThanOrEqual(2);
          expect(state.streak).toBeGreaterThanOrEqual(0);
          // No full row or column may remain after a placement.
          for (let row = 0; row < SIZE; row++) {
            let full = true;
            for (let col = 0; col < SIZE; col++) if ((state.board[row * SIZE + col] ?? 0) === 0) full = false;
            expect(full).toBe(false);
          }
          for (let col = 0; col < SIZE; col++) {
            let full = true;
            for (let row = 0; row < SIZE; row++) if ((state.board[row * SIZE + col] ?? 0) === 0) full = false;
            expect(full).toBe(false);
          }
          if (state.over) break;
        }

        // The same seed and moves give the same game, and a restored game continues identically.
        let again = newGame(seed, 0, { profile: 'all' });
        for (const move of moves) {
          const result = place(again, move.piece, move.row, move.col);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          again = result.state;
        }
        expect(again).toEqual(state);
        const restored = restore(JSON.parse(JSON.stringify(state)));
        expect(restored).toEqual(state);
      }),
      { numRuns: 80 },
    );
  });
});
