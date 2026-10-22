import { describe, expect, it } from 'vitest';
import initScript from '../theme-init.js?raw';
import tokensCss from '../tokens.css?raw';
import { parseTokens, token } from './index.ts';
import { BAR_COLOR, choiceCookie, parseChoice, resolveTheme, type Theme } from './theme.ts';

describe('theme choice', () => {
  it('reads the saved choice from the cookie, "system" when there is none', () => {
    expect(parseChoice('')).toBe('system');
    expect(parseChoice('tohe-theme=dark')).toBe('dark');
    expect(parseChoice('a=1; tohe-theme=light; b=2')).toBe('light');
    expect(parseChoice('tohe-theme=purple')).toBe('system');
    expect(parseChoice('not-tohe-theme=dark')).toBe('system');
  });

  it('follows the device only for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('saves a choice for a year and forgets it for "system"', () => {
    expect(choiceCookie('dark', false)).toBe('tohe-theme=dark; max-age=31536000; path=/; samesite=lax');
    expect(choiceCookie('light', true)).toContain('; secure');
    expect(choiceCookie('system', false)).toBe('tohe-theme=; max-age=0; path=/; samesite=lax');
  });

  it('colours the browser UI with the --tohe-bar token', () => {
    const themes = parseTokens(tokensCss);
    expect(BAR_COLOR.light).toBe(token(themes.light, 'bar'));
    expect(BAR_COLOR.dark).toBe(token(themes.dark, 'bar'));
  });
});

describe('theme-init.js', () => {
  // The script runs before a page starts; it must reach the same theme as theme.ts for every cookie and device.
  const run = (cookie: string, deviceDark: boolean) => {
    // Two theme-color tags, one per scheme (the hub's index.html): the script sets both.
    const tag = () => {
      const meta = { content: '', setAttribute: (_: string, value: string) => (meta.content = value) };
      return meta;
    };
    const metas = [tag(), tag()];
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    const fakeDocument = { cookie, documentElement: root, querySelectorAll: () => metas };
    const fakeMatchMedia = () => ({ matches: deviceDark });
    new Function('document', 'matchMedia', initScript)(fakeDocument, fakeMatchMedia);
    expect(metas[0]?.content).toBe(metas[1]?.content);
    return { theme: root.dataset.theme, scheme: root.style.colorScheme, bar: metas[0]?.content };
  };

  for (const cookie of [
    '',
    'tohe-theme=dark',
    'tohe-theme=light',
    'x=1; tohe-theme=dark',
    'tohe-theme=nope',
  ]) {
    for (const deviceDark of [false, true]) {
      it(`agrees with theme.ts for "${cookie}" on a ${deviceDark ? 'dark' : 'light'} device`, () => {
        const expected: Theme = resolveTheme(parseChoice(cookie), deviceDark);
        expect(run(cookie, deviceDark)).toEqual({
          theme: expected,
          scheme: expected,
          bar: BAR_COLOR[expected],
        });
      });
    }
  }
});
