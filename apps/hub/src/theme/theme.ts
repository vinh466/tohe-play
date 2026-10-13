// Light / dark theme of the hub (ADR 0013). The choice belongs to the device and lives in a cookie, so the site on
// the same host (another port) can follow it too. "system" follows the device and switches live, e.g. when a phone
// turns dark at night. public/theme-init.js applies the same rules before the first paint; theme.test.ts keeps
// the two in step.

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'tohe-theme';

/** Browser UI (status bar) colour per theme: --tohe-bar in tokens.css, checked by theme.test.ts. */
export const BAR_COLOR: Record<Theme, string> = { light: '#f97316', dark: '#17110e' };

/** The saved choice in a `document.cookie` string; no cookie means "system". */
export function parseChoice(cookie: string): ThemeChoice {
  const saved = /(?:^|;\s*)tohe-theme=(light|dark)(?:;|$)/.exec(cookie)?.[1];
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export function resolveTheme(choice: ThemeChoice, deviceDark: boolean): Theme {
  if (choice !== 'system') return choice;
  return deviceDark ? 'dark' : 'light';
}

/** The `document.cookie` assignment that saves a choice; "system" deletes the cookie. */
export function choiceCookie(choice: ThemeChoice, secure: boolean): string {
  const attributes = `; path=/; samesite=lax${secure ? '; secure' : ''}`;
  return choice === 'system'
    ? `${THEME_COOKIE}=; max-age=0${attributes}`
    : `${THEME_COOKIE}=${choice}; max-age=31536000${attributes}`;
}

export interface ThemeState {
  choice: ThemeChoice;
  theme: Theme;
}

let state: ThemeState = { choice: 'system', theme: 'light' };
let device: MediaQueryList | null = null;
const listeners = new Set<() => void>();

/** Applies the saved choice and follows the device's light/dark setting. Call once, before rendering. */
export function startTheme() {
  device = window.matchMedia('(prefers-color-scheme: dark)');
  device.addEventListener('change', () => update(state.choice));
  update(parseChoice(document.cookie));
}

export function setThemeChoice(choice: ThemeChoice) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in Firefox and older iOS Safari.
  document.cookie = choiceCookie(choice, location.protocol === 'https:');
  update(choice);
}

export const themeState = () => state;

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(choice: ThemeChoice) {
  const theme = resolveTheme(choice, device?.matches ?? false);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme]);
  state = { choice, theme };
  for (const listener of listeners) listener();
}
