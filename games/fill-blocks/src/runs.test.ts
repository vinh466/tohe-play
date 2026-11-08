import { describe, expect, it } from 'vitest';
import { newGame } from './logic.ts';
import { dailyDateOf, isLive, nextLevelId, resumable, slotOf } from './runs.ts';
import { todayId } from './strings.ts';

const endless = newGame(1);
const journey = newGame(2, 0, { mode: 'journey', level: 'g1-1', moveLimit: 20, profile: 'small' });
const today = newGame(3, 0, { mode: 'daily', level: `daily-${todayId()}`, moveLimit: 20 });
const yesterday = newGame(4, 0, { mode: 'daily', level: 'daily-2000-01-01', moveLimit: 20 });

describe('the mode slots', () => {
  it('maps a run to its mode and reads a daily date', () => {
    expect(slotOf(endless)).toBe('endless');
    expect(slotOf(journey)).toBe('journey');
    expect(slotOf(today)).toBe('daily');
    expect(dailyDateOf(today)).toBe(todayId());
    expect(dailyDateOf(journey)).toBeNull();
  });

  it('resumes a parked run only when it is live, of that slot, and of today for a daily', () => {
    expect(resumable({ endless }, 'endless')).toBe(endless);
    expect(resumable({ journey }, 'journey')).toBe(journey);
    expect(resumable({ daily: today }, 'daily')).toBe(today);
    // Yesterday's daily is not today's challenge.
    expect(resumable({ daily: yesterday }, 'daily')).toBeNull();
    // A finished run is not resumed.
    expect(resumable({ endless: { ...endless, over: true } }, 'endless')).toBeNull();
    // A run under the wrong key is not trusted.
    expect(resumable({ endless: journey }, 'endless')).toBeNull();
    expect(resumable({}, 'endless')).toBeNull();
  });

  it('offers the first level without a star, else the last one', () => {
    expect(nextLevelId({}, ['a', 'b', 'c'])).toBe('a');
    expect(nextLevelId({ a: 3, b: 2 }, ['a', 'b', 'c'])).toBe('c');
    expect(nextLevelId({ a: 3, b: 1, c: 2 }, ['a', 'b', 'c'])).toBe('c');
    expect(nextLevelId({}, [])).toBe('');
  });

  it('keeps a run that is not over live', () => {
    expect(isLive(endless)).toBe(true);
    expect(isLive(null)).toBe(false);
    expect(isLive(undefined)).toBe(false);
    expect(isLive({ ...endless, over: true })).toBe(false);
  });
});
