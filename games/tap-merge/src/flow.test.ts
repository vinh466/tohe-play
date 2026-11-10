import { describe, expect, it } from 'vitest';
import { levelChoice, parseChoice } from './flow.ts';

describe('the mode choice protocol', () => {
  it('reads a mode id as that mode', () => {
    for (const mode of ['classic', 'journey', 'daily'] as const) {
      expect(parseChoice(mode)).toEqual({ kind: 'mode', mode });
    }
  });

  it('carries a level id behind its prefix', () => {
    expect(parseChoice(levelChoice('c2-3'))).toEqual({ kind: 'level', level: 'c2-3' });
  });

  it('rejects malformed or unknown choices', () => {
    expect(parseChoice(null)).toBeNull();
    expect(parseChoice('')).toBeNull();
    expect(parseChoice('level:')).toBeNull();
    expect(parseChoice('something:else')).toBeNull();
    expect(parseChoice('resume:journey')).toBeNull();
    expect(parseChoice('daily:20261108')).toBeNull();
  });
});
