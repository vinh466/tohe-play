// Engine-independent parts of the kit. Phaser helpers live in '@tohe/game-kit/phaser'.
export { formatCompact, formatScore, formatValue } from './format.ts';
export { type Haptic, haptics } from './haptics.ts';
export {
  bump,
  createHud,
  type Hud,
  type HudOptions,
  newRunId,
  type ScoreBoard,
  type Stat,
  type StatOptions,
} from './hud.ts';
export {
  type IconName,
  icon,
  iconNames,
  type ShapeName,
  shape,
  shapeNames,
} from './icons.ts';
export { prefersReducedMotion } from './motion.ts';
export {
  type Choice,
  choiceList,
  createOverlay,
  type DecorShape,
  hintList,
  type Overlay,
  type OverlayAction,
  type OverlayCard,
  type OverlayRow,
  type OverlaySection,
  type Picture,
} from './overlay.ts';
export { createSfx, noteFrequency, type Sfx, type SoundName } from './sfx.ts';
export {
  createShell,
  type PlayStage,
  type QuickRow,
  type Shell,
  type ShellOptions,
  type ShellSessionLike,
  type ShellSetting,
  type ShellStrings,
  type StageContext,
  type StageModule,
  shellStrings,
} from './shell.ts';
export { followTheme, type Theme } from './theme.ts';
