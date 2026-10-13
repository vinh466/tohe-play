// Pure game rules: no DOM, no timers, no Math.random. Randomness comes from the injected Rng so a
// seed + a list of actions always reproduces the same game. See docs/guides/create-a-game.md.
import type { Rng } from '@tohe/game-sdk';

export const ROUND_MS = 20_000;
const MAX_RADIUS = 0.12;
const MIN_RADIUS = 0.05;

/** Coordinates are normalised to the square playfield: (0,0) top-left, (1,1) bottom-right. */
export interface Dot {
  x: number;
  y: number;
  r: number;
}

export interface State {
  phase: 'ready' | 'playing' | 'over';
  score: number;
  best: number;
  timeLeftMs: number;
  dot: Dot | null;
}

export function createState(best = 0): State {
  return { phase: 'ready', score: 0, best, timeLeftMs: ROUND_MS, dot: null };
}

export function radiusFor(score: number): number {
  return Math.max(MIN_RADIUS, MAX_RADIUS - score * 0.003);
}

export function spawnDot(rng: Rng, score: number): Dot {
  const r = radiusFor(score);
  return { x: r + rng.next() * (1 - 2 * r), y: r + rng.next() * (1 - 2 * r), r };
}

export function start(state: State, rng: Rng): State {
  return { ...state, phase: 'playing', score: 0, timeLeftMs: ROUND_MS, dot: spawnDot(rng, 0) };
}

export function tick(state: State, dtMs: number): State {
  if (state.phase !== 'playing') return state;
  const timeLeftMs = Math.max(0, state.timeLeftMs - Math.max(0, dtMs));
  if (timeLeftMs > 0) return { ...state, timeLeftMs };
  return { ...state, phase: 'over', timeLeftMs: 0, dot: null, best: Math.max(state.best, state.score) };
}

export function tap(state: State, point: { x: number; y: number }, rng: Rng): { state: State; hit: boolean } {
  const dot = state.dot;
  if (state.phase !== 'playing' || !dot) return { state, hit: false };
  const hit = (point.x - dot.x) ** 2 + (point.y - dot.y) ** 2 <= dot.r ** 2;
  if (!hit) return { state, hit: false };
  const score = state.score + 1;
  return { state: { ...state, score, dot: spawnDot(rng, score) }, hit: true };
}
