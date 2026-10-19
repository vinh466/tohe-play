import { describe, expect, it } from 'vitest';
import { dateInVietnam, newestTag, nextTagName, sortTags } from './tags.ts';

describe('newestTag', () => {
  it('sorts the counter as a number: .10 is after .2', () => {
    const tags = ['uat-2026-10-21.2', 'uat-2026-10-21.10', 'uat-2026-10-21.1'];
    expect(sortTags(tags, 'uat')).toEqual(['uat-2026-10-21.1', 'uat-2026-10-21.2', 'uat-2026-10-21.10']);
    expect(newestTag(tags, 'uat')).toBe('uat-2026-10-21.10');
  });

  it('sorts by date before the counter', () => {
    expect(newestTag(['uat-2026-10-21.9', 'uat-2026-11-02.1', 'uat-2026-10-30.3'], 'uat')).toBe(
      'uat-2026-11-02.1',
    );
  });

  it('only looks at its own prefix and ignores other tags', () => {
    const tags = ['uat-2026-10-21.1', 'prod-2026-10-22.1', 'v1.0.0', 'uat-latest', 'prod-2026-10-20.1'];
    expect(newestTag(tags, 'uat')).toBe('uat-2026-10-21.1');
    expect(newestTag(tags, 'prod')).toBe('prod-2026-10-22.1');
  });

  it('is null when there is no tag', () => {
    expect(newestTag([], 'prod')).toBeNull();
    expect(newestTag(['uat-2026-10-21.1'], 'prod')).toBeNull();
  });
});

describe('nextTagName', () => {
  const now = new Date('2026-10-21T03:00:00Z');

  it('starts at 1 on a day with no tag', () => {
    expect(nextTagName([], 'uat', now)).toBe('uat-2026-10-21.1');
    expect(nextTagName(['uat-2026-10-20.4'], 'uat', now)).toBe('uat-2026-10-21.1');
  });

  it("continues today's count, as a number", () => {
    expect(nextTagName(['uat-2026-10-21.1', 'uat-2026-10-21.2'], 'uat', now)).toBe('uat-2026-10-21.3');
    expect(nextTagName(['uat-2026-10-21.9', 'uat-2026-10-21.10'], 'uat', now)).toBe('uat-2026-10-21.11');
  });

  it('counts each prefix on its own', () => {
    expect(nextTagName(['uat-2026-10-21.5'], 'prod', now)).toBe('prod-2026-10-21.1');
  });

  it('takes the date in Việt Nam time, not UTC', () => {
    // 20:00 UTC on the 21st is 03:00 on the 22nd in Việt Nam.
    expect(dateInVietnam(new Date('2026-10-21T20:00:00Z'))).toBe('2026-10-22');
    expect(nextTagName([], 'prod', new Date('2026-10-21T20:00:00Z'))).toBe('prod-2026-10-22.1');
    expect(dateInVietnam(new Date('2026-10-21T16:59:00Z'))).toBe('2026-10-21');
  });
});
