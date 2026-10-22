import {
  Link,
  type LinkComponentProps,
  type NavigateOptions,
  type RegisteredRouter,
  type RouterHistory,
  useRouter,
} from '@tanstack/react-router';
import { useCallback } from 'react';
import { appLevelBeneath } from '../frame/tabs.ts';
import { createTrail, type Trail } from './trail.ts';

let trail: Trail | null = null;

/** Follows the app's history from the start, so leaving a screen knows what is behind it. */
export function followTrail(history: RouterHistory, behind?: Readonly<Record<number, string>>): void {
  trail?.stop();
  trail = createTrail(history, behind);
}

/**
 * Opened straight at a game, a table or a link into one (a share link, a public page's "Chơi", the home screen's
 * shortcut, a reload with nothing of the app behind): the app's level goes behind it first, as an entry of its own, so
 * phone Back steps from the game to the app rather than out of Tò He (ADR 0046). Call before the router starts; returns
 * what it put behind, for the trail.
 */
export function putAppLevelBehind(win: Window = window): Record<number, string> | undefined {
  const state = win.history.state as { __TSR_index?: number } | null;
  const beneath = appLevelBeneath(win.location.pathname, state?.__TSR_index);
  if (!beneath) return undefined;
  const here = `${win.location.pathname}${win.location.search}${win.location.hash}`;
  // The entries as TanStack Router numbers them (its history reads `__TSR_index` and the keys back).
  const entry = (index: number) => {
    const key = Math.random().toString(36).slice(2, 10);
    return { ...state, __TSR_index: index, key, __TSR_key: key };
  };
  win.history.replaceState(entry(0), '', beneath);
  win.history.pushState(entry(1), '', here);
  return { 0: beneath };
}

/** The path of the screen right behind this one in the history, when the app saw it. */
export const previousPath = (): string | undefined => trail?.previous();

/**
 * Leaving a screen (←, "Về Tò He", leaving a table, a profile chosen): back to the target when the player came from
 * there, so the history stays the way they walked it and phone Back on the catalog leaves the app; in place of this
 * screen otherwise (a room link from a chat, a reload). It never waits on a game's Back handling (useBlocker).
 */
export function useLeaveTo() {
  const router = useRouter();
  return useCallback(
    <const TTo extends string | undefined = undefined>(
      options: NavigateOptions<RegisteredRouter, string, TTo>,
    ) => {
      const { pathname } = router.buildLocation(options as NavigateOptions);
      const steps = trail?.stepsBackTo(pathname) ?? 0;
      if (steps > 0) router.history.go(-steps, { ignoreBlocker: true });
      else void router.navigate({ ...(options as NavigateOptions), replace: true, ignoreBlocker: true });
    },
    [router],
  );
}

/** A link that leaves this screen for its target the way `useLeaveTo` does; still a real link (long-press, a11y). */
export function BackLink<const TTo extends string | undefined = undefined>(
  props: LinkComponentProps<'a', RegisteredRouter, string, TTo>,
) {
  const leaveTo = useLeaveTo();
  const { to, params, search, hash } = props as NavigateOptions;
  return (
    <Link
      {...(props as LinkComponentProps<'a'>)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        leaveTo({ to, params, search, hash } as NavigateOptions);
      }}
    />
  );
}
