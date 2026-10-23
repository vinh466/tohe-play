// docs/conventions/voice-and-look.md for Tiến Lên (ADR 0049): the controls the game draws itself (Bỏ lượt, Gợi ý,
// Đánh, the sort, Cảm xúc, a replay's steps, a table's rules) show the kit's SVG icons beside words, never an emoji
// or a character standing in for a picture. The kit checks its own files (packages/game-kit/src/voiceAndLook.test.ts)
// and conformance the real screens. Emoji a person chose stay: avatars (avatars.ts, the bots' in strings.ts), the
// reactions they send; so do the how-to's picture hints and the results' medals, which are content.
import { describe, expect, it } from 'vitest';
import { strings } from './strings.ts';

/** Reads a file of the game, relative to this one (the tests run under Node; the game has no Node types). */
async function read(path: string): Promise<string> {
  const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as {
    readFileSync(path: URL, encoding: 'utf8'): string;
  };
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8');
}

/** The code without its comments, which may name a glyph to say what it replaced. */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');

/**
 * An emoji, or a character drawn as a control's picture. Two kinds stay out, as they are data inside words: the
 * suits, which is how a card is written ("3♠"), and arrows ("sảnh 5→9", who paid whom in the results).
 */
const glyph = /(?![♠♣♦♥])\p{Extended_Pictographic}|[▶◀☰›✓⏸⇅⏱]/gu;
const found = (text: string) => [...text.matchAll(glyph)].map(([match]) => match);

/** The files that build the game's own controls. */
const files = ['./main.ts', './stage.ts', './view.ts', './settings.ts', './style.css', '../index.html'];

/** Every word of the strings that is not content (see the top of this file), as `path: text`. */
function words(value: unknown, path: string): string[] {
  if (typeof value === 'string') return [`${path}: ${value}`];
  if (typeof value === 'function')
    return words((value as (...args: unknown[]) => unknown)(1, 2), `${path}()`);
  if (Array.isArray(value)) return value.flatMap((item, index) => words(item, `${path}[${index}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) =>
      content.has(key) ? [] : words(item, `${path}.${key}`),
    );
  return [];
}
/** Keys whose values are content: the bots' names and avatars, the how-to's picture hints, the results' medals. */
const content = new Set(['bots', 'hints', 'medals']);

describe('no emoji as interface in Tiến Lên', () => {
  it.each(files)('has none in %s', async (file) => {
    const source = await read(file);
    expect(source.length).toBeGreaterThan(0);
    expect(found(code(source))).toEqual([]);
  });

  it.each(['vi', 'en'] as const)('words its controls without glyphs (%s)', (locale) => {
    const all = words(strings[locale], locale);
    expect(all.length).toBeGreaterThan(20);
    expect(all.filter((line) => found(line).length > 0)).toEqual([]);
  });

  it('keeps the controls the hand needs worded', () => {
    expect(strings.vi.sortRank).toBe('Xếp số');
    expect(strings.vi.hint).toBe('Gợi ý');
    expect(strings.vi.reactShort).toBe('Cảm xúc');
  });
});
