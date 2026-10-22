// "Ai đang chơi?" on a shared device (ADR 0046, docs/architecture/surfaces.md "Coming back"): with more than one
// profile, one tap at a cold start that follows 30 minutes unused; otherwise the last player stays. Moving from an
// account's child profile to an adult's asks for the account's manage PIN; the other way asks nothing. Pure apart from
// what is injected; RequireSession asks, the profile picker answers.
import type { MeView, ProfileView } from '../api/client.ts';
import { parentUnlocked } from './session.ts';

/** When the app was last in use on this device (ms since the epoch), in localStorage: a time, tied to nobody. */
export const LAST_USED_KEY = 'tohe:last-used';

/** Unused this long, a cold start asks who is playing. */
export const IDLE_MS = 30 * 60 * 1000;

/** How often the time of last use is written while the app is in sight. */
export const TOUCH_EVERY_MS = 60 * 1000;

/** The part of `Storage` used here: localStorage in the hub, a map in tests. */
export type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Whether a cold start follows 30 minutes unused. A device that never noted a time (its first start, or storage
 * refused) and a time ahead of the clock (the clock was set back) say no: the last player stays.
 */
export function idleBefore(lastUsed: number | null, now: number): boolean {
  return lastUsed !== null && lastUsed <= now && now - lastUsed >= IDLE_MS;
}

/** Whether "Ai đang chơi?" is asked: the cold start followed 30 minutes unused, and there is someone else to choose. */
export function asksWhoIsPlaying(idle: boolean, profiles: number): boolean {
  return idle && profiles > 1;
}

export function createWhoIsPlaying(storage: KeyValue | null, now: () => number = Date.now) {
  let pending = false;
  const read = (): number | null => {
    try {
      const value = Number(storage?.getItem(LAST_USED_KEY) ?? Number.NaN);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  };
  const touch = () => {
    try {
      storage?.setItem(LAST_USED_KEY, String(now()));
    } catch {
      // Storage refused: no time is known, so nobody is asked.
    }
  };
  return {
    /** The cold start: whether it follows 30 minutes unused is decided now, once, and the time of use noted. */
    start(): void {
      pending = idleBefore(read(), now());
      touch();
    },
    /** The app is in use: noted, so a later cold start knows. */
    touch,
    /** Whether this start still owes the question (until the picker showed it). */
    pending: (): boolean => pending,
    /** The picker asked: not again until the next cold start. */
    asked(): void {
      pending = false;
    },
  };
}

function localStorageOrNull(): KeyValue | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** This device's. */
export const whoIsPlaying = createWhoIsPlaying(localStorageOrNull());

/**
 * Keeps the time of last use while the app is in sight: every minute, and when it goes out of sight (another app, a
 * locked phone, the tab closed).
 */
export function keepLastUsed(target: Pick<Document, 'addEventListener' | 'visibilityState'> = document) {
  const touchIfSeen = () => {
    if (target.visibilityState === 'visible') whoIsPlaying.touch();
  };
  setInterval(touchIfSeen, TOUCH_EVERY_MS);
  // Going out of sight is the moment of last use; coming back counts as use too.
  target.addEventListener('visibilitychange', () => whoIsPlaying.touch());
  addEventListener('pagehide', () => whoIsPlaying.touch());
}

/**
 * Whether choosing `to` asks for the account's manage PIN first (step-up level 1): moving from an account's child
 * profile to an adult's, unless management is open on this device already. A child's to a child's, an adult's to
 * anyone's, and the first choice (nobody playing yet) ask nothing.
 */
export function switchNeedsGate(me: MeView, to: Pick<ProfileView, 'id' | 'kind'>, now = new Date()): boolean {
  const from = me.profiles.find((profile) => profile.id === me.activeProfileId);
  if (from?.kind !== 'child' || to.kind === 'child' || to.id === from.id) return false;
  return !parentUnlocked(me, now);
}
