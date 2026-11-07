import { describe, expect, it } from 'vitest';
import { anyPieceFits, newGame } from '../logic.ts';
import { ACHIEVEMENTS } from './achievements.ts';
import { CHAPTERS, DAILY_GOALS, dailySeed, LEVELS } from './levels.ts';
import { RANKS } from './ranks.ts';
import { SHAPES } from './shapes.ts';

describe('the journey content', () => {
  it('has three chapters of six unique levels, each with three goals', () => {
    expect(CHAPTERS).toHaveLength(3);
    expect(LEVELS).toHaveLength(18);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
    for (const chapter of CHAPTERS) {
      expect(LEVELS.filter((level) => level.chapter === chapter.number)).toHaveLength(6);
    }
    for (const level of LEVELS) {
      expect(level.goals).toHaveLength(3);
      expect(level.moveLimit).toBeGreaterThan(0);
      expect(level.seed).toBeGreaterThan(0);
      expect(level.profile).toMatch(/^(small|mixed|all)$/);
    }
  });

  it('opens chapter 2 at 6 stars and chapter 3 at 12', () => {
    expect(CHAPTERS.map((chapter) => chapter.unlockAt)).toEqual([0, 6, 12]);
  });

  it('starts every level with a piece that fits', () => {
    for (const level of LEVELS) {
      const game = newGame(level.seed, 0, { profile: level.profile });
      expect(level.id, `${level.id} has no fitting first piece`).toBeTruthy();
      expect(anyPieceFits(game), `${level.id} has no fitting first piece`).toBe(true);
    }
  });

  it('has three daily goals and a stable daily seed', () => {
    expect(DAILY_GOALS).toHaveLength(3);
    expect(dailySeed('2026-11-08')).toBe(20261108);
    expect(dailySeed('2026-11-08')).toBe(dailySeed('2026-11-08'));
  });
});

describe('the game content', () => {
  it('has 15 achievements with unique ids', () => {
    expect(ACHIEVEMENTS).toHaveLength(15);
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(15);
  });

  it('has ten ranks in ascending order, from zero', () => {
    expect(RANKS).toHaveLength(10);
    expect(RANKS[0]?.at).toBe(0);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]?.at).toBeGreaterThan(RANKS[i - 1]?.at ?? 0);
  });

  it('has 27 unique shapes in its own bounds', () => {
    expect(SHAPES).toHaveLength(27);
    expect(new Set(SHAPES.map((shape) => shape.id)).size).toBe(SHAPES.length);
    for (const shape of SHAPES) {
      for (const [row, col] of shape.cells) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(col).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
