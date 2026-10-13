// The hub's light/dark state (ADR 0013): the device's choice from @tohe/design-tokens/theme in a small store that
// React and the picker read. "system" follows the device live, e.g. when a phone turns dark at night.
// public/theme-init.js (a copy of the shared script) applies the choice before the first paint.
import {
  applyTheme,
  deviceScheme,
  resolveTheme,
  saveChoice,
  savedChoice,
  type Theme,
  type ThemeChoice,
} from '@tohe/design-tokens/theme';

export type { Theme, ThemeChoice };

export interface ThemeState {
  choice: ThemeChoice;
  theme: Theme;
}

let state: ThemeState = { choice: 'system', theme: 'light' };
let device: MediaQueryList | null = null;
const listeners = new Set<() => void>();

/** Applies the saved choice and follows the device's light/dark setting. Call once, before rendering. */
export function startTheme() {
  device = deviceScheme();
  device.addEventListener('change', () => update(state.choice));
  update(savedChoice());
}

export function setThemeChoice(choice: ThemeChoice) {
  saveChoice(choice);
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
  applyTheme(theme);
  state = { choice, theme };
  for (const listener of listeners) listener();
}
