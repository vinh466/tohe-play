import { describe, expect, it } from 'vitest';
import { dismissedRecently } from './signInNudge.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-31T12:00:00Z');

describe('the sign-in nudge', () => {
  it('is quiet for seven days after "Để sau"', () => {
    expect(dismissedRecently(null, now)).toBe(false);
    expect(dismissedRecently(now - 6 * DAY, now)).toBe(true);
    expect(dismissedRecently(now - 8 * DAY, now)).toBe(false);
  });
});
