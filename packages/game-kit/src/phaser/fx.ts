// A pixel-art effect from a sprite sheet (E-03, pixelfx): plays one shot on the board and tells the game when the
// effect hits, so the game can freeze/shake/push. The sheet is a uniform spritesheet (the Studio's `spritesheet` kind);
// `act` is the timing data from the effect's JSON, kept in the game's content. Pure timeline helpers are separate so
// they can be tested without Phaser.
import type Phaser from 'phaser';

/** One moment the effect connects: the game decides what to do with it. Times are seconds from the effect's start. */
export interface FxActHit {
  /** When the hit lands, seconds from t = 0. */
  readonly t: number;
  /** How long the board should hold still, seconds. */
  readonly freeze?: number;
  /** Shake strength, seconds. */
  readonly shake?: number;
  /** Shake amplitude, pixels. */
  readonly amp?: number;
  /** How far the target is pushed back, pixels. */
  readonly push?: number;
}

/** The `act` block of a pixelfx effect: the hit moments; the wind-up is played by the game around the effect. */
export interface FxAct {
  readonly windup?: number;
  readonly recovery?: number;
  readonly hits?: readonly FxActHit[];
}

/** A one-shot effect sheet, as the game declares it in its `content/fx.ts`. */
export interface FxSheet {
  /** The Phaser texture key the spritesheet was loaded under. */
  readonly key: string;
  /** How many frames the sheet has (the Studio's `frames.count`). */
  readonly frames: number;
  /** Frames per second; pixelfx exports 30 by default. */
  readonly fps?: number;
  /** Frame size in pixels, for the pivot; the Studio's `spritesheet` asset has it. */
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  /** The origin of the effect inside a frame, in pixels from the frame's top-left; default the frame's centre. */
  readonly pivot?: readonly [x: number, y: number];
  /** The hit timing; without it the effect is visual only. */
  readonly act?: FxAct;
  /** The frame-name prefix when the sheet was loaded from a named atlas (`"crit-hit"`), not a uniform spritesheet. */
  readonly framePrefix?: string;
  /** Loop forever (a portal, weather); a one-shot by default. */
  readonly loop?: boolean;
}

export interface PlayFxOptions {
  readonly x: number;
  readonly y: number;
  /** Mirror the effect horizontally (the target faces the other way). */
  readonly flip?: boolean;
  /** Scale the whole effect; 1 is the sheet's pixel size. */
  readonly scale?: number;
  /** Draw order; effects sit above the cards by default. */
  readonly depth?: number;
  /** A hit landed: the game freezes/shakes/pushes. */
  readonly onHit?: (hit: FxActHit) => void;
  /** Skip shake-like feedback; the effect still plays and hits are still reported. */
  readonly reducedMotion?: boolean;
}

export interface FxHandle {
  /** Stop the effect now; `done` resolves. */
  stop(): void;
  /** Resolves when the one-shot finishes or `stop()` is called. */
  readonly done: Promise<void>;
}

export interface FxTimeline {
  /** Milliseconds per frame. */
  readonly frameMs: number;
  readonly frames: number;
  /** The hit times in milliseconds, in order. */
  readonly hits: readonly { readonly atMs: number; readonly hit: FxActHit }[];
  /** The effect's length in milliseconds (one loop, for a loop). */
  readonly durationMs: number;
}

const DEFAULT_FPS = 30;

/** The timing of a sheet: frame count, frame length, hit moments and total length. Throws on a malformed sheet. */
export function fxTimeline(sheet: FxSheet): FxTimeline {
  if (!sheet.key) throw new Error('fx: the sheet needs a texture key');
  if (!Number.isInteger(sheet.frames) || sheet.frames < 1)
    throw new Error(`fx ${sheet.key}: frames must be a positive integer`);
  const fps = sheet.fps ?? DEFAULT_FPS;
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`fx ${sheet.key}: fps must be positive`);
  const frameMs = 1000 / fps;
  const hits = (sheet.act?.hits ?? [])
    .filter((hit) => Number.isFinite(hit.t) && hit.t >= 0)
    .map((hit) => ({ atMs: hit.t * 1000, hit }))
    .sort((a, b) => a.atMs - b.atMs);
  return { frameMs, frames: sheet.frames, hits, durationMs: sheet.frames * frameMs };
}

/** The sprite's origin from the sheet's pivot; the frame's centre when it has none. */
export function fxOrigin(sheet: FxSheet): { x: number; y: number } {
  const { pivot, frameWidth, frameHeight } = sheet;
  if (!pivot || !frameWidth || !frameHeight || frameWidth <= 0 || frameHeight <= 0) return { x: 0.5, y: 0.5 };
  return { x: pivot[0] / frameWidth, y: pivot[1] / frameHeight };
}

/**
 * Play one shot at `(x, y)`. The sprite is created from the already-loaded texture, stepped at the sheet's fps, and
 * destroyed at the end. `onHit` runs at each `act.hits` time; `reducedMotion` is reported to the game, which decides
 * whether to shake (the player still calls `onHit`). No pooling in v1: effects are short and the scene caps them.
 */
export function playFx(scene: Phaser.Scene, sheet: FxSheet, options: PlayFxOptions): FxHandle {
  const timeline = fxTimeline(sheet);
  const frameName = sheet.framePrefix;
  const sprite = scene.add
    .sprite(options.x, options.y, sheet.key, frameName ? `${frameName} 0` : 0)
    .setDepth(options.depth ?? 30)
    .setScale(options.scale ?? 1)
    .setFlipX(options.flip ?? false);
  const origin = fxOrigin(sheet);
  sprite.setOrigin(origin.x, origin.y);

  let stopped = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const timers: Phaser.Time.TimerEvent[] = [];
  const finish = () => {
    if (stopped) return;
    stopped = true;
    for (const timer of timers) timer.remove(false);
    sprite.destroy();
    resolveDone();
  };

  if (sheet.loop) {
    // A loop has no natural end: the game stops it. Report each loop's hits once per loop.
    const fireHits = () => {
      for (const hit of timeline.hits) {
        timers.push(scene.time.delayedCall(hit.atMs, () => options.onHit?.(hit.hit)));
      }
    };
    fireHits();
    timers.push(scene.time.addEvent({ delay: timeline.durationMs, repeat: -1, callback: fireHits }));
  } else {
    for (let index = 1; index < timeline.frames; index++) {
      timers.push(
        scene.time.delayedCall(index * timeline.frameMs, () => {
          if (!stopped) sprite.setFrame(frameName ? `${frameName} ${index}` : index);
        }),
      );
    }
    for (const hit of timeline.hits) {
      timers.push(scene.time.delayedCall(hit.atMs, () => options.onHit?.(hit.hit)));
    }
    timers.push(scene.time.delayedCall(timeline.durationMs, finish));
  }

  return {
    stop: finish,
    done,
  };
}
