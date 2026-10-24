import sharedScript from '@tohe/design-tokens/theme-init.js?raw';
import { matchStudioPath } from '@tohe/routes';
import { describe, expect, it } from 'vitest';
import studioScript from '../public/theme-init.js?raw';
import {
  bytes,
  creatorName,
  isPicture,
  kindName,
  roleName,
  safeRedirect,
  sourceLines,
  statusTone,
  styleStatusName,
  versionStatusName,
  viewName,
} from './format.ts';

// The Studio's CSP forbids inline scripts, as the hub's, so it serves the shared pre-paint script as a copy.
// When the original changes: cp ../../packages/design-tokens/theme-init.js public/
it('serves an exact copy of the shared theme-init.js', () => {
  expect(studioScript).toBe(sharedScript);
});

// The Studio has a host of its own (ADR 0051): its Caddy site serves only the namespaces @tohe/routes gives it.
const router = import.meta.glob<string>('./router.tsx', { query: '?raw', import: 'default', eager: true })[
  './router.tsx'
] as string;

it('routes only paths inside a page namespace of the Studio’s host in @tohe/routes', () => {
  const paths = [...router.matchAll(/\bpath: '([^']+)'/g)].map((match) => match[1] as string);
  expect(paths.length).toBeGreaterThan(4);
  const outside = paths.filter((path) => {
    // $id: any one segment.
    const namespace = matchStudioPath(path.replace(/\$\w+/g, 'x'));
    return namespace?.component !== 'studio' || namespace.served !== 'page';
  });
  expect(outside, 'add a namespace to studioNamespaces in packages/routes/src/map.ts').toEqual([]);
});

it('ships only files of a namespace of the Studio’s host', () => {
  const files = Object.keys(import.meta.glob('../public/*', { query: '?url', eager: true })).map((file) =>
    file.replace('../public', ''),
  );
  expect(files).toContain('/theme-init.js');
  expect(files.filter((file) => matchStudioPath(file)?.served !== 'static')).toEqual([]);
});

// Its links to the hub are absolute, to the hub's URL from /api/studio/config: a root-relative link to a page of the
// hub would be a 404 of the Studio's own host.
const sources = import.meta.glob<string>('./**/*.tsx', { query: '?raw', import: 'default', eager: true });

it('links to the hub only through the hub’s address the API tells', () => {
  const relative = Object.entries(sources).flatMap(([file, source]) =>
    [...source.matchAll(/(?:href|to)=["'{]+(\/(?:play|account|api\/(?!studio))[^"'}]*)/g)].map(
      (match) => `${file}: ${match[1]}`,
    ),
  );
  expect(relative).toEqual([]);
});

// Colours only from the design tokens (ADR 0013): styles.css removes Tailwind's palette, so a raw class would
// silently generate nothing; this test names it instead.
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RAW_COLOUR = new RegExp(
  `\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|accent|caret|placeholder|divide)-(?:white|black|(?:${PALETTE})-\\d{2,3})\\b`,
  'g',
);

it('styles the Studio with token colours only, see docs/architecture/theming.md', () => {
  expect(Object.keys(sources).length).toBeGreaterThan(5);
  const raw = Object.entries(sources).flatMap(([file, source]) =>
    [...source.matchAll(RAW_COLOUR)].map((match) => `${file}: ${match[0]}`),
  );
  expect(raw).toEqual([]);
});

describe('how the Studio writes things', () => {
  it('names statuses, kinds, views and roles in Vietnamese, and keeps a code it does not know', () => {
    expect(
      ['draft', 'submitted', 'approved', 'rejected', 'deprecated', 'withdrawn'].map(versionStatusName),
    ).toEqual(['Bản nháp', 'Chờ duyệt', 'Đã duyệt', 'Bị từ chối', 'Không nên dùng nữa', 'Đã rút']);
    expect(['draft', 'approved', 'rejected'].map(styleStatusName)).toEqual([
      'Bản nháp',
      'Đã duyệt',
      'Bị từ chối',
    ]);
    expect(versionStatusName('a-status-of-tomorrow')).toBe('a-status-of-tomorrow');
    expect(['submitted', 'approved', 'rejected', 'draft'].map(statusTone)).toEqual([
      'notice',
      'brand',
      'danger',
      'soft',
    ]);
    expect(kindName('spritesheet')).toBe('Sprite sheet');
    expect(kindName('model3d')).toBe('model3d');
    expect(['image', 'spritesheet', 'tileset', 'audio', 'font'].map(isPicture)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(viewName('top-down')).toBe('Nhìn từ trên xuống');
    expect(['contributor', 'reviewer'].map(roleName)).toEqual(['Người đóng góp', 'Người duyệt']);
  });

  it('writes sizes the Vietnamese way', () => {
    expect(bytes(512)).toBe('512 B');
    expect(bytes(3482)).toBe('3,4 KB');
    expect(bytes(1_258_291)).toBe('1,2 MB');
  });

  it('names who made something by the start of its id', () => {
    expect(creatorName({ kind: 'agent', id: '0b7c5e1a-2f9d-4c1e-9a7b-3d2e1f0a9b8c' })).toBe('Agent 0b7c5e1a');
    expect(creatorName({ kind: 'account', id: 'a1b2c3d4-0000-0000-0000-000000000000' })).toBe(
      'Tài khoản a1b2c3d4',
    );
  });

  it('reads a source into lines, its type first, and nothing from what is not an object', () => {
    expect(
      sourceLines({ type: 'pack', name: 'Kenney Tiny Farm', url: 'https://kenney.nl', author: 'Kenney' }),
    ).toEqual([
      { label: 'Nguồn', value: 'Lấy từ một gói có sẵn' },
      { label: 'Tên gói', value: 'Kenney Tiny Farm' },
      { label: 'Địa chỉ', value: 'https://kenney.nl' },
      { label: 'Tác giả', value: 'Kenney' },
    ]);
    expect(sourceLines({ type: 'ai', vendor: 'v', seed: 42, extra: '' })).toEqual([
      { label: 'Nguồn', value: 'Tạo bằng AI' },
      { label: 'Nhà cung cấp', value: 'v' },
      { label: 'Seed', value: '42' },
    ]);
    expect(sourceLines(null)).toEqual([]);
    expect(sourceLines('pack')).toEqual([]);
    expect(sourceLines([{ type: 'pack' }])).toEqual([]);
  });

  it('sends the sign-in back only to a page of this host', () => {
    expect(safeRedirect('/packs/farm-crops?x=1')).toBe('/packs/farm-crops?x=1');
    expect(safeRedirect('/')).toBe('/');
    for (const unsafe of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example/',
      'packs',
      '',
      42,
      null,
    ]) {
      expect(safeRedirect(unsafe), String(unsafe)).toBeUndefined();
    }
    expect(safeRedirect('/sign-in')).toBeUndefined();
    expect(safeRedirect('/sign-in?redirect=%2F')).toBeUndefined();
  });
});
