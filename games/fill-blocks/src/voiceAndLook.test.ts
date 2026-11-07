// docs/conventions/voice-and-look.md for Lấp Ô (ADR 0049): the controls the game draws itself show the kit's SVG
// icons beside words, never an emoji or a character standing in for a picture. The how-to's picture hints and the
// public pages are content; the kit checks its own files and conformance the real screens.
import { describe, expect, it } from 'vitest';

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

/** An emoji, or a character drawn as a control's picture. */
const glyph = /\p{Extended_Pictographic}|[←→▶◀☰›✓⏸⇅⏱]/gu;

const files = ['./main.ts', './stage.ts', './screens.ts', './style.css', '../index.html'];

describe('no emoji as interface in Lấp Ô', () => {
  it.each(files)('has none in %s', async (file) => {
    const source = await read(file);
    expect(source.length).toBeGreaterThan(0);
    expect([...code(source).matchAll(glyph)].map(([match]) => match)).toEqual([]);
  });

  it('uses the kit icon for every picture in its own controls', async () => {
    for (const file of ['./main.ts', './stage.ts', './screens.ts']) {
      expect(code(await read(file))).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });
});
