// An account's session that ended says so (ADR 0046, docs/architecture/identity.md "Sessions"): "Phiên đăng nhập đã
// hết — đăng nhập lại để chơi tiếp bằng tài khoản", with a way to sign in, and the device's profiles only when the
// player chooses them. Never a silent fall back to a device profile. The mark lives in localStorage, so a reload keeps
// saying it, until someone signs in or chooses to play on the device.
import type { MeView } from '../api/client.ts';

export const SESSION_ENDED_KEY = 'tohe:session-ended';

/**
 * Whether the API's answer ends a session this device had: it knew an account (the copy of the session it keeps for
 * playing offline) and the API now says nobody is signed in. Signing out, or deleting the account, forgets the copy
 * first, so neither counts.
 */
export function sessionEndedBy(known: MeView | null | undefined, answer: MeView | null): boolean {
  return Boolean(known) && answer === null;
}

export function createSessionEnded(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const store = {
    get: (): boolean => {
      try {
        return storage?.getItem(SESSION_ENDED_KEY) === '1';
      } catch {
        return false;
      }
    },
    mark(): void {
      if (store.get()) return;
      try {
        storage?.setItem(SESSION_ENDED_KEY, '1');
      } catch {
        // Storage refused: the screen says nothing, as before.
      }
      changed();
    },
    /** Someone signed in, or the player chose this device's profiles. */
    clear(): void {
      if (!store.get()) return;
      try {
        storage?.removeItem(SESSION_ENDED_KEY);
      } catch {
        // Nothing kept.
      }
      changed();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return store;
}

function localStorageOrNull() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** This device's. */
export const sessionEnded = createSessionEnded(localStorageOrNull());
