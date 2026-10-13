import { createRng } from '@tohe/game-sdk';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createState, ROUND_MS, type State, start, tap, tick } from './logic.ts';

const centre = (state: State) => ({ x: state.dot?.x ?? 0, y: state.dot?.y ?? 0 });

describe('rules', () => {
  it('scores a tap on the dot and moves it', () => {
    const rng = createRng(1);
    const playing = start(createState(), rng);
    const { state, hit } = tap(playing, centre(playing), rng);
    expect(hit).toBe(true);
    expect(state.score).toBe(1);
    expect(state.dot).not.toEqual(playing.dot);
  });

  it('ignores a miss', () => {
    const rng = createRng(1);
    const playing = start(createState(), rng);
    const far = { x: (playing.dot?.x ?? 0) > 0.5 ? 0 : 1, y: (playing.dot?.y ?? 0) > 0.5 ? 0 : 1 };
    expect(tap(playing, far, rng)).toEqual({ state: playing, hit: false });
  });

  it('ends the round when time runs out and keeps the best score', () => {
    const rng = createRng(2);
    let state = start(createState(3), rng);
    for (let i = 0; i < 5; i++) state = tap(state, centre(state), rng).state;
    state = tick(state, ROUND_MS);
    expect(state).toMatchObject({ phase: 'over', score: 5, best: 5, dot: null });
  });

  it('is reproducible from a seed and a list of actions', () => {
    const play = (seed: number) => {
      const rng = createRng(seed);
      let state = start(createState(), rng);
      for (let i = 0; i < 10; i++) state = tick(tap(state, centre(state), rng).state, 100);
      return state;
    };
    expect(play(7)).toEqual(play(7));
  });
});

describe('random play (bot)', () => {
  it('never produces invalid state and always finishes', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(
          fc.record({ x: fc.double({ min: 0, max: 1 }), y: fc.double({ min: 0, max: 1 }), dt: fc.nat(500) }),
          {
            maxLength: 300,
          },
        ),
        (seed, actions) => {
          const rng = createRng(seed);
          let state = start(createState(), rng);
          for (const action of actions) {
            state = tick(tap(state, action, rng).state, action.dt);
            expect(Number.isFinite(state.score)).toBe(true);
            expect(state.timeLeftMs).toBeGreaterThanOrEqual(0);
            if (state.dot) {
              expect(state.dot.x - state.dot.r).toBeGreaterThanOrEqual(0);
              expect(state.dot.x + state.dot.r).toBeLessThanOrEqual(1);
            }
          }
          expect(tick(state, ROUND_MS).phase).toBe('over');
        },
      ),
    );
  });
});
