import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, isPalette, PALETTE_COLOURS, PALETTE_IDS } from './palette.ts';

const HEX = /^#[0-9a-f]{6}$/i;

describe('the piece palettes', () => {
  it('offers five presets of eight colours and defaults to the fresh one', () => {
    expect(PALETTE_IDS).toEqual(['fresh', 'paper', 'candy', 'neon', 'contrast']);
    expect(DEFAULT_PALETTE).toBe('fresh');
    for (const id of PALETTE_IDS) {
      expect(PALETTE_COLOURS[id]).toHaveLength(8);
      for (const colour of PALETTE_COLOURS[id]) expect(colour).toMatch(HEX);
    }
  });

  it('validates ids and keeps the old paper and contrast saves valid', () => {
    for (const id of PALETTE_IDS) expect(isPalette(id)).toBe(true);
    expect(isPalette('paper')).toBe(true);
    expect(isPalette('contrast')).toBe(true);
    expect(isPalette('unknown')).toBe(false);
    expect(isPalette(null)).toBe(false);
  });
});
