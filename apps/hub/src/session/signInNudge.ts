// A quiet offer to keep a device profile's progress: after a finished game, once, and never again for seven days after
// "Để sau" (ADR 0057, D-05). The key lives on this device; nothing is sent anywhere.
const KEY = 'tohe:signin-nudge-dismissed';
const SILENT_MS = 7 * 24 * 60 * 60 * 1000;

/** When the player last said "Để sau", or null. */
export function readDismissed(): number | null {
  try {
    const at = Number(localStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 ? at : null;
  } catch {
    return null;
  }
}

export const dismissedRecently = (at: number | null, now: number): boolean =>
  at !== null && now - at < SILENT_MS;

/** "Để sau": quiet for seven days. */
export function dismiss(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // Private mode: quiet until the page closes.
  }
}
