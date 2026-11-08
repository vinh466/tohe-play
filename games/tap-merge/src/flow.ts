// The ids a mode screen or the mode hub asks the play stage to start with (the shell's `ctx.choice`). A game with
// modes gets one string back from its pre-play screen; these are the words this game gives it. Pure, so the protocol
// is tested without a board: `resume:journey` continues the saved Journey run, `new:daily` starts today's Daily,
// `level:c2-3` starts that level.
import type { Mode } from './logic.ts';

export type StartChoice =
  | { kind: 'resume'; mode: Mode }
  | { kind: 'new'; mode: Mode }
  | { kind: 'level'; level: string }
  | { kind: 'daily'; date: string };

const MODES: readonly Mode[] = ['classic', 'journey', 'daily'];

export const resumeChoice = (mode: Mode): string => `resume:${mode}`;
export const newChoice = (mode: Mode): string => `new:${mode}`;
export const levelChoice = (level: string): string => `level:${level}`;
export const dailyChoice = (date: string): string => `daily:${date}`;

const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value);

/** Reads a choice from the shell; an unknown or malformed id starts nothing special (the stage keeps its default). */
export function parseChoice(choice: string | null | undefined): StartChoice | null {
  if (!choice) return null;
  const colon = choice.indexOf(':');
  if (colon <= 0) return null;
  const kind = choice.slice(0, colon);
  const value = choice.slice(colon + 1);
  if (!value) return null;
  if (kind === 'resume') return isMode(value) ? { kind: 'resume', mode: value } : null;
  if (kind === 'new') return isMode(value) ? { kind: 'new', mode: value } : null;
  if (kind === 'level') return { kind: 'level', level: value };
  if (kind === 'daily' && /^\d{8}$/.test(value)) return { kind: 'daily', date: value };
  return null;
}
