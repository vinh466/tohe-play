/** Short vibrations where the device supports them (Android browsers); a no-op elsewhere (iOS Safari). */
export type Haptic = 'tap' | 'bump' | 'success' | 'celebrate' | 'error';

/** In tiers like the rest of the feel: `celebrate` is for the rarest moments (a level reached, a record). */
const patterns: Record<Haptic, number | number[]> = {
  tap: 8,
  bump: 18,
  success: [12, 40, 24],
  celebrate: [24, 50, 24, 50, 70],
  error: [30, 30, 30],
};

let enabled = true;

export const haptics = {
  setEnabled(value: boolean) {
    enabled = value;
  },
  play(kind: Haptic) {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    // Before the first touch in the frame Chrome refuses (and logs an error): e.g. an online table's "your turn".
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      navigator.vibrate(patterns[kind]);
    } catch {
      // Some browsers throw without a recent user gesture; vibration is a nicety, never an error.
    }
  },
};
