// Light/dark for games (ADR 0013). A game that declares both themes in game.json follows the hub: followTheme sets
// data-theme on <html>, so the kit's screens and any CSS on the design tokens switch with it, and tells the game so
// it can redraw what it paints itself (canvas, Phaser). A game with one look skips this and keeps its own.
import { applyTheme, type Theme } from '@tohe/design-tokens/theme';
import type { GameSession } from '@tohe/game-sdk';

export type { Theme };

/**
 * Applies the hub's theme now and whenever it changes; `onTheme` runs each time, including once at the start.
 * Returns an unsubscribe function.
 */
export function followTheme(session: Pick<GameSession, 'settings' | 'on'>, onTheme?: (theme: Theme) => void) {
  let current = session.settings.theme;
  applyTheme(current);
  onTheme?.(current);
  return session.on('settings', (settings) => {
    if (settings.theme === current) return;
    current = settings.theme;
    applyTheme(current);
    onTheme?.(current);
  });
}
