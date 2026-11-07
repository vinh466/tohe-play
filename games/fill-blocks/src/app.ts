// What both stages share: the session, the words, the sounds and the player's save. The menu stage reads the save
// for its summaries and screens; the play stage plays from it and writes it back.
import { createSfx, formatScore, newRunId } from '@tohe/game-kit';
import { connect } from '@tohe/game-sdk';
import { earned } from './content/achievements.ts';
import { rankName } from './content/ranks.ts';
import { completed, type Goal, restore, type State, starsFor } from './logic.ts';
import { stringsFor, todayId } from './strings.ts';

export interface Stats {
  games: number;
  totalScore: number;
  lines: number;
  bestCombo: number;
  perfects: number;
}

export interface Settings {
  palette: 'paper' | 'contrast';
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
  pending?: { level?: string; daily?: string };
}

const DEFAULT_STATS: Stats = { games: 0, totalScore: 0, lines: 0, bestCombo: 0, perfects: 0 };
const DEFAULT_SETTINGS: Settings = { palette: 'paper', skin: 'paper', hints: true };

export const session = await connect<Saved>({ gameId: 'fill-blocks' });
export const t = stringsFor(session.locale);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
const resumed = restore(saved?.game);

const settings = (): Settings => {
  const value = saved?.settings;
  return {
    palette: value?.palette === 'contrast' ? 'contrast' : 'paper',
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
  pending: { level?: string; daily?: string };
} = {
  best: saved?.best ?? 0,
  game: resumed && !resumed.over ? resumed : null,
  tutorialSeen: saved?.tutorialSeen ?? false,
  run: (resumed && !resumed.over && saved?.run) || null,
  journey: { ...(saved?.journey ?? {}) },
  dailyDates: { ...(saved?.daily?.dates ?? {}) },
  stats: { ...DEFAULT_STATS, ...(saved?.stats ?? {}) },
  achievements: new Set(saved?.achievements ?? []),
  settings: settings(),
  pending: { ...(saved?.pending ?? {}) },
};

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
  store.stats.perfects += state.perfects;

  if (state.mode === 'journey' && level) {
    const stars = starsFor(state, goals);
    if (completed(state, goals)) {
      store.journey[level] = Math.max(store.journey[level] ?? 0, stars);
    }
  }
  if (state.mode === 'daily') {
    const date = state.level?.replace('daily-', '') ?? todayId();
    // One scored attempt a day: a attempt that misses the primary goal does not stamp, so it can be retried;
    // after the first completed attempt, practice never changes the stamp.
    if (!Object.hasOwn(store.dailyDates, date) && completed(state, goals)) {
      store.dailyDates[date] = starsFor(state, goals);
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
  };
  if (game && store.run) data.run = store.run;
  if (store.pending.level || store.pending.daily) data.pending = store.pending;
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

export function newId(): string {
  return newRunId();
}
