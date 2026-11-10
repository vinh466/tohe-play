// The run slots a player can switch between: a free game, the journey level they are on, and today's daily. One run of
// each is kept when the player changes mode — the active one is `store.game`, the others are parked — so switching a
// mode never throws a run away. The helpers here are pure so the choices can be tested without a session.
import type { State } from './logic.ts';
import { todayId } from './strings.ts';

export type ModeSlot = 'endless' | 'journey' | 'daily';
export const MODE_SLOTS: readonly ModeSlot[] = ['endless', 'journey', 'daily'];

export const slotOf = (state: State): ModeSlot =>
  state.mode === 'journey' ? 'journey' : state.mode === 'daily' ? 'daily' : 'endless';

export const isLive = (state: State | null | undefined): state is State =>
  state !== null && state !== undefined && !state.over;

/** A daily run only belongs to the day it was started: yesterday's practice is not today's daily. */
export const dailyDateOf = (state: State): string | null => {
  if (state.mode !== 'daily' || !state.level?.startsWith('daily-')) return null;
  return state.level.slice('daily-'.length);
};

/** The parked run `slot` may resume now, or null: it is over, of another mode, or a daily from another day. */
export function resumable(
  parked: Partial<Record<ModeSlot, State>>,
  slot: ModeSlot,
  today = todayId(),
): State | null {
  const state = parked[slot];
  if (!isLive(state) || slotOf(state) !== slot) return null;
  if (slot === 'daily' && dailyDateOf(state) !== today) return null;
  return state;
}

/** The next journey level to offer: the first one without a star, else the last one played, else the first. */
export function nextLevelId(journey: Readonly<Record<string, number>>, levels: readonly string[]): string {
  return levels.find((id) => (journey[id] ?? 0) === 0) ?? levels[levels.length - 1] ?? '';
}
