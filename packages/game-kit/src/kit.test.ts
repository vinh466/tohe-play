import { describe, expect, it } from 'vitest';
import { formatValue } from './format.ts';
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
