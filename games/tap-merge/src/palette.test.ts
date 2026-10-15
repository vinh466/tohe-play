import { contrast } from '@tohe/design-tokens';
import { describe, expect, it } from 'vitest';
import { BOARD, blockStyle, GOLD, isPalette, PALETTE_IDS, PALETTES } from './palette.ts';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** CIELAB (D65) of an sRGB colour, to measure how different two colours look. */
function lab(color: number): [number, number, number] {
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const c = ((color >> shift) & 0xff) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** ΔE (CIE76): about 2 is barely visible; 30 is two colours nobody mixes up. */
function deltaE(a: number, b: number): number {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

describe('palette', () => {
  it('keeps every number readable on its block, in every preset (WCAG AA, 4.5:1)', () => {
    for (const id of PALETTE_IDS) {
      for (const [index, style] of PALETTES[id].entries()) {
        const ratio = contrast(style.text, hex(style.fill));
        expect(
          ratio,
          `${id} block #${index + 1} (${style.text} on ${hex(style.fill)})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('gives every preset a block for each number from 2 to 32K', () => {
    for (const id of PALETTE_IDS) expect(PALETTES[id], id).toHaveLength(15);
  });

  it('makes two numbers in a row clearly different in every preset but the gradual Hoàng hôn', () => {
    for (const id of PALETTE_IDS.filter((p) => p !== 'sunset')) {
      const blocks = PALETTES[id];
      for (let i = 1; i < blocks.length; i++) {
        const distance = deltaE(
          (blocks[i - 1] as { fill: number }).fill,
          (blocks[i] as { fill: number }).fill,
        );
        expect(distance, `${id}: ${2 ** i} → ${2 ** (i + 1)}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('brings the colours round again from 64K on, with a gold ring', () => {
    for (const id of PALETTE_IDS) {
      for (const theme of ['light', 'dark'] as const) {
        expect(blockStyle(15, theme, id).outline, `${id} 32K`).toBeUndefined();
        for (const exp of [16, 17, 30, 31, 40]) {
          const style = blockStyle(exp, theme, id);
          const again = PALETTES[id][(exp - 1) % 15];
          expect([style.fill, style.text, style.outline], `${id} 2^${exp}`).toEqual([
            again?.fill,
            again?.text,
            GOLD[theme],
          ]);
        }
      }
      expect(blockStyle(3, 'dark', id)).toBe(blockStyle(3, 'light', id));
    }
  });

  it('starts with Hoàng hôn and accepts only known presets from a save', () => {
    expect(blockStyle(1)).toBe(PALETTES.sunset[0]);
    expect(PALETTE_IDS.every(isPalette)).toBe(true);
    expect([undefined, null, '', 'rainbow', 3].some(isPalette)).toBe(false);
  });

  it('defines every board colour for both themes', () => {
    expect(Object.keys(BOARD.dark).sort()).toEqual(Object.keys(BOARD.light).sort());
  });
});
