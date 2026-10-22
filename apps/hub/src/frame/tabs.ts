// The app's frame (ADR 0046, docs/architecture/surfaces.md "The app's frame"): three tabs — Trò chơi, Chơi cùng, Tôi —
// as a bar at the bottom of a phone and a rail on the left from tablet width, around every screen of the Play zone but a
// game in play, a table and a replay, which stay full screen (ADR 0020). Pure functions here; AppFrame.tsx draws it.

export type TabId = 'games' | 'together' | 'me';

export interface Tab {
  id: TabId;
  /** The tab's own screen. */
  to: '/play' | '/together' | '/account';
  icon: string;
  /** Its name, an i18n key. */
  label: `frame.${TabId}`;
}

export const tabs: readonly Tab[] = [
  { id: 'games', to: '/play', icon: '🎮', label: 'frame.games' },
  { id: 'together', to: '/together', icon: '🤝', label: 'frame.together' },
  { id: 'me', to: '/account', icon: '👤', label: 'frame.me' },
];

/** Screens under /account that belong to Chơi cùng: the full list of the links a player sent. */
const togetherScreens = ['/account/links'];

/**
 * The tab a screen of the frame belongs to, or null for a screen outside the frame: a game (`/play/<id>`), its lobby, a
 * table, a replay, and the links into them (`/r/…`, `/s/…`).
 */
export function tabOf(pathname: string): TabId | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/play') return 'games';
  if (path === '/together' || togetherScreens.includes(path)) return 'together';
  if (path === '/account' || path.startsWith('/account/')) return 'me';
  return null;
}

/** Where a frame screen's "←" leads: the tab's root or the screen it belongs under. */
export type FrameBack = '/play' | '/account' | '/account/sign-in' | '/account/register' | '/account/profiles';

/**
 * Where "←" leads from a screen of the frame that is not a tab's root, or null for a tab's root (and for a screen
 * outside the frame). An installed app on an iPhone has no Back and the bar is not a way back from a form, so every
 * sub-screen has its own arrow (ADR 0046); `Screen` draws it. A way back that the history knows — the screen the player
 * came from — is taken first (`BackLink`), so Android's Back and "←" agree.
 */
export function backTarget(pathname: string): FrameBack | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  switch (path) {
    case '/account/sign-in':
    case '/account/email':
      return '/account';
    case '/account/sign-in/continue':
    case '/account/password/forgot':
    case '/account/password/reset':
    case '/account/register':
      return '/account/sign-in';
    case '/account/register/confirm':
      return '/account/register';
    case '/account/profiles':
      return '/play';
    case '/account/transfer':
    case '/account/transfer/send':
      return '/account/profiles';
    default:
      return null;
  }
}

/** Screens of the frame that draw an arrow of their own, in their header, rather than the one `Screen` draws. */
export const ownBack: readonly string[] = ['/account/data', '/account/links'];

/**
 * The app's own level, to put behind a game, a table or a link into one that the app was opened at directly (a share
 * link, a public page's "Play", the home screen's shortcut, a reload): each level is an entry of the history, so phone
 * Back steps from a game to the app rather than out of it. Null when nothing is needed — another screen, or a page of the
 * app already behind this one (`index` > 0, TanStack Router's number of the entry).
 */
export function appLevelBeneath(pathname: string, index: number | undefined): string | null {
  if ((index ?? 0) > 0) return null;
  return /^\/(?:play|r|s)\/[^/]/.test(pathname) ? '/play' : null;
}

/** Inputs whose keyboard covers the bottom of a phone's screen: the bar steps aside while one has the focus. */
const keyless = new Set([
  'button',
  'checkbox',
  'radio',
  'range',
  'submit',
  'reset',
  'color',
  'file',
  'image',
]);

/** Whether the focused element takes typing — a text field, a text area, a list to choose from, editable text. */
export function isTyping(
  element: { tagName: string; type?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !keyless.has((element.type ?? 'text').toLowerCase());
}
