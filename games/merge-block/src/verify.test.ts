import { describe, expect, it } from 'vitest';
import { drop, newGame } from './logic.ts';
import { verify } from './verify.ts';

describe('the verify module (ADR 0030)', () => {
  it('replays a run to the score the game reached', () => {
    const seed = 913;
    let state = newGame(seed);
    const moves: number[] = [];
    for (const col of [0, 1, 2, 0, 1, 2, 3, 4, 2, 2]) {
      const result = drop(state, col);
      if (!result.ok) continue;
      state = result.state;
      moves.push(col);
    }
    expect(verify.replay({ seed, moves })).toEqual({ score: state.score, over: state.over });
  });

  it('refuses a move that is not a column, or one the board does not allow', () => {
    expect(verify.replay({ seed: 1, moves: [0, 'x'] })).toEqual({ error: 'move 1 is not a column' });
    expect(verify.replay({ seed: 1, moves: [7] })).toEqual({ error: 'move 0: no_such_column' });
  });

  it('plays a run to its end with its bot, the same way every time', () => {
    const play = () => {
      const moves: number[] = [];
      for (let move = verify.bot({ seed: 7, moves }); move !== null; move = verify.bot({ seed: 7, moves }))
        moves.push(move);
      return moves;
    };
    const moves = play();
    expect(moves).toEqual(play());
    expect(verify.replay({ seed: 7, moves })).toMatchObject({ over: true });
    expect(verify.bot({ seed: 7, moves })).toBeNull();
  });
});
