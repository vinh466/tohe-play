// What both stages share: the session, the words, the sounds and the player's save. The menu stage reads the save
// for its summaries and screens; the play stage plays from it and writes it back.
import { createSfx, formatScore, newRunId } from '@tohe/game-kit';
import { connect } from '@tohe/game-sdk';
import { earned } from './content/achievements.ts';
import { rankName } from './content/ranks.ts';
import { completed, type Goal, goalMet, restore, type State, starsFor } from './logic.ts';
import { DEFAULT_PALETTE, isPalette, type PaletteId } from './palette.ts';
import { dailyDateOf, isLive, MODE_SLOTS, type ModeSlot, resumable, slotOf } from './runs.ts';
import { stringsFor, todayId } from './strings.ts';

export interface Stats {
  games: number;
  totalScore: number;
  lines: number;
  bestCombo: number;
  bestStreak: number;
  perfects: number;
}

export interface Settings {
  palette: PaletteId;
  /** False for a save from before the palette choice was recorded; a `paper` default then becomes the new fresh one. */
  palettePicked?: boolean;
  skin: string;
  hints: boolean;
}

export interface Saved {
  v: 1;
  best: number;
  game: State | null;
  tutorialSeen: boolean;
  run?: string;
  journey?: Record<string, number>;
  daily?: { dates?: Record<string, number> };
  stats?: Stats;
  achievements?: string[];
  settings?: Partial<Settings>;
  /** A level or daily the journey screen asked the stage to start on the next play. */
  pending?: { level?: string; daily?: string; restart?: boolean };
  /** Runs parked when the player changed mode; the active one is `game`. */
  parked?: Partial<Record<ModeSlot, State>>;
  /** The hub run id of each parked run, so resuming continues the same run instead of opening a new one. */
  parkedRuns?: Partial<Record<ModeSlot, string>>;
  /** The goals met in the best journey result per level, and in today's daily. */
  journeyGoals?: Record<string, boolean[]>;
  dailyGoals?: { date: string; met: boolean[] };
}

const DEFAULT_STATS: Stats = { games: 0, totalScore: 0, lines: 0, bestCombo: 0, bestStreak: 0, perfects: 0 };
const DEFAULT_SETTINGS: Settings = { palette: DEFAULT_PALETTE, skin: 'paper', hints: true };

export const session = await connect<Saved>({ gameId: 'fill-blocks' });
export const t = stringsFor(session.locale);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
const resumed = restore(saved?.game);
// Yesterday's daily is not resumed as today's: it stays out of the way, and the daily screen starts today's.
const active =
  resumed && !resumed.over && (resumed.mode !== 'daily' || dailyDateOf(resumed) === todayId())
    ? resumed
    : null;
const parked: Partial<Record<ModeSlot, State>> = {};
const parkedRuns: Partial<Record<ModeSlot, string>> = {};
for (const slot of MODE_SLOTS) {
  const run = restore(saved?.parked?.[slot]);
  if (!isLive(run) || slotOf(run) !== slot) continue;
  if (slot === 'daily' && dailyDateOf(run) !== todayId()) continue;
  parked[slot] = run;
  const id = saved?.parkedRuns?.[slot];
  if (typeof id === 'string' && id.length > 0) parkedRuns[slot] = id;
}

const settings = (): Settings => {
  const value = saved?.settings;
  const savedPalette = isPalette(value?.palette) ? value.palette : DEFAULT_PALETTE;
  // The old default was `paper`; a save that never recorded a choice moves to the new fresh default. A deliberate
  // `contrast` choice stays; `paper` is still one tap away in settings.
  const palette = value?.palettePicked === true || savedPalette !== 'paper' ? savedPalette : DEFAULT_PALETTE;
  return {
    palette,
    palettePicked: value?.palettePicked === true,
    skin: typeof value?.skin === 'string' ? value.skin : DEFAULT_SETTINGS.skin,
    hints: value?.hints !== false,
  };
};

/** The save in memory; the next game continues its random sequence. */
export const store: {
  best: number;
  game: State | null;
  tutorialSeen: boolean;
  run: string | null;
  journey: Record<string, number>;
  dailyDates: Record<string, number>;
  stats: Stats;
  achievements: Set<string>;
  settings: Settings;
  pending: { level?: string; daily?: string; restart?: boolean };
  parked: Partial<Record<ModeSlot, State>>;
  parkedRuns: Partial<Record<ModeSlot, string>>;
  journeyGoals: Record<string, boolean[]>;
  dailyGoals: { date: string; met: boolean[] } | null;
} = {
  best: saved?.best ?? 0,
  game: active,
  tutorialSeen: saved?.tutorialSeen ?? false,
  run: (active && saved?.run) || null,
  journey: { ...(saved?.journey ?? {}) },
  dailyDates: { ...(saved?.daily?.dates ?? {}) },
  stats: { ...DEFAULT_STATS, ...(saved?.stats ?? {}) },
  achievements: new Set(saved?.achievements ?? []),
  settings: settings(),
  pending: { ...(saved?.pending ?? {}) },
  parked,
  parkedRuns,
  journeyGoals: { ...(saved?.journeyGoals ?? {}) },
  dailyGoals: saved?.dailyGoals?.date === todayId() ? saved.dailyGoals : null,
};

/** A parked run that can be resumed now; do not remove it — `resumeParked` does. */
export const parkedRun = (slot: ModeSlot): State | null => resumable(store.parked, slot);

/** Keeps the active run in its mode's slot: switching to another mode never throws it away. */
export function parkActive(): void {
  const game = store.game;
  if (!isLive(game)) return;
  const slot = slotOf(game);
  store.parked[slot] = game;
  if (store.run) store.parkedRuns[slot] = store.run;
}

/** Takes a parked run back into play, with the hub run it already had. */
export function resumeParked(slot: ModeSlot): { state: State; runId: string | null } | null {
  const state = parkedRun(slot);
  if (!state) return null;
  const runId = store.parkedRuns[slot] ?? null;
  delete store.parked[slot];
  delete store.parkedRuns[slot];
  return { state, runId };
}

/** Ends a parked run the player is replacing, so its live score does not stay open on the board. */
export function dropParked(slot: ModeSlot): void {
  const state = store.parked[slot];
  const runId = store.parkedRuns[slot];
  delete store.parked[slot];
  delete store.parkedRuns[slot];
  if (state && runId) {
    void session
      .run(runId)
      .finish(state.score)
      .catch((error) => session.log('warn', String(error)));
  }
}

/** A new endless seed: not the hub's daily seed, and different from the last board. */
export function nextSeed(): number {
  const base = store.game?.rng ?? session.seed;
  return (base ^ Math.imul(store.stats.games + 1, 0x9e3779b1)) >>> 0;
}

export const journeyStars = (): number => Object.values(store.journey).reduce((sum, stars) => sum + stars, 0);

export const rankLabel = (): string => rankName(store.best, session.locale);

export const scoreText = (value: number): string => formatScore(value, session.locale);

export const runFor = (runId: string) => session.run(runId);

/** Counts a finished game once, records journey/daily progress and the achievements it unlocked. */
export function finishGame(state: State, goals: readonly Goal[]): void {
  const level = state.level;
  if (state.mode === 'endless' && state.score > store.best) store.best = state.score;
  store.stats.games += 1;
  store.stats.totalScore += state.score;
  store.stats.lines += state.lines;
  store.stats.bestCombo = Math.max(store.stats.bestCombo, state.maxCombo);
  store.stats.bestStreak = Math.max(store.stats.bestStreak, state.maxStreak);
  store.stats.perfects += state.perfects;

  if (state.mode === 'journey' && level) {
    const stars = starsFor(state, goals);
    if (completed(state, goals)) {
      const previous = store.journey[level] ?? 0;
      store.journey[level] = Math.max(previous, stars);
      // Keep which goals were met with the best result, so the level's detail does not show three stars and three
      // unchecked goals.
      if (stars >= previous) store.journeyGoals[level] = goals.map((goal) => goalMet(state, goal));
    }
  }
  if (state.mode === 'daily') {
    const date = state.level?.replace('daily-', '') ?? todayId();
    // One scored attempt a day: an attempt that misses the primary goal does not stamp, so it can be retried;
    // after the first completed attempt, practice never changes the stamp.
    if (!Object.hasOwn(store.dailyDates, date) && completed(state, goals)) {
      store.dailyDates[date] = starsFor(state, goals);
      store.dailyGoals = { date, met: goals.map((goal) => goalMet(state, goal)) };
    }
  }

  for (const id of earned({
    state,
    best: store.best,
    totalLines: store.stats.lines,
    totalPerfects: store.stats.perfects,
    journey: store.journey,
    dailyDates: Object.keys(store.dailyDates),
  })) {
    store.achievements.add(id);
  }
}

export function persist(): Promise<void> {
  const game = store.game && !store.game.over ? store.game : null;
  const parked: Partial<Record<ModeSlot, State>> = {};
  const parkedRuns: Partial<Record<ModeSlot, string>> = {};
  for (const slot of MODE_SLOTS) {
    const run = store.parked[slot];
    if (!isLive(run)) continue;
    parked[slot] = run;
    const id = store.parkedRuns[slot];
    if (id) parkedRuns[slot] = id;
  }
  const data: Saved = {
    v: 1,
    best: store.best,
    game,
    tutorialSeen: store.tutorialSeen,
    journey: store.journey,
    daily: { dates: store.dailyDates },
    stats: store.stats,
    achievements: [...store.achievements],
    settings: store.settings,
    parked,
    parkedRuns,
    journeyGoals: store.journeyGoals,
  };
  if (game && store.run) data.run = store.run;
  if (store.dailyGoals) data.dailyGoals = store.dailyGoals;
  if (store.pending.level || store.pending.daily) data.pending = store.pending;
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

export function newId(): string {
  return newRunId();
}
