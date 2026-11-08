import { describe, expect, it } from 'vitest';
import { dailyChoice, levelChoice, newChoice, parseChoice, resumeChoice } from './flow.ts';

describe('the mode choice protocol', () => {
  it('builds and reads a continue for each mode', () => {
    for (const mode of ['classic', 'journey', 'daily'] as const) {
      expect(parseChoice(resumeChoice(mode))).toEqual({ kind: 'resume', mode });
    }
  });

  it('builds and reads a new game for each mode', () => {
    for (const mode of ['classic', 'journey', 'daily'] as const) {
      expect(parseChoice(newChoice(mode))).toEqual({ kind: 'new', mode });
    }
  });

  it('carries a level id and a daily date', () => {
    expect(parseChoice(levelChoice('c2-3'))).toEqual({ kind: 'level', level: 'c2-3' });
    expect(parseChoice(dailyChoice('20261108'))).toEqual({ kind: 'daily', date: '20261108' });
  });

  it('rejects malformed or unknown choices', () => {
    expect(parseChoice(null)).toBeNull();
    expect(parseChoice('')).toBeNull();
    expect(parseChoice('resume:')).toBeNull();
    expect(parseChoice('resume:nope')).toBeNull();
    expect(parseChoice('new:')).toBeNull();
    expect(parseChoice('level:')).toBeNull();
    expect(parseChoice('daily:2026-11-08')).toBeNull();
    expect(parseChoice('daily:2026118')).toBeNull();
    expect(parseChoice('something:else')).toBeNull();
    expect(parseChoice('classic')).toBeNull();
  });
});
