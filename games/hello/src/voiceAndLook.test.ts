// docs/conventions/voice-and-look.md for Chạm Chấm (ADR 0049): what the game draws itself (the clock between the
// scores) shows the kit's SVG icons beside words and numbers, never an emoji or a character standing in for a
// picture. The kit checks its own files (packages/game-kit/src/voiceAndLook.test.ts) and conformance the real screens.
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

/** The files that build the game's screens and words (app.ts holds the words). */
const files = ['./app.ts', './main.ts', './stage.ts', './style.css', '../index.html'];

describe('no emoji as interface in Chạm Chấm', () => {
  it.each(files)('has none in %s', async (file) => {
    const source = await read(file);
    expect(source.length).toBeGreaterThan(0);
    expect([...code(source).matchAll(glyph)].map(([match]) => match)).toEqual([]);
  });

  it('draws the clock with the kit timer icon', async () => {
    expect(code(await read('./stage.ts'))).toContain("icon('timer')");
  });
});
