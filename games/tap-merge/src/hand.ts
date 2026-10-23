// The pointing hand of the first-time hint on the board: the kit's filled hand (icons.ts, Phosphor) in the board's
// own colours, not an emoji (ADR 0049). Phaser draws pictures from textures, so the SVG becomes one, once per colour.
import { shape } from '@tohe/game-kit';
import type Phaser from 'phaser';

/** Drawn this large and shown smaller, so it stays crisp on any screen. */
const SIZE = 256;
/** Textures still loading, per game: each is asked for once. */
const loading = new WeakMap<Phaser.Textures.TextureManager, Set<string>>();

/** The hand as an SVG picture: `fill` inside, a round `stroke` around it so it reads on blocks and on the board. */
export function handSvg(fill: string, stroke: string): string {
  const svg = shape('hand-pointing');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', '-16 -16 288 288');
  svg.setAttribute('width', String(SIZE));
  svg.setAttribute('height', String(SIZE));
  svg.setAttribute('fill', fill);
  svg.removeAttribute('class');
  const path = svg.querySelector('path') as SVGPathElement;
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', '16');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('paint-order', 'stroke');
  return new XMLSerializer().serializeToString(svg);
}

/**
 * The key of the hand's texture in these colours, or null while it loads; `onReady` runs once it has loaded. The
 * picture is a data URL, which the games' CSP allows for images (img-src 'self' data:).
 */
export function handTexture(
  scene: Phaser.Scene,
  fill: string,
  stroke: string,
  onReady: () => void,
): string | null {
  const key = `hint-hand-${fill}-${stroke}`;
  const textures = scene.textures;
  if (textures.exists(key)) return key;
  const pending = loading.get(textures) ?? new Set<string>();
  loading.set(textures, pending);
  if (!pending.has(key)) {
    pending.add(key);
    textures.once(`addtexture-${key}`, () => {
      pending.delete(key);
      // The stage may have been left while the picture loaded.
      if (scene.sys.isActive()) onReady();
    });
    textures.addBase64(key, `data:image/svg+xml;base64,${btoa(handSvg(fill, stroke))}`);
  }
  return null;
}
