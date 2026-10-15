import { FRAME_BUCKETS_MS as CONTRACT_BUCKETS } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import { bucketOf, FRAME_BUCKETS_MS, FrameStats, percentile } from './phaser/frames.ts';

describe('frame summaries', () => {
  it('uses the contract buckets: up to one 60 Hz frame, then 40, 30, 20, 10 fps, then slower', () => {
    expect(FRAME_BUCKETS_MS).toEqual(CONTRACT_BUCKETS);
    expect([8, 17, 18, 25, 33, 50, 99, 101, 900].map(bucketOf)).toEqual([0, 0, 1, 1, 2, 3, 4, 5, 5]);
  });

  it('adds up a period of play', () => {
    const stats = new FrameStats(() => 0);
    for (let i = 0; i < 100; i++) stats.add(16.7, 2);
    stats.add(48, 30);
    stats.add(140, 90);
    expect(stats.summary('webgl')).toEqual({
      buckets: [100, 0, 0, 1, 0, 1],
      slowestMs: 140,
      stepP50Ms: 2,
      stepP95Ms: 2,
      renderer: 'webgl',
    });
    expect(stats.played).toBeCloseTo(100 * 16.7 + 48 + 140);
  });

  it('does not count the game being hidden as a slow frame', () => {
    const stats = new FrameStats();
    for (let i = 0; i < 40; i++) stats.add(16, 1);
    stats.add(5000, 1);
    expect(stats.summary()?.slowestMs).toBe(16);
  });

  it('sends nothing for a moment too short to mean anything, and starts over after a reset', () => {
    const stats = new FrameStats();
    for (let i = 0; i < 10; i++) stats.add(16, 1);
    expect(stats.summary()).toBeNull();
    for (let i = 0; i < 40; i++) stats.add(16, 1);
    stats.reset();
    expect(stats.summary()).toBeNull();
    expect(stats.played).toBe(0);
  });

  it('keeps a bounded sample of step times for the percentiles', () => {
    const stats = new FrameStats(() => 0.999);
    for (let i = 0; i < 5000; i++) stats.add(16, i % 100);
    const summary = stats.summary();
    expect(summary?.stepP95Ms).toBeGreaterThan(summary?.stepP50Ms ?? 0);
    expect(percentile([1, 2, 3, 4], 50)).toBe(3);
    expect(percentile([], 95)).toBe(0);
  });
});
