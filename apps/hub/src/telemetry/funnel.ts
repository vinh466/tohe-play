// The newcomer funnel (docs/architecture/telemetry.md, "Newcomer funnel"): a few fixed `hub.funnel.*` counts that say
// how far newcomers get — a guest arrives, plays a first game, is offered the app, signs in — without following anyone.
// They are ordinary telemetry counts: no identifier, no new event kind, and nothing is sent when telemetry is off.
//
// A step that happens "once" is remembered on the device (localStorage `tohe:funnel`) so it is counted once per
// device, never again; that memory is a name and a day, tied to nothing. Pure apart from what is injected.
import type { KeyValue } from './collector.ts';

export const FUNNEL_KEY = 'tohe:funnel';

/** The names, fixed: the API's report reads these (`hub.funnel.*`). */
export const FUNNEL = {
  guestStart: 'hub.funnel.guest-start',
  firstGame: 'hub.funnel.first-game',
  installOffered: {
    prompt: 'hub.funnel.install-offered.prompt',
    ios: 'hub.funnel.install-offered.ios',
    inApp: 'hub.funnel.install-offered.in-app',
  },
  installAccepted: 'hub.funnel.install-accepted',
  installDismissed: 'hub.funnel.install-dismissed',
  signInOpened: 'hub.funnel.sign-in-opened',
  accountCreated: 'hub.funnel.account-created',
  standaloneOpen: 'hub.funnel.standalone-open',
} as const;

/** An `InstallVariant` of install/install.ts; `generic` (only from the menu, never offered by itself) is not counted. */
export type OfferedVariant = 'prompt' | 'ios' | 'open-in-browser' | 'generic';

export interface FunnelDeps {
  /** Adds one to a count of the telemetry collector. */
  count(name: string): void;
  /** The collector's consent: false when any switch is off, null until the server's switch is known. */
  consent(): boolean | null;
  storage: KeyValue;
  now(): number;
}

export interface Funnel {
  /** A device enters as a guest for the first time. Once. */
  guestStart(): void;
  /** The first finished game on this device. Once. */
  firstGame(): void;
  /** The install card, the iOS sheet or the in-app strip was shown by itself. Once per variant. */
  installOffered(variant: OfferedVariant): void;
  /** The browser's install prompt was accepted. Each time. */
  installAccepted(): void;
  /** The install prompt was dismissed, or "Bỏ qua" / "Ẩn" was chosen. Each time. */
  installDismissed(): void;
  /** A guest opened the sign-in from the catalog's strip. Each time. */
  signInOpened(): void;
  /** An account was created on this device. Each time. */
  accountCreated(): void;
  /** The app started in standalone display mode. Once per day. */
  standaloneOpen(): void;
}

/** What is remembered: a step's name and the UTC day it was last counted. */
type Remembered = Record<string, string>;

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function createFunnel(deps: FunnelDeps): Funnel {
  const read = (): Remembered => {
    try {
      const stored = JSON.parse(deps.storage.getItem(FUNNEL_KEY) ?? '{}') as unknown;
      return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Remembered) : {};
    } catch {
      return {};
    }
  };

  /**
   * Counts a step, unless telemetry is off. A step that happens once is remembered only when counted: a device that
   * turns telemetry on later is not missing the step it never reported.
   */
  const step = (name: string, when: 'each' | 'once' | 'daily') => {
    if (deps.consent() === false) return;
    if (when !== 'each') {
      const remembered = read();
      const today = day(deps.now());
      if (when === 'once' ? name in remembered : remembered[name] === today) return;
      try {
        deps.storage.setItem(FUNNEL_KEY, JSON.stringify({ ...remembered, [name]: today }));
      } catch {
        // Storage blocked (private mode): the step cannot be told to be new, so it is not counted at all.
        return;
      }
    }
    deps.count(name);
  };

  return {
    guestStart: () => step(FUNNEL.guestStart, 'once'),
    firstGame: () => step(FUNNEL.firstGame, 'once'),
    installOffered: (variant) => {
      if (variant === 'generic') return;
      step(
        variant === 'prompt'
          ? FUNNEL.installOffered.prompt
          : variant === 'ios'
            ? FUNNEL.installOffered.ios
            : FUNNEL.installOffered.inApp,
        'once',
      );
    },
    installAccepted: () => step(FUNNEL.installAccepted, 'each'),
    installDismissed: () => step(FUNNEL.installDismissed, 'each'),
    signInOpened: () => step(FUNNEL.signInOpened, 'each'),
    accountCreated: () => step(FUNNEL.accountCreated, 'each'),
    standaloneOpen: () => step(FUNNEL.standaloneOpen, 'daily'),
  };
}
