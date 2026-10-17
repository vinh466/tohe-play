import sharedScript from '@tohe/design-tokens/theme-init.js?raw';
import { describe, expect, it } from 'vitest';
import adminScript from '../public/theme-init.js?raw';
import { ago, count, day, milliseconds, percent, roleName, since } from './format.ts';

// The console's CSP forbids inline scripts, as the hub's, so it serves the shared pre-paint script as a copy.
// When the original changes: cp ../../packages/design-tokens/theme-init.js public/
it('serves an exact copy of the shared theme-init.js', () => {
  expect(adminScript).toBe(sharedScript);
});

// Colours only from the design tokens (ADR 0013): styles.css removes Tailwind's palette, so a raw class would
// silently generate nothing; this test names it instead.
const sources = import.meta.glob<string>('./**/*.tsx', { query: '?raw', import: 'default', eager: true });
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RAW_COLOUR = new RegExp(
  `\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|accent|caret|placeholder|divide)-(?:white|black|(?:${PALETTE})-\\d{2,3})\\b`,
  'g',
);

it('styles the console with token colours only, see docs/architecture/theming.md', () => {
  expect(Object.keys(sources).length).toBeGreaterThan(5);
  const raw = Object.entries(sources).flatMap(([file, source]) =>
    [...source.matchAll(RAW_COLOUR)].map((match) => `${file}: ${match[0]}`),
  );
  expect(raw).toEqual([]);
});

describe('how the console writes things', () => {
  const now = new Date('2026-10-18T12:00:00Z');

  it('says how long ago, roughly', () => {
    expect(ago('2026-10-18T11:59:30Z', now)).toBe('vừa xong');
    expect(ago('2026-10-18T11:55:00Z', now)).toBe('5 phút trước');
    expect(ago('2026-10-18T09:00:00Z', now)).toBe('3 giờ trước');
    expect(ago('2026-10-16T12:00:00Z', now)).toBe('2 ngày trước');
    // A clock a little ahead of the server's is not "in the future".
    expect(ago('2026-10-18T12:00:05Z', now)).toBe('vừa xong');
  });

  it('says how long since', () => {
    expect(since('2026-10-18T11:59:50Z', now)).toBe('1 phút');
    expect(since('2026-10-18T07:00:00Z', now)).toBe('5 giờ');
    expect(since('2026-10-15T12:00:00Z', now)).toBe('3 ngày');
  });

  it('writes numbers, shares and durations the Vietnamese way', () => {
    expect(count(12345)).toBe('12.345');
    expect(percent(0.1234)).toBe('12,3%');
    expect(milliseconds(250.4)).toBe('250 ms');
    expect(milliseconds(1530)).toBe('1,5 s');
    expect(day('2026-10-08')).toBe('08/10');
  });

  it('names the roles in Vietnamese', () => {
    expect(['owner', 'admin', 'moderator', 'viewer'].map(roleName)).toEqual([
      'Chủ',
      'Quản trị viên',
      'Kiểm duyệt viên',
      'Người xem',
    ]);
  });
});
