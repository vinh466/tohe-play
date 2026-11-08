// The ids the mode hub or a screen asks the play stage to start with (the shell's `ctx.choice`). The shell says
// whether it is a fresh run (`ctx.fresh`): `choose('journey', false)` resumes the saved Journey run,
// `choose('journey', true)` starts the next level, and `choose(levelChoice('c2-3'), true)` starts that level.
// Pure, so the protocol is tested without a board.
import type { Mode } from './logic.ts';

export type StartChoice = { kind: 'mode'; mode: Mode } | { kind: 'level'; level: string };

const MODES: readonly Mode[] = ['classic', 'journey', 'daily'];

const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value);

export const levelChoice = (level: string): string => `level:${level}`;

/** Reads a choice from the shell; an unknown or malformed id starts nothing special (the stage keeps its default). */
export function parseChoice(choice: string | null | undefined): StartChoice | null {
  if (!choice) return null;
  if (isMode(choice)) return { kind: 'mode', mode: choice };
  if (choice.startsWith('level:')) {
    const level = choice.slice('level:'.length);
    return level ? { kind: 'level', level } : null;
  }
  return null;
}
