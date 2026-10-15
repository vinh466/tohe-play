// Game-feel helpers for Phaser scenes. Feedback comes in tiers so it stays proportional (small for every action,
// large only for rare moments), and shakes are skipped for players who prefer reduced motion.
import type Phaser from 'phaser';
import { prefersReducedMotion } from '../motion.ts';
import { crispText } from './game.ts';

const DOT = 'tohe-kit-dot';

/** Wait for a tween; resolves immediately if the scene is gone. */
export function tweenAsync(
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> {
  return new Promise((resolve) => {
    if (!scene.sys.isActive() && !scene.sys.isPaused()) return resolve();
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

export function delay(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));
}

/** Grow in from nothing with a little overshoot. */
export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform, duration = 220) {
  target.setScale(0);
  return tweenAsync(scene, { targets: target, scale: 1, duration, ease: 'Back.easeOut' });
}

/** Squash on impact, then spring back. */
export function squash(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform, amount = 0.14) {
  return tweenAsync(scene, {
    targets: target,
    scaleX: 1 + amount,
    scaleY: 1 - amount,
    duration: 70,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

/** Scale pop on an existing object (e.g. a merged block). */
export function pulse(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform, peak = 1.22) {
  return tweenAsync(scene, { targets: target, scale: peak, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
}

/** "+128"-style text that floats up and fades out; the lines of a longer message are centred. */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  {
    color = '#7c2d12',
    stroke = '#ffffff',
    size = 22,
    rise = 46,
  }: { color?: string; stroke?: string; size?: number; rise?: number } = {},
) {
  const label = crispText(scene, x, y, text, {
    fontSize: `${size}px`,
    fontStyle: '900',
    color,
    align: 'center',
  })
    .setOrigin(0.5)
    .setDepth(50)
    .setStroke(stroke, Math.max(3, size / 6));
  scene.tweens.add({
    targets: label,
    y: y - rise,
    alpha: { from: 1, to: 0 },
    scale: { from: 0.7, to: 1.1 },
    duration: 700,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
}

function ensureDot(scene: Phaser.Scene) {
  if (scene.textures.exists(DOT)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
  g.generateTexture(DOT, 16, 16);
  g.destroy();
}

/** A one-off burst of particles in a colour. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 14, spread = 180) {
  ensureDot(scene);
  const emitter = scene.add
    .particles(x, y, DOT, {
      speed: { min: spread * 0.4, max: spread },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 280, max: 520 },
      tint: color,
      emitting: false,
    })
    .setDepth(40);
  emitter.explode(count);
  scene.time.delayedCall(700, () => emitter.destroy());
}

/** Celebration: colourful confetti raining over an area. */
export function confetti(scene: Phaser.Scene, width: number, count = 60) {
  ensureDot(scene);
  const colors = [0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xec4899, 0xa855f7];
  const emitter = scene.add
    .particles(0, -10, DOT, {
      x: { min: 0, max: width },
      speedY: { min: 160, max: 320 },
      speedX: { min: -60, max: 60 },
      rotate: { min: 0, max: 360 },
      scaleX: { min: 0.3, max: 0.6 },
      scaleY: { min: 0.15, max: 0.3 },
      lifespan: 2200,
      tint: colors,
      gravityY: 120,
      emitting: false,
    })
    .setDepth(60);
  emitter.explode(count);
  scene.time.delayedCall(2400, () => emitter.destroy());
}

export type ShakeTier = 'small' | 'medium' | 'large';

/** Camera shake in three strengths; nothing when the player prefers reduced motion. */
export function shake(scene: Phaser.Scene, tier: ShakeTier = 'small') {
  if (prefersReducedMotion()) return;
  const settings = { small: [90, 0.0025], medium: [140, 0.005], large: [220, 0.009] } as const;
  const [duration, intensity] = settings[tier];
  scene.cameras.main.shake(duration, intensity);
}
