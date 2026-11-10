import { describe, expect, it } from 'vitest';
import { centerAt, HEX_COLUMNS, HEX_ROWS, hexLayout } from './view-layout.ts';

const sizes = [
  { width: 320, height: 380 },
  { width: 360, height: 452 },
  { width: 390, height: 652 },
  { width: 320, height: 300 },
  { width: 568, height: 220 },
];

describe('hexLayout', () => {
  it.each(sizes)('fits the honeycomb inside $width×$height', ({ width, height }) => {
    const layout = hexLayout(width, height);
    expect(layout.centers).toHaveLength(HEX_COLUMNS * HEX_ROWS);
    expect(layout.cellW).toBeGreaterThanOrEqual(16);
    expect(layout.cellH).toBeGreaterThan(0);
    expect(layout.gridW).toBeLessThanOrEqual(width + 0.001);
    expect(layout.gridH).toBeLessThanOrEqual(height + 0.001);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.top).toBeGreaterThanOrEqual(0);
    for (const centre of layout.centers) {
      expect(centre.x).toBeGreaterThanOrEqual(0);
      expect(centre.y).toBeGreaterThanOrEqual(0);
      expect(centre.x).toBeLessThanOrEqual(width + 0.001);
      expect(centre.y).toBeLessThanOrEqual(height + 0.001);
    }
    // Neighbouring columns interlock rather than leave a gap.
    for (let column = 1; column < HEX_COLUMNS; column++) {
      const a = centerAt(layout, column - 1, 0);
      const b = centerAt(layout, column, 0);
      expect(b.x - a.x).toBeGreaterThan(layout.cellW * 0.6);
      expect(b.x - a.x).toBeLessThan(layout.cellW);
    }
    // The four lanes are one cell apart.
    for (let row = 1; row < HEX_ROWS; row++) {
      const a = centerAt(layout, 0, row - 1);
      const b = centerAt(layout, 0, row);
      expect(b.y - a.y).toBeCloseTo(layout.cellH, 4);
    }
  });

  it('gives a taller screen bigger cells, up to the cap', () => {
    expect(hexLayout(390, 652).cellW).toBeGreaterThan(hexLayout(320, 380).cellW);
    expect(hexLayout(390, 652).cellW).toBeLessThanOrEqual(80);
  });

  it('does not divide by zero or go negative on a missing board', () => {
    const layout = hexLayout(0, 0);
    expect(layout.cellW).toBeGreaterThan(0);
    expect(layout.cellH).toBeGreaterThan(0);
    expect(layout.centers).toHaveLength(HEX_COLUMNS * HEX_ROWS);
  });
});
