// Colours in the hub come only from the design tokens (ADR 0013). styles.css removes Tailwind's default palette,
// so a raw class like bg-orange-500 would silently generate nothing; this test names it instead.
import { expect, it } from 'vitest';

const sources = import.meta.glob<string>('./**/*.tsx', { query: '?raw', import: 'default', eager: true });

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RAW_COLOUR = new RegExp(
  `\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|accent|caret|placeholder|divide)-(?:white|black|(?:${PALETTE})-\\d{2,3})\\b`,
  'g',
);

it('styles the hub with token colours only (bg-surface, text-ink, …), see docs/architecture/theming.md', () => {
  expect(Object.keys(sources).length).toBeGreaterThan(10);
  const raw = Object.entries(sources).flatMap(([file, source]) =>
    [...source.matchAll(RAW_COLOUR)].map((match) => `${file}: ${match[0]}`),
  );
  expect(raw).toEqual([]);
});
