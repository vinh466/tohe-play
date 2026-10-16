// The preset reactions of a table (ADR 0016), mirrored from @tohe/contract without importing Zod into games
// (asserted by a test), with the picture games and the hub show for each.
import type { Reaction } from '@tohe/contract';

export const REACTIONS: Readonly<Record<Reaction, string>> = {
  wave: '👋',
  laugh: '😂',
  wow: '😮',
  clap: '👏',
  hurry: '⏰',
  gg: '🤝',
  sad: '😢',
  heart: '❤️',
};
