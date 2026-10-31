// The player's light/dark choice (ADR 0013), shared by every Tò He page on a host: the hub, the landing page and
// the docs. It belongs to the device and lives in a cookie, because cookies are shared by all ports of a host while
// localStorage is not. theme-init.js applies the same rules before the first paint; theme.test.ts keeps them in step.

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'tohe-theme';

/** Browser UI (status bar) colour per theme: --tohe-bar in tokens.css, checked by theme.test.ts. */
export const BAR_COLOR: Record<Theme, string> = { light: '#f6efe3', dark: '#171310' };

/** The saved choice in a `document.cookie` string; no cookie means "system". */
export function parseChoice(cookie: string): ThemeChoice {
  const saved = /(?:^|;\s*)tohe-theme=(light|dark)(?:;|$)/.exec(cookie)?.[1];
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export function resolveTheme(choice: ThemeChoice, deviceDark: boolean): Theme {
  if (choice !== 'system') return choice;
  return deviceDark ? 'dark' : 'light';
}

/** The `document.cookie` assignment that saves a choice for a year; "system" deletes the cookie. */
export function choiceCookie(choice: ThemeChoice, secure: boolean): string {
  const attributes = `; path=/; samesite=lax${secure ? '; secure' : ''}`;
  return choice === 'system'
    ? `${THEME_COOKIE}=; max-age=0${attributes}`
    : `${THEME_COOKIE}=${choice}; max-age=31536000${attributes}`;
}

/** The choice saved on this device. */
export const savedChoice = (): ThemeChoice => parseChoice(document.cookie);

/** Saves the choice on this device, for every Tò He page on this host. */
export function saveChoice(choice: ThemeChoice) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in Firefox and older iOS Safari.
  document.cookie = choiceCookie(choice, location.protocol === 'https:');
}

/** The device's own light/dark setting; listen to its `change` event to follow it live. */
export const deviceScheme = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Shows a theme: `data-theme` and `color-scheme` on <html>, and the browser UI colour — on every `theme-color` tag, so a
 * page with one per scheme (`media="(prefers-color-scheme: …)"`) follows a choice that differs from the device's.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', BAR_COLOR[theme]);
  }
}
