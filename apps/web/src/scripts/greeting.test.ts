import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import script from './greeting.js?raw';

/** The card as the home page draws it: its words with {name} and {game}, and each game's name and address. */
function card() {
  const parts = new Map(
    ['avatar', 'hello', 'play', 'not-you'].map((name) => [
      name,
      { textContent: name === 'play' ? 'Chơi tiếp' : '', href: '/play?lang=vi' },
    ]),
  );
  const attributes = new Map<string, string>([
    ['data-hello', 'Chào lại, {name}!'],
    ['data-play', 'Chơi tiếp {game}'],
    ['data-not-you', 'Không phải {name}?'],
    [
      'data-games',
      JSON.stringify({ 'merge-block': { name: 'Ghép Khối', href: '/play/merge-block?lang=vi' } }),
    ],
  ]);
  return {
    parts,
    attributes,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    querySelector: (selector: string) => {
      const part = parts.get(/data-greeting="([\w-]+)"/.exec(selector)?.[1] ?? '');
      return part
        ? {
            get textContent() {
              return part.textContent;
            },
            set textContent(value: string) {
              part.textContent = value;
            },
            setAttribute: (name: string, value: string) => {
              if (name === 'href') part.href = value;
            },
          }
        : null;
    },
  };
}

/** Runs the script as a browser would, with `stored` in localStorage; returns the card it filled in and where it went. */
function run(stored: Record<string, string>, storageThrows = false) {
  const moved: string[] = [];
  const greeting = card();
  const document = {
    querySelector: (selector: string) => (selector === '[data-greeting-card]' ? greeting : null),
  };
  const location = { replace: (url: string) => moved.push(url), assign: (url: string) => moved.push(url) };
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('blocked');
      return stored[key] ?? null;
    },
  };
  new Function('document', 'localStorage', 'location', script)(document, localStorage, location);
  const text = (name: string) => greeting.parts.get(name)?.textContent;
  return {
    named: greeting.attributes.has('data-named'),
    hello: text('hello'),
    avatar: text('avatar'),
    play: text('play'),
    playHref: greeting.parts.get('play')?.href,
    notYou: text('not-you'),
    moved,
  };
}

const an = JSON.stringify({ id: 'p-an', name: 'An', avatar: '🐰', game: 'merge-block' });

describe('the greeting of a browser that has played here (ADR 0055)', () => {
  it('names who played last, and the game they opened, with its address in the app', () => {
    expect(run({ 'tohe:greeting': an })).toEqual({
      named: true,
      hello: 'Chào lại, An!',
      avatar: '🐰',
      play: 'Chơi tiếp Ghép Khối',
      playHref: '/play/merge-block?lang=vi',
      notYou: 'Không phải An?',
      moved: [],
    });
  });

  it('greets by name without a game it does not know: Chơi tiếp stays the way into the app', () => {
    const result = run({
      'tohe:greeting': JSON.stringify({ id: 'p-an', name: 'An', avatar: '🐰', game: 'gone' }),
    });
    expect(result).toMatchObject({
      named: true,
      hello: 'Chào lại, An!',
      play: 'Chơi tiếp',
      playHref: '/play?lang=vi',
    });
  });

  it('keeps the plain card with no greeting, one it cannot read, or blocked storage', () => {
    for (const stored of [{}, { 'tohe:greeting': 'not json' }, { 'tohe:greeting': '{"name":"An"}' }]) {
      expect(run(stored)).toMatchObject({ named: false, hello: '', play: 'Chơi tiếp', moved: [] });
    }
    expect(run({ 'tohe:greeting': an }, true)).toMatchObject({ named: false, moved: [] });
  });

  it('never sends anyone anywhere: / never redirects (ADR 0046, 0055)', () => {
    expect(run({ 'tohe:greeting': an }).moved).toEqual([]);
    expect(script).not.toMatch(/location\s*\.\s*(replace|assign|href)|location\s*=/);
  });

  it('reads the key the app writes when a game is opened: the app’s code still names it', () => {
    const read = (path: string) => readFileSync(new URL(`../../../hub/src/${path}`, import.meta.url), 'utf8');
    expect(read('launcher/recent.ts')).toContain("'tohe:greeting'");
  });
});
