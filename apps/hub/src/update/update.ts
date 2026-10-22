// Quiet updates (ADR 0046, docs/architecture/surfaces.md "Coming back"): a new version of the hub never takes over an
// open page. Its service worker installs and waits (`registerType: 'prompt'`); it takes over once every page of the
// app is closed — the next cold start. In a long session, "Có bản mới — Tải lại" shows on the frame's screens only,
// never during a game, at a table or in a replay; the page reloads only when the player taps it.
// Checked by `pnpm --filter @tohe/hub updates` (e2e/updates.ts): two builds, a page on the first, no reload.
import { tabOf } from '../frame/tabs.ts';

/** Whether the notice shows on this screen: a new version waits, and the screen is one of the frame's tabs. */
export function showsUpdateNotice(waiting: boolean, pathname: string): boolean {
  return waiting && tabOf(pathname) !== null;
}

export interface UpdateDeps {
  /** Hands the waiting service worker the go-ahead; the page reloads once it controls the page (`controlling`). */
  skipWaiting(): Promise<void>;
  /** Whether a new version is still installed and waiting. */
  hasWaiting(): boolean;
  reload(): void;
}

export function createUpdateStore() {
  let waiting = false;
  let applying = false;
  let deps: UpdateDeps | null = null;
  const listeners = new Set<() => void>();
  const found = () => {
    if (waiting) return;
    waiting = true;
    for (const listener of listeners) listener();
  };
  return {
    connect(next: UpdateDeps): void {
      deps = next;
    },
    /** A new version is installed and waits, or another tab of the app already moved to it. */
    found,
    /**
     * The new version controls this page now. Asked for here ("Tải lại"): the reload follows. Moved by another tab:
     * nothing reloads by itself; the notice shows, for the player to choose the moment.
     */
    controlling(): void {
      if (applying) deps?.reload();
      else found();
    },
    /** "Tải lại": the waiting version takes over, then the page reloads. */
    async apply(): Promise<void> {
      if (!deps) return;
      applying = true;
      if (!deps.hasWaiting()) {
        // Nothing waits any more (another tab moved first): the page reloads on the version that controls it.
        deps.reload();
        return;
      }
      await deps.skipWaiting();
    },
    waiting: (): boolean => waiting,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** This page's. */
export const updates = createUpdateStore();
