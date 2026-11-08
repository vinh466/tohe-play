import type { Goal, PieceProfile } from '../logic.ts';

export interface Chapter {
  readonly id: string;
  readonly number: number;
  readonly vi: string;
  readonly en: string;
  /** Stars needed in earlier chapters to open this one. */
  readonly unlockAt: number;
  readonly skin: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'giay', number: 1, vi: 'Giấy', en: 'Paper', unlockAt: 0, skin: 'paper' },
  { id: 'muc', number: 2, vi: 'Mực', en: 'Ink', unlockAt: 6, skin: 'ink' },
  { id: 'gac', number: 3, vi: 'Gấc', en: 'Gac', unlockAt: 12, skin: 'gac' },
];

export interface Level {
  readonly id: string;
  readonly chapter: number;
  readonly seed: number;
  readonly profile: PieceProfile;
  readonly moveLimit: number;
  /** The first goal is the primary: a level is complete when it is met. */
  readonly goals: readonly Goal[];
}

const score = (value: number): Goal => ({ kind: 'score', value });
const lines = (value: number): Goal => ({ kind: 'lines', value });
const clear = (value: number): Goal => ({ kind: 'clear', value });
const combo = (value: number): Goal => ({ kind: 'combo', value });
const perfect = (value: number): Goal => ({ kind: 'perfect', value });

/**
 * The first table, tuned by `simulate` before release. A level is one seed; the goals are checked by a greedy bot
 * so no level is impossible and no level gives three stars for nothing.
 */
export const LEVELS: readonly Level[] = [
  // Chapter 1 — Giấy: small pieces, generous goals. The primary goal is below the greedy bot's result so every
  // level is finishable; the third goal is the mastery step.
  {
    id: 'g1-1',
    chapter: 1,
    seed: 101,
    profile: 'small',
    moveLimit: 18,
    goals: [score(50), lines(2), clear(1)],
  },
  {
    id: 'g1-2',
    chapter: 1,
    seed: 202,
    profile: 'small',
    moveLimit: 18,
    goals: [score(80), lines(4), clear(2)],
  },
  {
    id: 'g1-3',
    chapter: 1,
    seed: 303,
    profile: 'small',
    moveLimit: 20,
    goals: [score(130), lines(5), clear(2)],
  },
  {
    id: 'g1-4',
    chapter: 1,
    seed: 404,
    profile: 'small',
    moveLimit: 20,
    goals: [score(90), lines(4), combo(2)],
  },
  {
    id: 'g1-5',
    chapter: 1,
    seed: 505,
    profile: 'small',
    moveLimit: 22,
    goals: [score(120), lines(6), combo(3)],
  },
  {
    id: 'g1-6',
    chapter: 1,
    seed: 606,
    profile: 'small',
    moveLimit: 22,
    goals: [score(100), lines(5), combo(3)],
  },
  // Chapter 2 — Mực: L/T/S/Z and longer levels.
  {
    id: 'g2-1',
    chapter: 2,
    seed: 707,
    profile: 'mixed',
    moveLimit: 24,
    goals: [score(140), lines(6), clear(2)],
  },
  {
    id: 'g2-2',
    chapter: 2,
    seed: 808,
    profile: 'mixed',
    moveLimit: 24,
    goals: [score(140), lines(7), combo(3)],
  },
  {
    id: 'g2-3',
    chapter: 2,
    seed: 909,
    profile: 'mixed',
    moveLimit: 26,
    goals: [score(140), lines(6), clear(2)],
  },
  {
    id: 'g2-4',
    chapter: 2,
    seed: 1010,
    profile: 'mixed',
    moveLimit: 26,
    goals: [score(130), lines(6), combo(3)],
  },
  {
    id: 'g2-5',
    chapter: 2,
    seed: 1111,
    profile: 'mixed',
    moveLimit: 28,
    goals: [score(160), lines(8), clear(2)],
  },
  {
    id: 'g2-6',
    chapter: 2,
    seed: 1212,
    profile: 'mixed',
    moveLimit: 28,
    goals: [score(160), lines(8), combo(3)],
  },
  // Chapter 3 — Gấc: the full bag, precision.
  {
    id: 'g3-1',
    chapter: 3,
    seed: 1313,
    profile: 'all',
    moveLimit: 30,
    goals: [score(170), lines(9), clear(2)],
  },
  {
    id: 'g3-2',
    chapter: 3,
    seed: 1414,
    profile: 'all',
    moveLimit: 30,
    goals: [score(230), lines(9), combo(4)],
  },
  {
    id: 'g3-3',
    chapter: 3,
    seed: 1515,
    profile: 'all',
    moveLimit: 32,
    goals: [score(180), lines(8), clear(2)],
  },
  {
    id: 'g3-4',
    chapter: 3,
    seed: 1616,
    profile: 'all',
    moveLimit: 32,
    goals: [score(220), lines(9), clear(2)],
  },
  {
    id: 'g3-5',
    chapter: 3,
    seed: 1717,
    profile: 'all',
    moveLimit: 34,
    goals: [score(190), lines(9), clear(2)],
  },
  {
    id: 'g3-6',
    chapter: 3,
    seed: 1818,
    profile: 'all',
    moveLimit: 34,
    goals: [score(180), lines(9), combo(4)],
  },
];

export const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export const chapterOf = (level: Level): Chapter =>
  CHAPTERS.find((chapter) => chapter.number === level.chapter) ?? (CHAPTERS[0] as Chapter);

export const DAILY_GOALS: readonly Goal[] = [score(130), lines(6), clear(2)];
export const DAILY_MOVES = 25;

/** A daily's seed is the date as YYYYMMDD, so the same day gives the same pieces. */
export function dailySeed(date: string): number {
  const digits = date.replaceAll('-', '');
  const value = Number(digits);
  return Number.isFinite(value) ? value >>> 0 : 0;
}
