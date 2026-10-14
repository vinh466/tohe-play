// Shapes and text that do not change, drawn once into a texture at device pixels. Phaser rebuilds and
// triangulates every path of a Graphics object on every frame, and every Text owns a canvas that it redraws and
// uploads again on each change; an image of a texture drawn once costs one quad per frame. Measured on Ghép Khối
// (docs/research/game-tech.md, "Frame cost on phones").
import type Phaser from 'phaser';

/** The device pixel ratio the kit renders at (set by `createGame`). */
export function dprOf(scene: Phaser.Scene): number {
  return (scene.registry.get('dpr') as number | undefined) ?? 1;
}

/**
 * Draws a `width` × `height` texture (CSS pixels) with the Canvas 2D API, at the device pixel ratio so it stays
 * sharp; `draw` works in CSS pixels. Drawn once: if `key` exists it is returned as is, so put everything the
 * picture depends on (value, theme, size) in the key. Show it with `crispImage`.
 */
export function drawTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const dpr = dprOf(scene);
  // A plain canvas, not Phaser's CanvasTexture: that one asks for a CPU-backed canvas (willReadFrequently) and
  // copies its pixels, which the Canvas renderer then has to send to the GPU again on every frame.
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * dpr));
  canvas.height = Math.max(1, Math.ceil(height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`no 2D canvas for texture "${key}"`);
  ctx.scale(dpr, dpr);
  draw(ctx);
  const texture = scene.textures.create(key, canvas, canvas.width, canvas.height);
  texture?.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
  return key;
}

/**
 * An image of a `drawTexture` texture, shown at its CSS size (scale 1 / DPR). To tween its scale, put it in a
 * container and tween the container.
 */
export function crispImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(1 / dprOf(scene));
}

/** Adds a rounded rectangle to the current path (`roundRect` is missing from older phone browsers). */
export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** A colour number (`0xff8800`) as a CSS colour for the Canvas 2D API. */
export function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
