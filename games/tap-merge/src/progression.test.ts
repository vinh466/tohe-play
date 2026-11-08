import { describe, expect, it } from 'vitest';
import { ALBUM_CARDS, BADGES, earnedBadges } from './content/album.ts';
import {
  CHAPTERS,
  chapterUnlocked,
  dailyDone,
  dailySeed,
  dailyStars,
  LEVELS,
  levelComplete,
  levelStars,
  nextLevel,
} from './content/levels.ts';
import { todayId } from './date.ts';
import {
  DAILY_TAPS,
  newDailyGame,
  newGame,
  newLevelGame,
  restore,
  type State,
  shuffle,
  tap,
} from './logic.ts';

const level = LEVELS[0];
if (!level) throw new Error('no levels');

const at = (state: State, moves: number, top = state.top): State => ({ ...state, moves, top });

describe('the Journey levels', () => {
  it('are full snapshots with a target above the start and an ordered par', () => {
    const starts = new Set<string>();
    for (const item of LEVELS) {
      expect(item.start).toHaveLength(35);
      expect(Math.max(...item.start)).toBe(item.top);
      expect(item.target).toBeGreaterThan(item.top);
      expect(item.target - item.top).toBeLessThanOrEqual(2);
      expect(item.par.three).toBeLessThan(item.par.two);
      expect(new Set(item.start).size).toBeGreaterThan(1);
      starts.add(item.start.join(','));
    }
    expect(starts.size).toBe(LEVELS.length);
  });

  it('opens the next chapter at six completed levels', () => {
    const journey: Record<string, number> = {};
    const second = CHAPTERS[1];
    const third = CHAPTERS[2];
    if (!second || !third) throw new Error('no chapters');
    expect(chapterUnlocked(second, journey)).toBe(false);
    for (const level of LEVELS.filter((item) => item.chapter === 1).slice(0, 6)) journey[level.id] = 1;
    expect(chapterUnlocked(second, journey)).toBe(true);
    expect(chapterUnlocked(third, journey)).toBe(false);
    for (const level of LEVELS.filter((item) => item.chapter === 2).slice(0, 6)) journey[level.id] = 1;
    expect(chapterUnlocked(third, journey)).toBe(true);
  });

  it('gives 1 star for finishing and 2/3 by the par', () => {
    const state = newLevelGame(level);
    const finished = { ...state, top: level.target };
    expect(levelComplete(finished, level)).toBe(true);
    expect(levelStars(at(finished, level.par.three), level)).toBe(3);
    expect(levelStars(at(finished, level.par.three + 1), level)).toBe(2);
    expect(levelStars(at(finished, level.par.two + 1), level)).toBe(1);
    expect(levelStars(state, level)).toBe(0);
  });

  it('starts with three shuffles, earns up to five, and counts the ones used', () => {
    const first = LEVELS.find((item) => item.par.three > 0);
    if (!first) throw new Error('no level');
    let state = newLevelGame(first);
    expect(state.mode).toBe('journey');
    expect(state.shuffles).toBe(3);
    // A new top earns a shuffle; the cap is 5 for a Journey level.
    state = { ...state, grid: state.grid.map(() => 2), top: 1, shuffles: 4 };
    const played = tap(state, { col: 0, row: 0 });
    expect(played.ok).toBe(true);
    if (played.ok) expect(played.state.shuffles).toBe(5);
    // A 4-colour king-graph pattern has no equal neighbours: a shuffle is legal and is counted.
    const fourColour = Array.from({ length: 35 }, (_, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      return (row % 2) * 2 + (col % 2) + 1;
    });
    const afterShuffle = shuffle({ ...state, grid: fourColour, top: 4, shuffles: 1 });
    expect(afterShuffle.ok).toBe(true);
    if (afterShuffle.ok) expect(afterShuffle.state.shufflesUsed).toBe(1);
  });

  it('has a next level inside a chapter', () => {
    expect(nextLevel(level)?.chapter).toBe(level.chapter);
    const lastOfChapterOne = LEVELS[7];
    expect(lastOfChapterOne && nextLevel(lastOfChapterOne)).toBeNull();
  });
});

describe('the Daily', () => {
  it('is stable for a date and different across dates', () => {
    expect(dailySeed('20261108')).toBe(dailySeed('20261108'));
    expect(dailySeed('20261108')).not.toBe(dailySeed('20261109'));
  });

  it('starts a 120-tap daily and ends at the budget', () => {
    const state = newDailyGame('20261108', dailySeed('20261108'));
    expect(state.mode).toBe('daily');
    expect(state.level).toBe('daily-20261108');
    expect(state.moveLimit).toBe(DAILY_TAPS);
    expect(state.over).toBe(false);
    expect(DAILY_TAPS).toBe(120);
  });

  it('gives stars at 1K, 2K and 4K', () => {
    expect(dailyStars(9)).toBe(0);
    expect(dailyStars(10)).toBe(1);
    expect(dailyStars(11)).toBe(2);
    expect(dailyStars(12)).toBe(3);
    expect(dailyStars(13)).toBe(3);
  });

  it('ends exactly when the budget is spent or the board is stuck', () => {
    const state = newDailyGame('20261108', 42);
    expect(dailyDone({ ...state, moves: 119 })).toBe(false);
    expect(dailyDone({ ...state, moves: 120 })).toBe(true);
    expect(dailyDone({ ...state, moves: 3, over: true })).toBe(true);
  });
});

describe('the save across modes', () => {
  it('opens an old classic save with no mode fields', () => {
    const classic = newGame(5);
    const old = { ...classic } as Record<string, unknown>;
    delete old.mode;
    delete old.level;
    delete old.moveLimit;
    delete old.shufflesUsed;
    const restored = restore(old);
    expect(restored?.mode).toBe('classic');
    expect(restored?.level).toBeNull();
    expect(restored?.moveLimit).toBeNull();
    expect(restored?.shufflesUsed).toBe(0);
  });

  it('restores a Journey state exactly and a bad mode is rejected', () => {
    const journeyLevel = LEVELS[2];
    if (!journeyLevel) throw new Error('no level');
    const journey = newLevelGame(journeyLevel);
    expect(restore(JSON.parse(JSON.stringify(journey)))).toEqual(journey);
    expect(restore({ ...journey, mode: 'nope' })).toBeNull();
    expect(restore({ ...journey, moveLimit: -1 })).toBeNull();
    expect(restore({ ...journey, shuffles: 9 })).toBeNull();
  });

  it('restores a daily state with its budget', () => {
    const daily = newDailyGame('20261108', 42);
    const restored = restore(JSON.parse(JSON.stringify(daily)));
    expect(restored).toEqual(daily);
    expect(restored?.moveLimit).toBe(DAILY_TAPS);
  });
});

describe('Sổ Tay Khối', () => {
  it('has twenty cards from 2 to 1M', () => {
    expect(ALBUM_CARDS).toHaveLength(20);
    expect(ALBUM_CARDS[0]?.exp).toBe(1);
    expect(ALBUM_CARDS.at(-1)?.exp).toBe(20);
  });

  it('has eleven badges and earns them from the shared context', () => {
    expect(BADGES).toHaveLength(11);
    const context = {
      best: 1_000_000,
      classicRuns: 10,
      maxAbsorbed: 20,
      noShuffleLevels: 1,
      journey: Object.fromEntries(
        LEVELS.filter((level) => level.chapter === 1).map((level) => [level.id, 3]),
      ),
      dailyDates: Object.fromEntries(
        Array.from({ length: 20 }, (_, index) => [
          `${todayId().slice(0, 6)}${String(index + 1).padStart(2, '0')}`,
          3,
        ]),
      ),
      album: new Set(ALBUM_CARDS.map((card) => card.exp)),
      month: todayId().slice(0, 6),
    };
    expect(earnedBadges(context)).toEqual(BADGES.map((badge) => badge.id));
  });
});
