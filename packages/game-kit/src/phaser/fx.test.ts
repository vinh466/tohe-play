import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { type FxSheet, fxOrigin, fxTimeline, playFx } from './fx.ts';

const sheet: FxSheet = {
  key: 'fx-crit-hit',
  frames: 28,
  fps: 30,
  frameWidth: 216,
  frameHeight: 136,
  pivot: [84, 106],
  act: { windup: 0.55, hits: [{ t: 0.06, freeze: 0.14, shake: 0.18, amp: 2, push: 2.8 }] },
};

describe('fxTimeline', () => {
  it('turns frames and act hits into millisecond timing', () => {
    const timeline = fxTimeline(sheet);
    expect(timeline.frames).toBe(28);
    expect(timeline.frameMs).toBeCloseTo(1000 / 30);
    expect(timeline.durationMs).toBeCloseTo((28 * 1000) / 30);
    expect(timeline.hits.map((hit) => hit.atMs)).toEqual([60]);
    expect(timeline.hits[0]?.hit.freeze).toBe(0.14);
  });

  it('sorts hits and drops negatives', () => {
    const timeline = fxTimeline({
      ...sheet,
      act: { hits: [{ t: 0.2 }, { t: -1 }, { t: 0.05 }] },
    });
    expect(timeline.hits.map((hit) => hit.atMs)).toEqual([50, 200]);
  });

  it('refuses a malformed sheet', () => {
    expect(() => fxTimeline({ ...sheet, frames: 0 })).toThrow('frames');
    expect(() => fxTimeline({ ...sheet, fps: 0 })).toThrow('fps');
  });
});

describe('fxOrigin', () => {
  it('uses the sheet pivot, or the frame centre', () => {
    expect(fxOrigin(sheet)).toEqual({ x: 84 / 216, y: 106 / 136 });
    expect(fxOrigin({ ...sheet, pivot: undefined })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('playFx', () => {
  function fakeScene() {
    const timers: { delay: number; run: () => void; removed: boolean }[] = [];
    const sprite = {
      setDepth: vi.fn(() => sprite),
      setScale: vi.fn(() => sprite),
      setFlipX: vi.fn(() => sprite),
      setOrigin: vi.fn(() => sprite),
      setFrame: vi.fn(() => sprite),
      destroy: vi.fn(),
    };
    const timer = (delay: number, run: () => void) => {
      const entry = { delay, run, removed: false };
      timers.push(entry);
      return {
        remove: () => {
          entry.removed = true;
        },
      };
    };
    const scene = {
      add: { sprite: vi.fn(() => sprite) },
      time: {
        delayedCall: (delay: number, run: () => void) => timer(delay, run),
        addEvent: ({ delay, callback }: { delay: number; callback: () => void }) => timer(delay, callback),
      },
    } as unknown as Phaser.Scene;
    return { scene, sprite, timers };
  }

  it('frames the effect, reports the hit and destroys the sprite', () => {
    const { scene, sprite, timers } = fakeScene();
    const onHit = vi.fn();
    playFx(scene, sheet, { x: 10, y: 20, onHit });
    expect(sprite.setOrigin).toHaveBeenCalledWith(84 / 216, 106 / 136);
    expect(timers).toHaveLength(29); // 27 frame changes + one hit + the finish
    for (const timer of timers.sort((a, b) => a.delay - b.delay)) timer.run();
    expect(onHit).toHaveBeenCalledOnce();
    expect(sprite.setFrame).toHaveBeenCalledTimes(27);
    expect(sprite.destroy).toHaveBeenCalledOnce();
  });

  it('stops a loop without a natural end', () => {
    const { scene, sprite } = fakeScene();
    const handle = playFx(scene, { ...sheet, loop: true }, { x: 0, y: 0 });
    handle.stop();
    expect(sprite.destroy).toHaveBeenCalledOnce();
    return handle.done;
  });
});
