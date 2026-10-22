// The app's shell: what the browser reads before the app runs (the page's theme colour per scheme, the 404 page), the
// touch rules of its stylesheet, the dev server's root, Zod without the eval probe the CSP refuses, the version Tôi
// shows, the screen a path that is none gets, and the words that were hard-coded.
import { readFileSync } from 'node:fs';
import { BAR_COLOR } from '@tohe/design-tokens/theme';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import notFound from '../404.html?raw';
import index from '../index.html?raw';
import config from '../vite.config.ts?raw';
import i18n from './i18n.ts';
import main from './main.tsx?raw';
import router from './router.tsx?raw';
import pinPad from './ui/PinPad.tsx?raw';
import { shortVersion } from './ui/version.ts';
import './zod-csp.ts';

// A stylesheet's `?raw` comes back empty under Vitest's CSS handling: read the file.
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('the theme colour of the browser’s own bars', () => {
  const metas = (html: string) =>
    [...html.matchAll(/<meta\s+name="theme-color"[^>]*>/g)].map(([tag]) => ({
      media: /media="([^"]*)"/.exec(tag)?.[1],
      content: /content="([^"]*)"/.exec(tag)?.[1],
    }));

  it('is one per scheme in the app’s page, from the tokens', () => {
    expect(metas(index)).toEqual([
      { media: '(prefers-color-scheme: light)', content: BAR_COLOR.light },
      { media: '(prefers-color-scheme: dark)', content: BAR_COLOR.dark },
    ]);
  });

  it('is the same in the 404 page, which runs the same script', () => {
    expect(metas(notFound)).toEqual(metas(index));
  });
});

describe('the 404 page', () => {
  it('speaks both languages, with a link to each home page', () => {
    expect(notFound).toContain('lang="vi"');
    expect(notFound).toContain('lang="en"');
    expect(notFound).toContain('Không tìm thấy trang này');
    expect(notFound).toContain('Page not found');
    expect(notFound).toContain('<a href="/">');
    expect(notFound).toContain('<a href="/en/">');
    expect(notFound).toContain('content="noindex"');
  });
});

describe('the stylesheet’s touch rules', () => {
  it('keeps a finger press from selecting, dragging or opening a menu on the bar, the tiles and the buttons', () => {
    expect(styles).toMatch(
      /button,\s*nav,\s*summary,\s*\[data-tile\]\s*\{[^}]*-webkit-touch-callout:\s*none[^}]*user-select:\s*none/s,
    );
    expect(styles).toMatch(/\[data-tile\] img[^{]*\{[^}]*-webkit-user-drag:\s*none/s);
  });

  it('never selects readable content away: no rule on body, p, headings or the root', () => {
    for (const block of styles.matchAll(/([^{}]+)\{[^{}]*user-select:\s*none[^{}]*\}/g)) {
      expect(block[1]).not.toMatch(/(^|[\s,])(html|body|p|h[1-6]|main|article|section)\s*(,|$)/);
    }
  });

  it('stops the app’s root from pulling to refresh', () => {
    expect(styles).toMatch(/html,\s*body\s*\{[^}]*overscroll-behavior-y:\s*none/s);
  });
});

describe('the dev server', () => {
  it('sends / to the app’s first screen, since the public home page is the other dev server’s', () => {
    expect(config).toMatch(/url\.pathname === '\/'/);
    expect(config).toMatch(/setHeader\('Location', `\/play\$\{url\.search\}`\)/);
    // The comment says what runs, not "the root stays the app's catalog".
    expect(config).not.toContain("The root stays the app's catalog");
  });
});

describe('Zod under the hub’s CSP', () => {
  it('skips the eval probe: jitless, set before any schema runs', () => {
    expect(z.config().jitless).toBe(true);
    // The first thing the app loads; no schema parses before it.
    expect(main.indexOf("import './zod-csp.ts'")).toBeGreaterThan(-1);
    expect(main.indexOf("import './zod-csp.ts'")).toBeLessThan(main.indexOf("import './i18n.ts'"));
  });
});

describe('the version Tôi shows', () => {
  it('keeps seven characters of the commit', () => {
    expect(shortVersion('0.1.0+0123456789abcdef0123456789abcdef01234567')).toBe('0.1.0+0123456');
    expect(shortVersion('1.2.3+abcdef1234')).toBe('1.2.3+abcdef1');
  });

  it('leaves what has no long commit as it is', () => {
    expect(shortVersion('0.1.0')).toBe('0.1.0');
    expect(shortVersion('0.1.0+abc1234')).toBe('0.1.0+abc1234');
    expect(shortVersion('unknown')).toBe('unknown');
  });
});

describe('a path that is no screen', () => {
  it('has a not-found screen of the app’s own, in its language, with the way to Trò chơi', () => {
    expect(router).toMatch(/defaultNotFoundComponent:\s*NotFoundPage/);
    const words = (language: 'vi' | 'en', key: string) => i18n.getFixedT(language)(key);
    expect(words('vi', 'notFound.title')).toBe('Không tìm thấy trang này');
    expect(words('en', 'notFound.title')).toBe('Page not found');
    expect(words('vi', 'notFound.home')).toBe('Về Tò He');
    expect(words('en', 'notFound.home')).toBe('Back to Tò He');
  });
});

describe('words that were fixed in one language', () => {
  it('has the PIN pad’s delete key from the language files', () => {
    expect(pinPad).not.toContain("'Xoá'");
    expect(pinPad).toContain("t('pin.delete')");
    expect(i18n.getFixedT('vi')('pin.delete')).toBe('Xoá');
    expect(i18n.getFixedT('en')('pin.delete')).toBe('Delete');
  });

  it('says in English that the terms and the privacy notice are in Vietnamese, as Tôi’s papers do', () => {
    expect(i18n.getFixedT('en')('legal.inVietnamese')).toBe('(in Vietnamese)');
    expect(i18n.getFixedT('vi')('legal.inVietnamese')).toBe('');
  });
});
