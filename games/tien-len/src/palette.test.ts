import { contrast } from '@tohe/design-tokens';
import { describe, expect, it } from 'vitest';
import { DECKS, SUITS, TABLE } from './palette.ts';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const THEMES = ['light', 'dark'] as const;

describe('palette', () => {
  it('keeps every suit readable on the card paper, in both themes and decks (WCAG AA, 4.5:1)', () => {
    for (const deck of DECKS) {
      for (const theme of THEMES) {
        for (const colour of SUITS[deck][theme]) {
          const ratio = contrast(colour, TABLE[theme].paper);
          expect(ratio, `${deck} ${theme} ${colour}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('keeps names and counts readable on the felt', () => {
    for (const theme of THEMES) {
      const style = TABLE[theme];
      expect(contrast(style.label, hex(style.felt)), theme).toBeGreaterThanOrEqual(4.5);
      expect(contrast(style.label, hex(style.feltCentre)), theme).toBeGreaterThanOrEqual(4.5);
      expect(contrast(style.labelSoft, hex(style.felt)), theme).toBeGreaterThanOrEqual(4.5);
      expect(contrast(style.chipText, hex(style.chip)), theme).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives every suit its own colour in the four-colour deck', () => {
    for (const theme of THEMES) expect(new Set(SUITS.four[theme]).size).toBe(4);
  });
});
