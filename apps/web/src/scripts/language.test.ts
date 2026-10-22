// The language switch's memory and the suggestion to read in English (ADR 0047): who is offered English, and what is
// remembered.
import { describe, expect, it } from 'vitest';
import { LANGUAGE_KEY, readChoice, saveChoice, suggestsEnglish } from './language.ts';

const storage = (stored: Record<string, string> = {}, throws = false) => ({
  stored,
  getItem: (key: string) => {
    if (throws) throw new Error('blocked');
    return stored[key] ?? null;
  },
  setItem: (key: string, value: string) => {
    if (throws) throw new Error('blocked');
    stored[key] = value;
  },
});

describe('the remembered choice', () => {
  it('lives under one key, as vi or en', () => {
    expect(LANGUAGE_KEY).toBe('tohe:language');
    const memory = storage();
    saveChoice(memory, 'en');
    expect(memory.stored).toEqual({ 'tohe:language': 'en' });
    expect(readChoice(memory)).toBe('en');
    saveChoice(memory, 'vi');
    expect(readChoice(memory)).toBe('vi');
  });

  it('ignores anything else, and blocked or missing storage', () => {
    expect(readChoice(storage({ 'tohe:language': 'fr' }))).toBeUndefined();
    expect(readChoice(storage({}, true))).toBeUndefined();
    expect(readChoice(undefined)).toBeUndefined();
    expect(() => saveChoice(storage({}, true), 'en')).not.toThrow();
    expect(() => saveChoice(undefined, 'en')).not.toThrow();
  });
});

describe('the suggestion on a Vietnamese page', () => {
  it.each([
    [['en-US', 'vi'], true],
    [['fr'], true],
    [['vi-VN', 'en'], false],
    [['vi'], false],
    [['VI'], false],
    [[], false],
    [[''], false],
  ] as const)('with no choice, a browser in %j is offered English: %s', (browser, offered) => {
    expect(suggestsEnglish(undefined, browser)).toBe(offered);
  });

  it('follows a remembered choice whatever the browser says', () => {
    expect(suggestsEnglish('vi', ['en-US'])).toBe(false);
    expect(suggestsEnglish('en', ['vi-VN'])).toBe(true);
  });
});
