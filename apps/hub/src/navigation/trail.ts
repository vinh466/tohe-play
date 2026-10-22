// The pages behind the current one, so leaving a screen can go back the way the player came instead of stacking
// another page on top. Without it, "Về Tò He" from a game left [catalog, game, catalog] in the history, and phone
// Back on the catalog reopened the game just left; on an installed app Back could never leave it.
import type { RouterHistory } from '@tanstack/react-router';

export interface Trail {
  /** How many pages back `pathname` is, or 0 when it is not behind the current page (or not known to be). */
  stepsBackTo(pathname: string): number;
  /** The path of the page right behind this one, when it is known. */
  previous(): string | undefined;
  stop(): void;
}

/**
 * Remembers the path of every history entry seen in this visit (a reload forgets the older ones). `behind`: entries
 * known before it starts — the app's level put behind a game the app was opened at (main.tsx).
 */
export function createTrail(history: RouterHistory, behind: Readonly<Record<number, string>> = {}): Trail {
  const pages = new Map<number, string>(Object.entries(behind).map(([index, path]) => [Number(index), path]));
  const note = () => {
    const { pathname, state } = history.location;
    pages.set(state.__TSR_index, pathname);
  };
  note();
  const unsubscribe = history.subscribe(note);
  return {
    stepsBackTo(pathname) {
      const here = history.location.state.__TSR_index;
      for (let index = here - 1; index >= 0; index--) {
        const page = pages.get(index);
        // Before a reload: unknown, so not skipped over.
        if (page === undefined) return 0;
        if (page === pathname) return here - index;
      }
      return 0;
    },
    previous() {
      return pages.get(history.location.state.__TSR_index - 1);
    },
    stop: unsubscribe,
  };
}
