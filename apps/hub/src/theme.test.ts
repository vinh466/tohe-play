import { parseTokens, token } from '@tohe/design-tokens';
import tokensCss from '@tohe/design-tokens/tokens.css?raw';
import { describe, expect, it } from 'vitest';
import initScript from '../public/theme-init.js?raw';
import { BAR_COLOR, choiceCookie, parseChoice, resolveTheme, type Theme } from './theme/theme.ts';

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

describe('public/theme-init.js', () => {
  // The script runs before the app; it must reach the same theme as theme.ts for every cookie and device setting.
  const run = (cookie: string, deviceDark: boolean) => {
    const meta = { content: '', setAttribute: (_: string, value: string) => (meta.content = value) };
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    const fakeDocument = { cookie, documentElement: root, querySelector: () => meta };
    const fakeMatchMedia = () => ({ matches: deviceDark });
    new Function('document', 'matchMedia', initScript)(fakeDocument, fakeMatchMedia);
    return { theme: root.dataset.theme, scheme: root.style.colorScheme, bar: meta.content };
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
