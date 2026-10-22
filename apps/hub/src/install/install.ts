// Getting Tò He onto the home screen (E-03, R-03): which of three ways fits this device, and when to offer it. The
// decision is pure (`chooseInstall`); the store below only remembers what the browser told the page.

/** A chat app's own browser: it cannot install anything, so the first thing to offer is the real browser. */
export type InApp = 'zalo' | 'messenger' | 'facebook' | 'instagram';

/**
 * - `prompt`: Android, Chrome, Edge — the browser handed over `beforeinstallprompt`; a button calls `prompt()`.
 * - `ios`: Safari on iPhone and iPad has no prompt — the steps of iOS 26.
 * - `open-in-browser`: Zalo, Messenger, Facebook, Instagram — copy the link and open it in the browser.
 * - `generic`: only from Tôi (`menu`), when none of the above fits (a desktop browser without a prompt).
 */
export type InstallVariant = 'prompt' | 'ios' | 'open-in-browser' | 'generic';

/** What the page can tell about where it runs. */
export interface Environment {
  /** Already the installed app (or a fullscreen window of it): nothing to install. */
  standalone: boolean;
  inApp: InApp | null;
  iosSafari: boolean;
}

export interface InstallContext {
  env: Environment;
  /** The browser handed over its install prompt and it was not used yet. */
  canPrompt: boolean;
  /** `auto` is the hub offering by itself; `menu` is the player asking ("Cài app"). */
  trigger: 'auto' | 'menu';
  /** A game finished on this device in this visit. */
  finishedGame: boolean;
  /** The card or sheet was already offered in this visit. */
  shownThisVisit: boolean;
  /** When the player last said no (ms since the epoch), or null. */
  dismissedAt: number | null;
  now: number;
}

/** After a "no", Tò He stays quiet for this long. */
export const SILENT_DAYS = 14;
export const SILENT_MS = SILENT_DAYS * 24 * 60 * 60 * 1000;

export const dismissedRecently = (dismissedAt: number | null, now: number) =>
  dismissedAt !== null && now - dismissedAt < SILENT_MS;

/** The in-app browsers of Zalo, Messenger, Facebook and Instagram, by the markers they add to the User-Agent. */
export function detectInApp(userAgent: string): InApp | null {
  if (/\bZalo/i.test(userAgent)) return 'zalo';
  if (/FB_IAB\/MESSENGER|FBAN\/Messenger|MessengerLite|Orca-Android/i.test(userAgent)) return 'messenger';
  // Instagram's says "Instagram 300.0…", and on Android also Facebook's FB_IAB: its own name first.
  if (/\bInstagram\b/i.test(userAgent)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent)) return 'facebook';
  return null;
}

/** Safari on iPhone or iPad (iPadOS 13+ says "Macintosh", with a touch screen), not another browser or a WebView. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios || detectInApp(userAgent)) return false;
  return /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo/.test(userAgent);
}

export function readEnvironment(): Environment {
  const userAgent = navigator.userAgent;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standalone =
    iosStandalone ||
    ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => matchMedia(`(display-mode: ${mode})`).matches);
  return {
    standalone,
    inApp: detectInApp(userAgent),
    iosSafari: isIosSafari(userAgent, navigator.maxTouchPoints),
  };
}

/**
 * Which way to install to show now, or null for nothing.
 *
 * - Never when already running as the app.
 * - From Tôi (`menu`): always, whatever was said before — the way that fits, else `generic`.
 * - By itself: not for 14 days after a "no"; the in-app browser's strip at once, on arrival; the card or the sheet once
 *   per visit, after the first finished game.
 */
export function chooseInstall(c: InstallContext): InstallVariant | null {
  if (c.env.standalone) return null;
  const fits: InstallVariant | null = c.env.inApp
    ? 'open-in-browser'
    : c.env.iosSafari
      ? 'ios'
      : c.canPrompt
        ? 'prompt'
        : null;
  if (c.trigger === 'menu') return fits ?? 'generic';
  if (fits === null || dismissedRecently(c.dismissedAt, c.now)) return null;
  if (fits === 'open-in-browser') return fits;
  return c.finishedGame && !c.shownThisVisit ? fits : null;
}

// ---------------------------------------------------------------- what the page remembers

/** The event `beforeinstallprompt` carries; not in the DOM typings yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** What the install store tells the newcomer funnel (telemetry/funnel.ts); the store knows nothing of telemetry. */
export interface InstallReporter {
  accepted(): void;
  dismissed(): void;
}

export interface InstallState {
  env: Environment;
  canPrompt: boolean;
  finishedGame: boolean;
  shownThisVisit: boolean;
  dismissedAt: number | null;
}

const DISMISSED_KEY = 'tohe:install-dismissed';

function readDismissed(): number | null {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 ? at : null;
  } catch {
    return null;
  }
}

let state: InstallState | null = null;
let promptEvent: InstallPromptEvent | null = null;
let reporter: InstallReporter | null = null;
const listeners = new Set<() => void>();

const current = (): InstallState =>
  (state ??= {
    env: readEnvironment(),
    canPrompt: false,
    finishedGame: false,
    shownThisVisit: false,
    dismissedAt: readDismissed(),
  });

function change(patch: Partial<InstallState>) {
  state = { ...current(), ...patch };
  for (const listener of listeners) listener();
}

export const installStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  snapshot: current,

  /**
   * Keeps the browser's install prompt for later. Called when the hub starts: the event fires once, early, and the
   * page must not let the browser's own mini-bar take it. `report` hears the answers (the newcomer funnel).
   */
  capture(report?: InstallReporter) {
    reporter = report ?? null;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      promptEvent = event as InstallPromptEvent;
      change({ canPrompt: true });
    });
    window.addEventListener('appinstalled', () => {
      promptEvent = null;
      change({ canPrompt: false, env: { ...current().env, standalone: true } });
    });
  },

  /** A game reported a final score: the first one is the moment the card or sheet may appear. */
  gameFinished() {
    if (!current().finishedGame) change({ finishedGame: true });
  },

  /** The card or sheet was put on screen: not again in this visit. */
  shown() {
    if (!current().shownThisVisit) change({ shownThisVisit: true });
  },

  /** "Để sau", "Bỏ qua" or "Ẩn", or the browser's prompt closed: silent for 14 days. */
  dismiss(now = Date.now()) {
    reporter?.dismissed();
    try {
      localStorage.setItem(DISMISSED_KEY, String(now));
    } catch {
      // Private mode: silent until the page closes.
    }
    change({ dismissedAt: now });
  },

  /** Opens the browser's own install dialog. An event is good for one use. */
  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = promptEvent;
    if (!event) return 'unavailable';
    promptEvent = null;
    change({ canPrompt: false });
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'dismissed') installStore.dismiss();
    else reporter?.accepted();
    return outcome;
  },
};
