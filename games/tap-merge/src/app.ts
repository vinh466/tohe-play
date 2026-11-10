// What both stages share: the session, the words, the sounds and the player's save. The menu stage reads the save
// for its summaries and screens; the play stage plays from it and writes it back.
//
// There are three active slots, one per door: a long classic run is never overwritten by trying a Journey level or
// today's Daily. The title resumes the last one played; the mode screens resume their own.
import { createSfx, formatScore, newRunId } from '@tohe/game-kit';
import { connect } from '@tohe/game-sdk';
import { BADGES, earnedBadges } from './content/album.ts';
import { completedLevels, dailyStars, LEVEL_BY_ID, levelComplete, levelStars } from './content/levels.ts';
import { monthOf, todayId } from './date.ts';
import { dailyDateOf, type GameEvent, type Mode, restore, type State } from './logic.ts';
import { DEFAULT_PALETTE, isPalette, type PaletteId } from './palette.ts';
import { stringsFor } from './strings.ts';

export interface Stats {
  classicRuns: number;
  maxAbsorbed: number;
  noShuffleLevels: number;
}

interface SavedAlbum {
  seen?: number[];
  firstSeen?: Record<string, string>;
  counts?: Record<string, number>;
}

interface SavedJourney {
  stars?: Record<string, number>;
  game?: State | null;
}

interface SavedDaily {
  dates?: Record<string, number>;
  game?: State | null;
}

export interface Saved {
  v?: number;
  best: number;
  /** The classic run; the old save's only game. */
  game: State | null;
  tutorialSeen: boolean;
  /** The classic leaderboard run id. */
  run?: string;
  palette?: PaletteId;
  journey?: SavedJourney;
  daily?: SavedDaily;
  album?: SavedAlbum;
  stats?: Partial<Stats>;
  achievements?: string[];
  /** The last door played, so the title's one primary button resumes it. */
  lastMode?: Mode;
  /** A level or daily a screen asked the stage to start on the next play. */
  pending?: { level?: string; daily?: string };
}

const DEFAULT_STATS: Stats = { classicRuns: 0, maxAbsorbed: 0, noShuffleLevels: 0 };

export const session = await connect<Saved>({ gameId: 'tap-merge' });
export const t = stringsFor(session.locale);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
const classicRestored = restore(saved?.game);
const journeyRestored = restore(saved?.journey?.game);
const dailyRestored = restore(saved?.daily?.game);
const isMode = (mode: unknown): mode is Mode => mode === 'classic' || mode === 'journey' || mode === 'daily';

const active = (value: State | null, mode: Mode): State | null =>
  value && !value.over && value.mode === mode ? value : null;

const classicGame = active(classicRestored, 'classic');
const journeyGame = active(journeyRestored, 'journey');
const dailyGame = active(dailyRestored, 'daily');
const lastMode: Mode = isMode(saved?.lastMode) ? saved.lastMode : 'classic';

/** The save in memory. Each door has its own active slot; the next game continues its random sequence. */
export const store: {
  best: number;
  classicGame: State | null;
  journeyGame: State | null;
  dailyGame: State | null;
  tutorialSeen: boolean;
  run: string | null;
  palette: PaletteId;
  journey: Record<string, number>;
  dailyDates: Record<string, number>;
  album: { seen: Set<number>; firstSeen: Record<string, string>; counts: Record<string, number> };
  stats: Stats;
  achievements: Set<string>;
  lastMode: Mode;
  pending: { level?: string; daily?: string };
} = {
  best: saved?.best ?? 0,
  classicGame,
  journeyGame,
  dailyGame,
  tutorialSeen: saved?.tutorialSeen ?? false,
  run: classicGame ? (saved?.run ?? null) : null,
  palette: isPalette(saved?.palette) ? saved.palette : DEFAULT_PALETTE,
  journey: { ...(saved?.journey?.stars ?? {}) },
  dailyDates: { ...(saved?.daily?.dates ?? {}) },
  album: {
    seen: new Set((saved?.album?.seen ?? []).filter((exp) => Number.isInteger(exp) && exp >= 1 && exp <= 20)),
    firstSeen: { ...(saved?.album?.firstSeen ?? {}) },
    counts: { ...(saved?.album?.counts ?? {}) },
  },
  stats: { ...DEFAULT_STATS, ...(saved?.stats ?? {}) },
  achievements: new Set(saved?.achievements ?? []),
  lastMode,
  pending: { ...(saved?.pending ?? {}) },
};

/** The active game of a door, if any. A Daily left open yesterday is not today's Daily. */
export function gameFor(mode: Mode, state = store): State | null {
  const game =
    mode === 'classic' ? state.classicGame : mode === 'journey' ? state.journeyGame : state.dailyGame;
  if (mode === 'daily' && game && dailyDateOf(game.level) !== todayId()) return null;
  return game && !game.over ? game : null;
}

/** The door the title's primary button resumes: the last one played, else the first with a saved run. */
export function activeMode(): Mode | null {
  if (gameFor(store.lastMode)) return store.lastMode;
  for (const mode of ['classic', 'journey', 'daily'] as const) if (gameFor(mode)) return mode;
  return null;
}

/** A new classic seed: not the hub's daily seed, and different from the last board. */
export function nextSeed(): number {
  const base = store.classicGame?.rng ?? store.journeyGame?.rng ?? store.dailyGame?.rng ?? session.seed;
  return (base ^ Math.imul(store.stats.classicRuns + 1, 0x9e3779b1)) >>> 0;
}

export const journeyStars = (): number => Object.values(store.journey).reduce((sum, stars) => sum + stars, 0);

export const albumCount = (): number => store.album.seen.size;

export const progressLine = (): string | null => {
  const stars = journeyStars();
  const cards = albumCount();
  if (stars === 0 && cards <= 3) return null;
  return `${t.journeyProgress(stars)} · ${t.albumProgress(cards)}`;
};

/** The label of a Journey level in the title and the result card. */
export function levelLabel(id: string): string {
  const level = LEVEL_BY_ID.get(id);
  if (!level) return id;
  return t.levelLabel(level.chapter, level.index);
}

export const scoreText = (value: number): string => formatScore(value, session.locale);

export const runFor = (runId: string) => session.run(runId);

/** A classic run starts: count it even when the player leaves before the end. */
export function startClassic(): void {
  store.stats.classicRuns += 1;
}

/** Record the block values a game has just shown, and count a merge that made one. Returns the newly seen values. */
export function noteSeen(state: State, events: readonly GameEvent[] = []): number[] {
  const date = todayId();
  const fresh: number[] = [];
  const note = (exp: number) => {
    if (exp < 1 || exp > 20) return;
    if (!store.album.seen.has(exp)) {
      store.album.seen.add(exp);
      store.album.firstSeen[String(exp)] = date;
      store.album.counts[String(exp)] = Math.max(1, store.album.counts[String(exp)] ?? 0);
      fresh.push(exp);
    }
  };
  for (const exp of state.grid) note(exp);
  for (const event of events) {
    if (event.type !== 'merge') continue;
    note(event.exp);
    store.album.counts[String(event.exp)] = (store.album.counts[String(event.exp)] ?? 0) + 1;
  }
  return fresh;
}

/** The badge context of the moment; the album and stats are the shared long-term progression. */
const badgeContext = (state: State) => ({
  best: store.best,
  classicRuns: store.stats.classicRuns,
  maxAbsorbed: store.stats.maxAbsorbed,
  noShuffleLevels: store.stats.noShuffleLevels,
  journey: store.journey,
  dailyDates: store.dailyDates,
  album: store.album.seen,
  month: monthOf(dailyDateOf(state.level) ?? todayId()),
});

/** Adds any badge now earned; returns the new ids for the result card. */
export function evaluateBadges(state: State): string[] {
  const fresh: string[] = [];
  for (const id of earnedBadges(badgeContext(state))) {
    if (store.achievements.has(id)) continue;
    store.achievements.add(id);
    fresh.push(id);
  }
  return fresh;
}

/** A finished run: its best, its Journey stars or Daily stamp, and any badge it earned. */
export function finishGame(state: State): string[] {
  if (state.mode === 'classic') {
    store.best = Math.max(store.best, state.score);
  }
  if (state.mode === 'journey' && state.level) {
    const level = LEVEL_BY_ID.get(state.level);
    if (level && levelComplete(state, level)) {
      const stars = levelStars(state, level);
      store.journey[level.id] = Math.max(store.journey[level.id] ?? 0, stars);
      if (state.shufflesUsed === 0) store.stats.noShuffleLevels += 1;
    }
  }
  if (state.mode === 'daily') {
    const date = dailyDateOf(state.level) ?? todayId();
    const stars = dailyStars(state.top);
    if (stars > 0) store.dailyDates[date] = Math.max(store.dailyDates[date] ?? 0, stars);
    // The calendar needs a month and the badges need the month's count; keep four hundred days so the save stays small.
    const dates = Object.keys(store.dailyDates).sort();
    if (dates.length > 400)
      for (const old of dates.slice(0, dates.length - 400)) delete store.dailyDates[old];
  }
  return evaluateBadges(state);
}

/** The new cards a result card should celebrate: the caller passes the fresh values from `noteSeen`. */
export const newCards = (values: readonly number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

/** Badge words for a result card, in the order they were earned. */
export const badgeTitle = (id: string): string => {
  const badge = BADGES.find((item) => item.id === id);
  return badge ? (session.locale.startsWith('vi') ? badge.vi.title : badge.en.title) : id;
};

/** Writes the save. A finished game is not kept in its door; the other doors keep theirs. */
export function persist(): Promise<void> {
  const data: Saved = {
    v: 1,
    best: store.best,
    game: store.classicGame && !store.classicGame.over ? store.classicGame : null,
    tutorialSeen: store.tutorialSeen,
    palette: store.palette,
    journey: {
      stars: store.journey,
      game: store.journeyGame && !store.journeyGame.over ? store.journeyGame : null,
    },
    daily: {
      dates: store.dailyDates,
      game:
        store.dailyGame && !store.dailyGame.over && dailyDateOf(store.dailyGame.level) === todayId()
          ? store.dailyGame
          : null,
    },
    album: {
      seen: [...store.album.seen].sort((a, b) => a - b),
      firstSeen: store.album.firstSeen,
      counts: store.album.counts,
    },
    stats: store.stats,
    achievements: [...store.achievements],
    lastMode: store.lastMode,
  };
  if (store.classicGame && store.run) data.run = store.run;
  if (store.pending.level || store.pending.daily) data.pending = store.pending;
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

export const newId = (): string => newRunId();

/** Kept for the strings and screens that ask how many levels are done. */
export const levelsDone = (): number => completedLevels(store.journey);
