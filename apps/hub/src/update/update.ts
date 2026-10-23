// Quiet updates (ADR 0046, docs/architecture/surfaces.md "Coming back"): a new version of the hub never takes over a
// page the player is looking at. Its service worker installs and waits (`registerType: 'prompt'`); it takes over once
// every page of the app is closed — the next cold start — or when the app goes out of sight on a screen of the frame
// that holds nothing in progress (`appliesOutOfSight`), so the player comes back to the same screen on the new version
// without seeing it happen. In a long session in sight, "Có bản mới — Tải lại" shows on the frame's screens only,
// never during a game, at a table or in a replay; the page reloads in sight only when the player taps it.
// Checked by `pnpm --filter @tohe/hub updates` (e2e/updates.ts): two builds, a page on the first.
import { isTyping, tabOf } from '../frame/tabs.ts';

/** Whether the notice shows on this screen: a new version waits, and the screen is one of the frame's tabs. */
export function showsUpdateNotice(waiting: boolean, pathname: string): boolean {
  return waiting && tabOf(pathname) !== null;
}

/**
 * Screens of the frame a reload brings back as they were: the tabs' own screens and the list of links. Every other one
 * keeps a step in progress in the page only — a code sent by email, signing up, a profile being moved, the parent gate
 * (Quản lý tài khoản is `/account?manage=true`) — and a reload would start it again. A list of the safe ones, so a new
 * screen waits until it is added here.
 */
const keptByReload = ['/play', '/together', '/account', '/account/links'];

/**
 * Whether the page takes the waiting version as it goes out of sight: a new version waits, the screen is one of the
 * frame's that a reload brings back as it was, and the page holds no work (`holdsWork`). Never a game, a lobby, a table,
 * a replay or a link into them, which are outside the frame.
 */
export function appliesOutOfSight(
  waiting: boolean,
  at: { pathname: string; search: string },
  busy: boolean,
): boolean {
  if (!waiting || busy) return false;
  const path = at.pathname.length > 1 ? at.pathname.replace(/\/+$/, '') : at.pathname;
  if (!keptByReload.includes(path)) return false;
  return !(path === '/account' && new URLSearchParams(at.search).has('manage'));
}

/**
 * Whether the page holds work a reload would lose: a dialog open (a form, a question), or a field that takes typing with
 * text in it.
 */
export function holdsWork(root: Pick<ParentNode, 'querySelector' | 'querySelectorAll'>): boolean {
  if (root.querySelector('dialog[open]')) return true;
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]), textarea',
  );
  return Array.from(fields).some((field) => isTyping(field) && field.value.trim() !== '');
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
  const apply = async (): Promise<void> => {
    if (!deps) return;
    applying = true;
    if (!deps.hasWaiting()) {
      // Nothing waits any more (another tab moved first): the page reloads on the version that controls it.
      deps.reload();
      return;
    }
    await deps.skipWaiting();
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
    apply,
    /**
     * The app went out of sight on this screen: the waiting version takes over and the page reloads, unseen, when
     * `appliesOutOfSight` says so. Otherwise nothing happens; the notice stays for when the player comes back.
     */
    async outOfSight(at: { pathname: string; search: string }, busy: boolean): Promise<void> {
      if (applying || !appliesOutOfSight(waiting, at, busy)) return;
      await apply();
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
