import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type ChallengeSlot,
  challengePayload,
  openChallenge,
  outcome,
  readEntry,
  restoreChallenge,
} from './challenge.ts';
import { drop, newGame, restore, type State } from './logic.ts';

/** The payloads the build ships for conformance (ADR 0045): what "Thách bạn" makes. */
const samples = JSON.parse(
  readFileSync(new URL('../public/entries/share.json', import.meta.url), 'utf8'),
) as unknown[];

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

function play(state: State, cols: number[]): State {
  let next = state;
  for (const col of cols) {
    const result = drop(next, col);
    if (result.ok) next = result.state;
  }
  return next;
}

describe('the payloads "Thách bạn" shares (ADR 0045)', () => {
  it('look like those in entries/share.json, which the game opens', () => {
    expect(samples.length).toBeGreaterThanOrEqual(1);
    expect(samples.length).toBeLessThanOrEqual(5);
    const made = challengePayload(newGame(20261013).seed ?? 0, 12340);
    for (const sample of samples) {
      expect(Object.keys(sample as object).sort()).toEqual(Object.keys(made).sort());
      expect(bytes(sample)).toBeLessThanOrEqual(2048);
      expect(readEntry('share', sample).result).toBe('handled');
    }
    expect(readEntry('share', made)).toEqual({ result: 'handled', challenge: made });
    // Through JSON, as the hub carries it.
    expect(readEntry('share', JSON.parse(JSON.stringify(made))).result).toBe('handled');
  });

  it('shares the seed the game started from, so the same blocks are dealt again', () => {
    const game = play(newGame(913), [0, 1, 2, 3, 4, 0, 1]);
    expect(game.seed).toBe(913);
    const opened = readEntry('share', challengePayload(game.seed ?? -1, game.score));
    if (opened.result !== 'handled') throw new Error(opened.result);
    const again = newGame(opened.challenge.seed);
    expect([again.current, again.next, again.rng]).toEqual([
      newGame(913).current,
      newGame(913).next,
      newGame(913).rng,
    ]);
  });

  it.each([
    ['null', null],
    ['a string', 'Thách bạn!'],
    ['an array', [1, 913, 12]],
    ['wrong types', { v: 1, seed: '913', score: 12 }],
    ['a negative score', { v: 1, seed: 913, score: -5 }],
    ['a fractional seed', { v: 1, seed: 1.5, score: 12 }],
    ['a seed past 32 bits', { v: 1, seed: 2 ** 32, score: 12 }],
    ['an absurd score', { v: 1, seed: 1, score: 1e15 }],
    ['extra fields', { v: 1, seed: 1, score: 1, from: 'admin' }],
    ['no version', { seed: 1, score: 1 }],
    ['deep nesting', { v: 1, seed: [[[[1]]]], score: 1 }],
  ])('refuses %s as invalid', (_label, payload) => {
    expect(readEntry('share', payload).result).toBe('invalid');
  });

  it('leaves a payload of a newer version, or another kind, as unsupported', () => {
    expect(readEntry('share', { v: 2, seed: 1, score: 1, board: 'x' }).result).toBe('unsupported');
    expect(readEntry('daily', challengePayload(1, 1)).result).toBe('unsupported');
  });
});

describe('the challenge slot', () => {
  const challenge = challengePayload(913, 12340);
  const from = { name: 'Na', avatar: '🐱' };
  let runs = 0;
  const newRun = () => `run-${++runs}`;

  it('starts a fresh game from the link’s seed, with its own run', () => {
    const slot = openChallenge(null, challenge, from, 500, newRun);
    expect(slot).toMatchObject({ seed: 913, target: 12340, from, run: expect.stringMatching(/^run-/) });
    expect(slot.game).toEqual(newGame(913, 500));
  });

  it('continues the same challenge in progress — the game opened again — and starts another afresh', () => {
    const slot = openChallenge(null, challenge, from, 0, newRun);
    const played: ChallengeSlot = { ...slot, game: play(slot.game as State, [0, 1, 2]) };
    expect(openChallenge(played, challenge, from, 0, newRun)).toBe(played);
    const other = openChallenge(played, challengePayload(914, 12340), from, 0, newRun);
    expect(other.seed).toBe(914);
    expect(other.run).not.toBe(played.run);
    expect(openChallenge(played, challenge, null, 0, newRun)).not.toBe(played);
    const finished: ChallengeSlot = { ...played, game: null };
    expect(openChallenge(finished, challenge, from, 0, newRun).game?.moves).toBe(0);
  });

  it('never touches the regular game: its own state, from its own seed', () => {
    const regular = play(newGame(42), [0, 0, 1]);
    const copy = JSON.parse(JSON.stringify(regular));
    const slot = openChallenge(null, challenge, from, regular.best, newRun);
    play(slot.game as State, [2, 3, 4]);
    expect(regular).toEqual(copy);
    expect(slot.game?.seed).toBe(913);
  });

  it('reads back from the save, and drops what is not a slot', () => {
    const slot = openChallenge(null, challenge, from, 0, newRun);
    const saved = JSON.parse(JSON.stringify({ ...slot, game: play(slot.game as State, [1]) }));
    expect(restoreChallenge(saved)).toEqual(saved);
    expect(restoreChallenge({ ...saved, game: null })?.game).toBeNull();
    expect(restoreChallenge({ ...saved, from: null })?.from).toBeNull();
    expect(restoreChallenge(undefined)).toBeNull();
    expect(restoreChallenge({ ...saved, seed: -1 })).toBeNull();
    expect(restoreChallenge({ ...saved, game: { grid: [] } })).toBeNull();
    expect(restoreChallenge({ ...saved, from: { name: 3 } })).toBeNull();
  });

  it('says whether the claimed score was beaten, and by how much it was not', () => {
    expect(outcome(12341, 12340)).toEqual({ beaten: true, short: 0 });
    expect(outcome(12000, 12340)).toEqual({ beaten: false, short: 340 });
    expect(outcome(12340, 12340)).toEqual({ beaten: false, short: 1 });
  });
});

describe('the start seed in the state', () => {
  it('is kept by a new game and through a save; a game saved before has none', () => {
    const game = play(newGame(77), [0, 1]);
    expect(restore(JSON.parse(JSON.stringify(game)))?.seed).toBe(77);
    const { seed: _seed, ...old } = game;
    const restored = restore(JSON.parse(JSON.stringify(old)));
    expect(restored).not.toBeNull();
    expect(restored?.seed).toBeUndefined();
    expect(restore({ ...game, seed: 'x' })?.seed).toBeUndefined();
  });
});
