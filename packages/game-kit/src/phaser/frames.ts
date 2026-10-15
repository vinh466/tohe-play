// Frame-time summaries for telemetry (ADR 0015): what the #perf readout shows on screen, added up over a minute of
// play and sent through the session's telemetry, so slow devices show up without a phone in hand. Per frame it costs
// a subtraction and an array write. Only types from Phaser, so the rules here are tested without a browser.
import type { FrameSummary, Telemetry } from '@tohe/game-sdk';
import type Phaser from 'phaser';

/** Upper bounds of the frame-time buckets in ms (the contract's FRAME_BUCKETS_MS); the last bucket is slower. */
export const FRAME_BUCKETS_MS = [17, 25, 33, 50, 100] as const;
/** A gap this long between frames is the game not being shown (tab hidden, phone locked), not a slow frame. */
const PAUSE_GAP_MS = 1000;
/** Step times kept for the percentiles: a uniform sample of the period. */
const STEP_SAMPLES = 256;
/** Fewer frames than this say nothing worth sending. */
const MIN_FRAMES = 30;
/** One summary per this much play. */
export const SUMMARY_EVERY_MS = 60_000;

export function bucketOf(frameMs: number): number {
  const index = FRAME_BUCKETS_MS.findIndex((limit) => frameMs <= limit);
  return index === -1 ? FRAME_BUCKETS_MS.length : index;
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/** Frame and step times of one period of play. */
export class FrameStats {
  private buckets = new Array<number>(FRAME_BUCKETS_MS.length + 1).fill(0);
  private slowest = 0;
  private frames = 0;
  private steps: number[] = [];
  private seen = 0;
  /** Play time covered, in ms. */
  played = 0;

  constructor(private readonly random: () => number = Math.random) {}

  /** One frame: the time since the previous one, and how long the game's own step and render took. */
  add(frameMs: number, stepMs: number): void {
    if (frameMs <= 0 || frameMs > PAUSE_GAP_MS) return;
    this.frames++;
    this.played += frameMs;
    this.buckets[bucketOf(frameMs)] = (this.buckets[bucketOf(frameMs)] ?? 0) + 1;
    if (frameMs > this.slowest) this.slowest = frameMs;
    // Reservoir sampling: every step time has the same chance to be kept, whatever the length of the period.
    this.seen++;
    if (this.steps.length < STEP_SAMPLES) this.steps.push(stepMs);
    else {
      const slot = Math.floor(this.random() * this.seen);
      if (slot < STEP_SAMPLES) this.steps[slot] = stepMs;
    }
  }

  /** The period as telemetry reports it, or null when too short to mean anything. */
  summary(renderer?: 'webgl' | 'canvas'): FrameSummary | null {
    if (this.frames < MIN_FRAMES) return null;
    const steps = [...this.steps].sort((a, b) => a - b);
    return {
      buckets: [...this.buckets],
      slowestMs: round(this.slowest),
      stepP50Ms: round(percentile(steps, 50)),
      stepP95Ms: round(percentile(steps, 95)),
      ...(renderer ? { renderer } : {}),
    };
  }

  reset(): void {
    this.buckets.fill(0);
    this.slowest = 0;
    this.frames = 0;
    this.steps = [];
    this.seen = 0;
    this.played = 0;
  }
}

/** Phaser's game events around one frame (Phaser.Core.Events.PRE_STEP and POST_RENDER). */
const PRE_STEP = 'prestep';
const POST_RENDER = 'postrender';

export interface FrameMeter {
  /** Stop counting frames, e.g. while the hub has paused the game; what was measured is sent. */
  pause(): void;
  resume(): void;
  /** Send what was measured so far, if it is long enough to mean anything. */
  flush(): void;
  detach(): void;
}

/** Measures a running game's frames and hands a summary to telemetry every minute of play. */
export function attachFrameMeter(
  game: Phaser.Game,
  telemetry: Telemetry,
  renderer: 'webgl' | 'canvas',
): FrameMeter {
  const stats = new FrameStats();
  let last = 0;
  let stepStart = 0;
  let paused = false;
  const flush = () => {
    const summary = stats.summary(renderer);
    if (summary) telemetry.frames(summary);
    stats.reset();
  };
  const onPreStep = () => {
    stepStart = performance.now();
  };
  const onPostRender = () => {
    const now = performance.now();
    if (!paused && last > 0) stats.add(now - last, now - stepStart);
    last = now;
    if (stats.played >= SUMMARY_EVERY_MS) flush();
  };
  game.events.on(PRE_STEP, onPreStep);
  game.events.on(POST_RENDER, onPostRender);
  return {
    pause() {
      paused = true;
      flush();
    },
    resume() {
      paused = false;
      last = 0;
    },
    flush,
    detach() {
      game.events.off(PRE_STEP, onPreStep);
      game.events.off(POST_RENDER, onPostRender);
    },
  };
}
