// docs/conventions/voice-and-look.md, the rules a machine can check: no emoji as interface, icons from the one set, the
// voice table's marks out of the strings, and the font self-hosted. What needs eyes (the grandparent test, the
// screenshots) stays in the checklist the pull request is judged against.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import i18n from './i18n.ts';
import { iconShapes } from './ui/iconShapes.ts';

const sources = import.meta.glob<string>('./**/*.tsx', { query: '?raw', import: 'default', eager: true });
// A stylesheet through `?raw` comes back empty under Vitest's CSS handling: read the file.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const fonts = read('../../../packages/design-tokens/fonts.css');
const tokens = read('../../../packages/design-tokens/tokens.css');

/** Every string of a language's words, with its key. */
function strings(language: 'vi' | 'en'): [string, string][] {
  const out: [string, string][] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') out.push([path, value]);
    else if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) walk(item, `${path}.${index}`);
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(item, path ? `${path}.${key}` : key);
    }
  };
  walk(i18n.getResourceBundle(language, 'translation'), '');
  return out;
}

describe('no emoji as interface', () => {
  // A picture a person chose or a profile carries is content: the house avatars, and the fallbacks that stand in for
  // one (S3 draws them, ADR 0046's successor).
  const avatars = new Set(['🙂', '🤖', '➕', '🐼']);

  it('has none in a screen’s code but the avatars', () => {
    const found = Object.entries(sources).flatMap(([file, source]) =>
      [...source.matchAll(/\p{Extended_Pictographic}/gu)]
        .filter(([glyph]) => !avatars.has(glyph))
        .map(([glyph]) => `${file}: ${glyph}`),
    );
    expect(found).toEqual([]);
  });

  it('has none in the words of either language', () => {
    for (const language of ['vi', 'en'] as const) {
      const found = strings(language).filter(([, text]) => /\p{Extended_Pictographic}/u.test(text));
      expect(found, language).toEqual([]);
    }
  });

  it('draws a button’s arrow, check and cross as icons, not as characters', () => {
    const found = Object.entries(sources).flatMap(([file, source]) =>
      source
        .split('\n')
        // Code, not a comment: JSX text and string literals.
        .filter((line) => !/^\s*(\/\/|\/?\*|\{\/\*)/.test(line))
        .flatMap((line) => (/[←→✓✕›]/.test(line) ? [`${file}: ${line.trim()}`] : [])),
    );
    expect(found).toEqual([]);
  });

  it('draws every icon from the one set, in both weights', () => {
    expect(Object.keys(iconShapes).length).toBeGreaterThan(20);
    for (const [name, shape] of Object.entries(iconShapes)) {
      expect(shape.regular, name).toMatch(/^M/);
      expect(shape.fill, name).toMatch(/^M/);
    }
  });
});

describe('the voice', () => {
  it('has no arrow or "·" between the steps of a sentence, and no dash that joins two thoughts', () => {
    for (const language of ['vi', 'en'] as const) {
      // "·" belongs to a row of facts (`{{host}} · {{taken}}/{{seats}}`): placeholders on both sides. A long dash joining
      // two clauses is the tell the voice table names; one inside a placeholder-free sentence is flagged.
      const found = strings(language).filter(
        ([, text]) => /[→←]/.test(text) || / — /.test(text) || /[^}] · [^{]/.test(text),
      );
      expect(found, language).toEqual([]);
    }
  });

  it('writes a code box’s label as one line, and keeps the 6 and 8 rule for the error', () => {
    const vi = i18n.getFixedT('vi');
    expect(vi('entry.codeLabel')).toBe('Có mã? Gõ mã hoặc dán link.');
    expect(vi('entry.codeLabel')).not.toMatch(/\d/);
    expect(vi('entry.codeInvalid')).toMatch(/6 số/);
    expect(vi('entry.codeInvalid')).toMatch(/8 ký tự/);
  });

  it('puts the words of the R-07 rewrites in the hub', () => {
    const vi = i18n.getFixedT('vi');
    expect(vi('offline')).toBe('Đang mất mạng. Trò đã mở trước đó vẫn chơi được.');
    expect(vi('gameFailed')).toBe('Trò chơi chưa chạy được. Thử mở lại nhé.');
    expect(vi('links.empty')).toBe('Chưa gửi link nào. Mở bàn rồi gửi link cho bạn.');
    expect(vi('leaderboard.title', { game: 'Tiến Lên' })).toBe('Bảng điểm Tiến Lên');
  });

  it('calls a table "bàn" and "table", never "phòng" or "room" (docs/architecture/surfaces.md)', () => {
    // "Mã dự phòng" is a backup code, not a table.
    const vi = strings('vi').filter(([, text]) => /phòng/iu.test(text.replace(/dự phòng/giu, '')));
    expect(vi).toEqual([]);
    expect(strings('en').filter(([, text]) => /\brooms?\b/i.test(text))).toEqual([]);
    const t = i18n.getFixedT('vi');
    expect(t('rooms.create')).toBe('Mở bàn');
    expect(t('rooms.leave')).toBe('Rời bàn');
    expect(t('rooms.room', { code: '482 913' })).toBe('Bàn 482 913');
    expect(i18n.getFixedT('en')('rooms.room', { code: '482 913' })).toBe('Table 482 913');
  });

  it('names a button that shares: "Rủ bạn", with its game in the name a screen reader gets', () => {
    const vi = i18n.getFixedT('vi');
    expect(vi('share.short')).toBe('Rủ bạn');
    expect(vi('share.button', { game: 'Ghép Khối' })).toContain(vi('share.short'));
    expect(vi('leaderboard.button', { game: 'Ghép Khối' })).toContain(vi('leaderboard.short'));
  });
});

describe('the font', () => {
  it('is Be Vietnam Pro at 400, 600 and 700, Vietnamese and Latin, swapped in, from files next to it', () => {
    for (const weight of [400, 600, 700]) {
      for (const subset of ['vietnamese', 'latin']) {
        const file = `be-vietnam-pro-${subset}-${weight}-normal.woff2`;
        expect(fonts, file).toContain(`./fonts/${file}`);
        expect(
          existsSync(new URL(`../../../packages/design-tokens/fonts/${file}`, import.meta.url)),
          file,
        ).toBe(true);
      }
    }
    expect(fonts.match(/font-display: swap;/g)?.length).toBe(6);
    expect(fonts).not.toMatch(/https?:\/\//);
    expect(existsSync(new URL('../../../packages/design-tokens/fonts/OFL.txt', import.meta.url))).toBe(true);
  });

  it('is --tohe-font in the tokens, with the system font behind it, and the hub’s text', () => {
    expect(tokens).toMatch(/--tohe-font:\s*"Be Vietnam Pro",\s*system-ui,\s*sans-serif/);
    const styles = read('./styles.css');
    expect(styles).toContain('@import "@tohe/design-tokens/fonts.css"');
    expect(styles).toMatch(/font-family:\s*var\(--tohe-font/);
  });
});
