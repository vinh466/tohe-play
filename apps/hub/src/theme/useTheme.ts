import { useSyncExternalStore } from 'react';
import { subscribeTheme, themeState } from './theme.ts';

/** The current choice (system / light / dark) and the theme it resolves to; re-renders when either changes. */
export function useTheme() {
  return useSyncExternalStore(subscribeTheme, themeState);
}
