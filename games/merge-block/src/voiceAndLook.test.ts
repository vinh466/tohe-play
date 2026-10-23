// docs/conventions/voice-and-look.md for Ghép Khối (ADR 0049): the controls the game draws itself (a replay's steps,
// Phát and Dừng, the hand that points at the first drop) show the kit's SVG icons beside words, never an emoji or a
// character standing in for a picture. The kit checks its own files (packages/game-kit/src/voiceAndLook.test.ts) and
// conformance the real screens. The how-to's picture hints and a challenge's cheer are content.
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

/** An emoji, or a character drawn as a control's picture. */
const glyph = /\p{Extended_Pictographic}|[←→▶◀☰›✓⏸⇅⏱]/gu;
const found = (text: string) => [...text.matchAll(glyph)].map(([match]) => match);

/** The files that build the game's own controls. */
const files = [
  './main.ts',
  './stage.ts',
  './replay.ts',
  './view.ts',
  './hand.ts',
  './style.css',
  '../index.html',
];

describe('no emoji as interface in Ghép Khối', () => {
  it.each(files)('has none in %s', async (file) => {
    const source = await read(file);
    expect(source.length).toBeGreaterThan(0);
    expect(found(code(source))).toEqual([]);
  });

  it.each(['vi', 'en'] as const)("words a replay's controls without glyphs (%s)", (locale) => {
    const r = strings[locale].replay;
    const controls = [
      r.title,
      r.leave,
      r.back,
      r.backShort,
      r.forward,
      r.forwardShort,
      r.play,
      r.pause,
      r.scrub,
    ];
    expect(controls.flatMap(found)).toEqual([]);
    // A step's visible word is part of its name, for voice control and screen readers alike.
    expect(r.back.toLowerCase()).toContain(r.backShort.toLowerCase());
    expect(r.forward.toLowerCase()).toContain(r.forwardShort.toLowerCase());
  });
});
