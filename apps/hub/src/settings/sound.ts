// Sound on or off for this device (ADR 0018): one switch, whichever game, the in-game bar or Tôi → Âm thanh turned it.

/** The device's choice, `1` for muted; the games learn it through the hub (`settings.muted`). */
export const MUTED_KEY = 'tohe:muted';

const listeners = new Set<() => void>();

/** Whether this device keeps the games quiet: sound is on until someone turns it off, and when storage is blocked. */
export function readMuted(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers the choice and tells who shows it; in private mode it holds for this visit only. */
export function saveMuted(
  muted: boolean,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Nowhere to keep it.
  }
  for (const listener of listeners) listener();
}

/** Told when the choice changes here (`useSyncExternalStore`). */
export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
