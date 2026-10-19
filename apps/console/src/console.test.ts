import sharedScript from '@tohe/design-tokens/theme-init.js?raw';
import { matchConsolePath } from '@tohe/routes';
import { describe, expect, it } from 'vitest';
import consoleScript from '../public/theme-init.js?raw';
import {
  ago,
  count,
  day,
  decisionDetails,
  evidenceName,
  levelName,
  levelTone,
  milliseconds,
  percent,
  publicId,
  reasonName,
  roleName,
  since,
} from './format.ts';
import { manifestOf, replayInit } from './watch.ts';

// The console's CSP forbids inline scripts, as the hub's, so it serves the shared pre-paint script as a copy.
// When the original changes: cp ../../packages/design-tokens/theme-init.js public/
it('serves an exact copy of the shared theme-init.js', () => {
  expect(consoleScript).toBe(sharedScript);
});

// The console has a host of its own (ADR 0042): its Caddy site serves only the namespaces @tohe/routes gives it.
const router = import.meta.glob<string>('./router.tsx', { query: '?raw', import: 'default', eager: true })[
  './router.tsx'
] as string;

it('routes only paths inside a page namespace of the console’s host in @tohe/routes', () => {
  const paths = [...router.matchAll(/\bpath: '([^']+)'/g)].map((match) => match[1] as string);
  expect(paths.length).toBeGreaterThan(10);
  const outside = paths.filter((path) => {
    // $id: any one segment.
    const namespace = matchConsolePath(path.replace(/\$\w+/g, 'x'));
    return namespace?.component !== 'console' || namespace.served !== 'page';
  });
  expect(outside, 'add a namespace to consoleNamespaces in packages/routes/src/map.ts').toEqual([]);
});

it('ships only files of a namespace of the console’s host', () => {
  const files = Object.keys(import.meta.glob('../public/*', { query: '?url', eager: true })).map((file) =>
    file.replace('../public', ''),
  );
  expect(files).toContain('/theme-init.js');
  expect(files.filter((file) => matchConsolePath(file)?.served !== 'static')).toEqual([]);
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
    expect(publicId('123456789012')).toBe('1234 5678 9012');
  });

  it('names the roles in Vietnamese', () => {
    expect(['owner', 'admin', 'moderator', 'viewer'].map(roleName)).toEqual([
      'Chủ',
      'Quản trị viên',
      'Kiểm duyệt viên',
      'Người xem',
    ]);
  });

  it('names trust levels, reasons and evidence, and keeps a code it does not know', () => {
    expect(['reported', 'checked', 'verified', 'held', 'rejected'].map(levelName)).toEqual([
      'Mới báo',
      'Đã kiểm',
      'Đã xác minh',
      'Chờ xem xét',
      'Bị từ chối',
    ]);
    expect(['held', 'rejected', 'checked'].map(levelTone)).toEqual(['notice', 'danger', 'soft']);
    expect(reasonName('personal_jump')).toBe('Vượt xa kỷ lục của chính hồ sơ');
    expect(reasonName('a_rule_of_tomorrow')).toBe('a_rule_of_tomorrow');
    expect(evidenceName('replayed')).toBe('Máy chủ chơi lại, khớp điểm');
  });

  it('opens the build that played a run, to play its moves back and record nothing (ADR 0032)', () => {
    const build = {
      name: 'Ghép Khối',
      version: '1.10.0',
      entryUrl: 'https://games.example.test/merge-block/1.10.0/index.html',
      orientation: 'portrait',
      capabilities: ['save', 'scores', 'ranked', 'shell', 'a-capability-of-tomorrow'],
    };
    const run = { gameId: 'merge-block', version: '1.10.0', seed: 913, moves: [0, 4, 2], build };
    expect(manifestOf(run, build)).toMatchObject({
      id: 'merge-block',
      version: '1.10.0',
      entry: 'index.html',
      capabilities: ['save', 'scores', 'ranked', 'shell'],
    });
    const player = {
      id: 'p1',
      name: 'Bé Su',
      avatar: '🐰',
      publicId: '482913570264',
      accountId: 'a1',
      account: null,
    };
    expect(replayInit(run, player, 'dark')).toEqual({
      profile: { id: 'p1', name: 'Bé Su', avatar: '🐰' },
      locale: 'vi',
      settings: { muted: true, theme: 'dark' },
      save: null,
      seed: 913,
      rankedReplay: { seed: 913, moves: [0, 4, 2] },
    });
  });

  it("writes what a rule saw, or a person's note, on one line", () => {
    expect(decisionDetails({ previousBest: 1200, runs: 10 })).toBe('Kỷ lục trước: 1.200 · Số lượt: 10');
    expect(decisionDetails({ note: 'Bé chơi giỏi thật' })).toBe('Ghi chú: Bé chơi giỏi thật');
    expect(decisionDetails(null)).toBeNull();
    expect(decisionDetails({})).toBeNull();
  });
});
