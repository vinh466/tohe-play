import { describe, expect, it } from 'vitest';
import { formatCompact, formatScore, formatValue } from './format.ts';
import { perfWanted } from './phaser/perf.ts';
import { noteFrequency } from './sfx.ts';

describe('formatValue', () => {
  it('keeps numbers up to 2048 and abbreviates bigger ones', () => {
    expect([2, 64, 2048, 4096, 16384, 1_048_576, 2_147_483_648].map(formatValue)).toEqual([
      '2',
      '64',
      '2048',
      '4K',
      '16K',
      '1M',
      '2B',
    ]);
  });
});

describe('formatCompact', () => {
  it('shows a score in full while it fits', () => {
    expect(formatCompact(1_234_567, 'vi', 9)).toBe('1.234.567');
    expect(formatCompact(1_234_567, 'en', 9)).toBe('1,234,567');
    expect(formatCompact(999, 'vi', 2)).toBe('999'); // nothing shorter exists
  });

  it('shortens it in its own unit, with as many decimals as fit', () => {
    expect(formatCompact(812_345, 'vi', 6)).toBe('812,3K');
    expect(formatCompact(13_456_789, 'vi', 8)).toBe('13,45M');
    expect(formatCompact(13_456_789, 'vi', 6)).toBe('13,45M');
    expect(formatCompact(13_456_789, 'en', 5)).toBe('13.4M');
    expect(formatCompact(56_400_000, 'vi', 5)).toBe('56,4M');
    expect(formatCompact(940_000_000_000, 'vi', 5)).toBe('940B');
    expect(formatCompact(2_500_000_000_000, 'vi', 4)).toBe('2,5T');
  });

  it('cuts digits and never rounds a score up', () => {
    expect(formatCompact(4_349_999, 'vi', 5)).toBe('4,34M');
    expect(formatCompact(4_350_000, 'vi', 5)).toBe('4,35M');
    expect(formatCompact(999_999, 'en', 4)).toBe('999K');
  });

  it('formats scores in full with the locale separators', () => {
    expect(formatScore(1_234_567, 'vi')).toBe('1.234.567');
  });
});

describe('noteFrequency', () => {
  it('walks a pentatonic scale upwards from C4', () => {
    expect(noteFrequency(0)).toBeCloseTo(261.63, 1);
    expect(noteFrequency(5)).toBeCloseTo(523.25, 1); // next octave
    const steps = Array.from({ length: 12 }, (_, i) => noteFrequency(i));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it('is clamped so huge values stay audible', () => {
    expect(noteFrequency(99)).toBe(noteFrequency(24));
    expect(noteFrequency(-3)).toBe(noteFrequency(0));
  });
});

describe('perfWanted', () => {
  it('turns the readout on for #perf only', () => {
    expect(['#perf', '#a&perf', '#perf&b'].map((hash) => perfWanted(hash))).toEqual([true, true, true]);
    expect(['', '#', '#perfect', '#superf', '?perf'].map((hash) => perfWanted(hash))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
