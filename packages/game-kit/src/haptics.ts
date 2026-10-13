/** Short vibrations where the device supports them (Android browsers); a no-op elsewhere (iOS Safari). */
export type Haptic = 'tap' | 'bump' | 'success' | 'error';

const patterns: Record<Haptic, number | number[]> = {
  tap: 8,
  bump: 18,
  success: [12, 40, 24],
  error: [30, 30, 30],
};

let enabled = true;

export const haptics = {
  setEnabled(value: boolean) {
    enabled = value;
  },
  play(kind: Haptic) {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(patterns[kind]);
    } catch {
      // Some browsers throw without a recent user gesture; vibration is a nicety, never an error.
    }
  },
};
