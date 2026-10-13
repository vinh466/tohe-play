import { describe, expect, it } from 'vitest';
import css from '../tokens.css?raw';
import { contrast, parseTokens, token } from './index.ts';

const themes = parseTokens(css);

describe('design tokens', () => {
  it('defines the same tokens in both themes', () => {
    expect(Object.keys(themes.light).length).toBeGreaterThan(20);
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
  });

  // [foreground tokens, background tokens, minimum ratio] — the rules written at the top of tokens.css.
  const rules: [string[], string[], number][] = [
    [['ink', 'ink-soft', 'accent', 'brand-ink'], ['page', 'surface', 'fill', 'soft'], 4.5],
    [['ink', 'accent'], ['soft-strong'], 4.5],
    [['danger'], ['page', 'surface', 'danger-soft', 'danger-soft-strong'], 4.5],
    [['notice-ink'], ['notice'], 4.5],
    [['on-brand'], ['brand', 'brand-strong'], 3],
    [['brand', 'focus'], ['page', 'surface'], 3],
  ];

  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [foregrounds, backgrounds, min] of rules) {
      for (const fg of foregrounds) {
        for (const bg of backgrounds) {
          it(`${theme}: ${fg} on ${bg} is at least ${min}:1`, () => {
            expect(contrast(token(tokens, fg), token(tokens, bg))).toBeGreaterThanOrEqual(min);
          });
        }
      }
    }
  }
});
