// docs/conventions/voice-and-look.md, for the kit (ADR 0049): no emoji and no character drawn as a control's picture
// in the code that builds the menus, panels, dialogs and HUD — they are the kit's SVG icons (icons.ts) beside words.
// shell.test.ts checks the same on the screens the shell builds; conformance checks every game's real screens.
import { describe, expect, it } from 'vitest';
import { iconNames, shapeNames } from './icons.ts';

/**
 * Reads a file of the kit's source. The kit runs in browsers and has no Node types, so `node:fs` is imported by a name
 * the compiler does not resolve; the tests run under Node, where it is there.
 */
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
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');

const glyph = /\p{Extended_Pictographic}|[←→▶◀☰›✓⏸]/gu;
const files = ['./shell.ts', './overlay.ts', './hud.ts', './overlay.css'];

describe('no emoji as interface in the kit', () => {
  it.each(files)('has none in %s', async (file) => {
    const source = await read(file);
    expect(source.length).toBeGreaterThan(0);
    expect([...code(source).matchAll(glyph)].map(([match]) => match)).toEqual([]);
  });

  it('draws the icons and shapes it names', () => {
    for (const name of ['play', 'house', 'arrow-left', 'list', 'gear-six', 'question', 'speaker-high'])
      expect(iconNames).toContain(name);
    expect(shapeNames).toContain('crown');
  });
});
