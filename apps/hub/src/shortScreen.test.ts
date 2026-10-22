// A phone held sideways (ADR 0046's consequences, docs/architecture/surfaces.md "The app's frame"): the frame's rail
// takes the place of the bar on a short screen, a portrait game asks to turn the phone upright, and the installed app's
// icons and shortcuts are right. Layout itself is looked at in screenshots; here the rules that must not drift.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import config from '../vite.config.ts?raw';
import appFrame from './frame/AppFrame.tsx?raw';
import { asksToTurnUpright, SHORT_LANDSCAPE, SHORT_LANDSCAPE_TOUCH } from './frame/short.ts';
import gameFrame from './launcher/GameFrame.tsx?raw';
import rotateHint from './launcher/RotateHint.tsx?raw';

// A stylesheet through `?raw` comes back empty under Vitest's CSS handling.
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('a short screen', () => {
  it('is a height under 500 px in landscape; the Tailwind variants are those queries, written out', () => {
    expect(SHORT_LANDSCAPE).toBe('(max-height: 499px) and (orientation: landscape)');
    expect(styles).toContain(`@custom-variant short (@media ${SHORT_LANDSCAPE});`);
    expect(styles).toContain(`@custom-variant turn (@media ${SHORT_LANDSCAPE_TOUCH});`);
  });

  it('takes the rail instead of the bar: the bar hides and the rail shows by height, not only by width', () => {
    expect(appFrame).toMatch(/md:flex short:flex/);
    expect(appFrame).toMatch(/md:hidden short:hidden/);
    expect(appFrame).toMatch(/short:pb-0 short:pl-\[calc\(7rem/);
    // The first paint draws the same frame.
    expect(indexHtml).toMatch(/md:flex short:flex/);
    expect(indexHtml).toMatch(/md:hidden short:hidden/);
  });

  it('shows no title of a tab: its name is a heading for screen readers, the bar says where this is', () => {
    expect(appFrame).toContain('<h1 className="sr-only">{title}</h1>');
    expect(appFrame).not.toMatch(/text-3xl text-brand-ink/);
  });

  it('lets the profile chip grow on a short screen, so a name keeps its words', () => {
    expect(appFrame).toMatch(/short:max-w-64/);
  });
});

describe('turn your phone upright', () => {
  it('is asked only by a game that declares portrait', () => {
    expect(asksToTurnUpright('portrait')).toBe(true);
    expect(asksToTurnUpright('any')).toBe(false);
    expect(asksToTurnUpright('landscape')).toBe(false);
  });

  it('shows by CSS alone, on a touch screen under 500 px in landscape, and never on a tablet or a computer', () => {
    // Hidden unless the `turn:` query matches: nothing in state to stick, and it goes the moment the phone turns back.
    expect(rotateHint).toMatch(/\bhidden\b[^"]*\bturn:flex\b/);
    expect(gameFrame).toContain('asksToTurnUpright(game.orientation) ? <RotateHint />');
    expect(SHORT_LANDSCAPE_TOUCH).toContain('(pointer: coarse)');
  });

  it('is calm and drawn: an SVG, the design tokens, no emoji, no raw palette', () => {
    expect(rotateHint).toContain('<svg');
    expect(rotateHint).toMatch(/bg-page/);
    expect(rotateHint).not.toMatch(
      /\b(?:bg|text|border|stroke|fill)-(?:orange|amber|slate|gray|white|black)\b/,
    );
    expect(rotateHint).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(rotateHint).toContain('motion-reduce:animate-none');
  });

  it('does not pause or lock the game under it', () => {
    expect(rotateHint).not.toMatch(/\.pause\(|\.lock\(|useEffect/);
  });
});

describe('a game’s top bar under a notch', () => {
  it('keeps 56 px: the height adds the inset to 3.5rem instead of sharing it', () => {
    expect(gameFrame).toContain('min-h-[calc(3.5rem+env(safe-area-inset-top))]');
    expect(gameFrame).not.toMatch(/\bh-14\b[^"]*pt-\[env\(safe-area-inset-top\)\]/);
  });
});

describe('the installed app’s icons', () => {
  const public_ = new URL('../public/', import.meta.url);

  /** The PNG's size and colour type from its header: 2 is RGB, 6 is RGBA — a channel for transparency. */
  function header(file: string) {
    const bytes = readFileSync(new URL(file, public_));
    expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] };
  }

  it.each([
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ])('%s is %i px square and opaque: no alpha channel, so no black corners on iOS', (file, size) => {
    expect(header(file)).toEqual({ width: size, height: size, colourType: 2 });
  });

  it('are declared in the manifest: any for the first two, maskable for its own file', () => {
    expect(config).toContain("{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }");
    expect(config).toContain("{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }");
    expect(config).toContain(
      "{ src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }",
    );
    // The one file no longer serves both purposes.
    expect(config).not.toMatch(/icon-512\.png[^}]*maskable/);
  });

  it('have shortcuts to Ghép Khối, Chơi cùng and the code box', () => {
    expect(config).toContain("url: '/play/merge-block'");
    expect(config).toContain("url: '/together'");
    expect(config).toContain("url: '/together?code=1'");
  });
});
