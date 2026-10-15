// Engine-independent parts of the kit. Phaser helpers live in '@tohe/game-kit/phaser'.
export { formatScore, formatValue } from './format.ts';
export { type Haptic, haptics } from './haptics.ts';
export {
  createLifecycle,
  type Lifecycle,
  type LifecycleOptions,
  type LifecycleStrings,
  lifecycleStrings,
} from './lifecycle.ts';
export { prefersReducedMotion } from './motion.ts';
export {
  type Choice,
  choiceList,
  createOverlay,
  hintList,
  type Overlay,
  type OverlayAction,
  type OverlayCard,
} from './overlay.ts';
export { createSfx, noteFrequency, type Sfx, type SoundName } from './sfx.ts';
export { followTheme, type Theme } from './theme.ts';
