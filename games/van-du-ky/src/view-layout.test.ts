import { describe, expect, it } from 'vitest';
import { boardLayout } from './view-layout.ts';

const sizes = [
  { width: 320, height: 380 },
  { width: 360, height: 452 },
  { width: 390, height: 652 },
  { width: 320, height: 300 },
  { width: 568, height: 220 },
];

describe('boardLayout', () => {
  it.each(sizes)('keeps every row inside the board and apart at $width×$height', ({ width, height }) => {
    const layout = boardLayout(width, height);
    const cardHalf = layout.cardHeight / 2;
    // No two cards on one side touch: the gap between row centres is at least a card plus the row gap.
    expect(layout.enemyY[0] - layout.enemyY[1]).toBeGreaterThanOrEqual(
      layout.cardHeight + layout.rowGap - 0.001,
    );
    expect(layout.enemyY[1] - layout.enemyY[2]).toBeGreaterThanOrEqual(
      layout.cardHeight + layout.rowGap - 0.001,
    );
    expect(layout.heroY[1] - layout.heroY[0]).toBeGreaterThanOrEqual(
      layout.cardHeight + layout.rowGap - 0.001,
    );
    expect(layout.heroY[2] - layout.heroY[1]).toBeGreaterThanOrEqual(
      layout.cardHeight + layout.rowGap - 0.001,
    );
    // The two sides never meet: the clash gap is clear.
    expect(layout.enemyY[0] + cardHalf).toBeLessThanOrEqual(layout.clashTop + 0.001);
    expect(layout.heroY[0] - cardHalf).toBeGreaterThanOrEqual(layout.clashBottom - 0.001);
    // Everything is inside the canvas.
    expect(layout.enemyY[2] - cardHalf).toBeGreaterThanOrEqual(0);
    expect(layout.heroY[2] + cardHalf).toBeLessThanOrEqual(height + 0.001);
    expect(layout.x[0] - layout.cardWidth / 2).toBeGreaterThanOrEqual(0);
    expect(layout.x[1] + layout.cardWidth / 2).toBeLessThanOrEqual(width + 0.001);
  });

  it('gives a taller screen bigger cards, up to the cap', () => {
    expect(boardLayout(390, 652).cardHeight).toBeGreaterThan(boardLayout(320, 380).cardHeight);
    expect(boardLayout(390, 652).cardHeight).toBeLessThanOrEqual(64);
  });

  it('does not divide by zero or go negative on a tiny canvas', () => {
    const layout = boardLayout(0, 0);
    expect(layout.cardWidth).toBeGreaterThan(0);
    expect(layout.cardHeight).toBeGreaterThan(0);
  });
});
