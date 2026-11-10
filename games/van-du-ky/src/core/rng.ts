import type { Rng } from './types.ts';

/** Deterministic PRNG (mulberry32), so a seed and a team always replay the same battle. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next,
    float: () => next() / 0x1_0000_0000,
    int: (max) => (max <= 0 ? 0 : next() % max),
    chance: (p) => (p <= 0 ? false : p >= 1 ? true : next() / 0x1_0000_0000 < p),
  };
}
