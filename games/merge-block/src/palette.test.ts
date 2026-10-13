import { contrast } from '@tohe/design-tokens';
import { describe, expect, it } from 'vitest';
import { ALL_BLOCK_STYLES, BOARD, blockStyle } from './palette.ts';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

describe('palette', () => {
  it('keeps every number readable on its block (WCAG AA, 4.5:1)', () => {
    for (const [index, style] of ALL_BLOCK_STYLES.entries()) {
      const ratio = contrast(style.text, hex(style.fill));
      expect(ratio, `block #${index + 1} (${style.text} on ${hex(style.fill)})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('rings the dark champion block only on a dark board', () => {
    expect(blockStyle(40, 'light').outline).toBeUndefined();
    expect(blockStyle(40, 'dark').outline).toBeDefined();
    expect(blockStyle(3, 'dark')).toBe(blockStyle(3, 'light'));
  });

  it('defines every board colour for both themes', () => {
    expect(Object.keys(BOARD.dark).sort()).toEqual(Object.keys(BOARD.light).sort());
  });
});
