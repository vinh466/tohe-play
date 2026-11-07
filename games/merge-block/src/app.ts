// What both stages share (ADR 0020): the session, the words, the sounds and the player's save. The menu stage
// (main.ts) reads the save for its summary and settings; the play stage (stage.ts) plays from it and writes it back.
// 3.0.0 adds the modes: the classic game, the Ca làm run, the Ca hôm nay daily and the Workshop's light meta.
import { createSfx, formatScore } from '@tohe/game-kit';
import { connect, type RankedRun } from '@tohe/game-sdk';
import { type ChallengeSlot, challengePayload, dailyPayload, restoreChallenge } from './challenge.ts';
import { type Mode, newGame, PART_IDS, type PartId, restore, type State } from './logic.ts';
import { DEFAULT_PALETTE, isPalette, type PaletteId } from './palette.ts';
import { stringsFor } from './strings.ts';

/** The Workshop's light meta, per profile. */
export interface WorkshopSave {
  scrap: number;
  xp: number;
  /** The parts the Ca làm can offer. */
  blueprints: PartId[];
}

/** Today's daily run, its streak and the best of the day. */
export interface DailySave {
  date: string;
  seed: number;
  game: State | null;
  score: number;
  best: number;
  streak: number;
  lastDay: string | null;
}

export interface Saved {
  best: number;
  /** The bests of the other modes; the classic stays `best`. */
  bests?: { orders?: number; daily?: number };
  /** The classic game in progress, resumed when the game opens again. */
  game: State | null;
  /** The Ca làm run in progress. */
  orders?: State | null;
  tutorialSeen: boolean;
  /** The id the classic game in progress reports its score under on the household leaderboard (ADR 0014). */
  run?: string;
  /** The player's block colours (SPEC.md, "Block colours"); absent in saves from before 1.5.0. */
  palette?: PaletteId;
  /** The classic game in progress is a ranked run (ADR 0030): kept here, so it continues on any device. */
  ranked?: RankedProgress;
  /** The last challenge opened by a link ("Thách bạn", ADR 0045), beside the regular game. */
  challenge?: ChallengeSlot;
  /** The Workshop: scrap, XP and the unlocked blueprints. */
  workshop?: WorkshopSave;
  /** Today's daily run and the streak. */
  daily?: DailySave;
  /** The run the title screen's Chơi tiếp resumes: the last mode played. */
  last?: Mode;
}

/** A ranked run as it goes: the run the server opened, its seed, and every column fired so far. */
export interface RankedProgress {
  run: string;
  seed: number;
  moves: number[];
}

const isRanked = (value: unknown): value is RankedProgress => {
  const ranked = value as Partial<RankedProgress> | null | undefined;
  return (
    typeof ranked?.run === 'string' &&
    Number.isInteger(ranked.seed) &&
    Array.isArray(ranked.moves) &&
    ranked.moves.every((col) => Number.isInteger(col))
  );
};

const isWorkshop = (value: unknown): value is WorkshopSave => {
  const workshop = value as Partial<WorkshopSave> | null | undefined;
  return (
    Number.isInteger(workshop?.scrap) &&
    (workshop?.scrap as number) >= 0 &&
    Number.isInteger(workshop?.xp) &&
    (workshop?.xp as number) >= 0 &&
    Array.isArray(workshop?.blueprints) &&
    workshop.blueprints.every((part) => PART_IDS.includes(part as PartId))
  );
};

const isDaily = (value: unknown): value is DailySave => {
  const daily = value as Partial<DailySave> | null | undefined;
  return (
    typeof daily?.date === 'string' &&
    daily.date.length > 0 &&
    Number.isInteger(daily?.seed) &&
    Number.isInteger(daily?.score) &&
    (daily?.score as number) >= 0 &&
    Number.isInteger(daily?.best) &&
    (daily?.best as number) >= 0 &&
    Number.isInteger(daily?.streak) &&
    (daily?.streak as number) >= 0 &&
    (daily?.lastDay === null || typeof daily?.lastDay === 'string') &&
    (daily?.game === null || daily?.game === undefined || restore(daily.game) !== null)
  );
};

export const session = await connect<Saved>({ gameId: 'merge-block' });
export const t = stringsFor(session.locale);

/** A ranked run to watch (ADR 0032): replay.ts plays it back instead of a game, and nothing is saved or scored. */
export const rankedReplay = session.rankedReplay;

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
const resumed = restore(saved?.game);
const ordersResumed = restore(saved?.orders);
const dailySaved = isDaily(saved?.daily) ? saved.daily : null;

/** The save in memory. `game`/`orders` are the last runs, finished or not. */
export const store: {
  best: number;
  bests: { orders: number; daily: number };
  game: State | null;
  orders: State | null;
  tutorialSeen: boolean;
  run: string | null;
  palette: PaletteId;
  ranked: RankedProgress | null;
  challenge: ChallengeSlot | null;
  workshop: WorkshopSave;
  daily: DailySave | null;
  last: Mode;
} = {
  best: saved?.best ?? 0,
  bests: {
    orders: saved?.bests?.orders ?? 0,
    daily: saved?.bests?.daily ?? 0,
  },
  game: resumed && !resumed.over ? resumed : null,
  orders: ordersResumed && !ordersResumed.over ? ordersResumed : null,
  tutorialSeen: saved?.tutorialSeen ?? false,
  run: (resumed && !resumed.over && saved?.run) || null,
  palette: isPalette(saved?.palette) ? saved.palette : DEFAULT_PALETTE,
  ranked: resumed && !resumed.over && isRanked(saved?.ranked) ? saved.ranked : null,
  challenge: restoreChallenge(saved?.challenge),
  workshop: isWorkshop(saved?.workshop) ? saved.workshop : { scrap: 0, xp: 0, blueprints: ['tank', 'chute'] },
  daily: dailySaved,
  last: saved?.last ?? 'classic',
};

/** How long a new game waits for a ranked run before it starts unranked. */
const RANKED_WAIT_MS = 2500;

/** A ranked run for a new classic game, or null — offline, a guest, standalone, or no answer in time. */
export function startRanked(): Promise<RankedRun | null> {
  return Promise.race([
    session.ranked.start(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), RANKED_WAIT_MS)),
  ]);
}

/** Hands the ranked run of the game in progress in, with the score it reached (ADR 0030); none is kept after. */
export function finishRanked(score: number) {
  const ranked = store.ranked;
  store.ranked = null;
  if (!ranked) return;
  void session.ranked
    .finish(ranked.run, ranked.moves, score)
    .catch((error) => session.log('warn', `ranked run not handed in: ${String(error)}`));
}

/** Writes the save; a finished run is not kept. */
export function persist(): Promise<void> {
  const game = store.game && !store.game.over ? store.game : null;
  const orders = store.orders && !store.orders.over ? store.orders : null;
  const daily = store.daily
    ? {
        ...store.daily,
        game: store.daily.game && !store.daily.game.over ? store.daily.game : null,
      }
    : null;
  const data: Saved = {
    best: Math.max(store.best, store.game?.best ?? 0),
    bests: store.bests,
    game,
    orders,
    tutorialSeen: store.tutorialSeen,
    palette: store.palette,
    workshop: store.workshop,
    last: store.last,
  };
  if (daily) data.daily = daily;
  if (game && store.run) data.run = store.run;
  if (game && store.ranked) data.ranked = store.ranked;
  if (store.challenge) {
    const played = store.challenge.game;
    data.challenge = { ...store.challenge, game: played && !played.over ? played : null };
  }
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

// ------------------------------------------------------------------ the daily

/** The local calendar day as YYYY-MM-DD (the game's own clock; the logic stays pure). */
export function localDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A stable 32-bit seed from the local date. */
export function dailySeed(date: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) hash = Math.imul(hash ^ date.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/** The previous local day of a YYYY-MM-DD date. */
function previousDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const previous = new Date(year, month - 1, day - 1);
  return localDate(previous);
}

/**
 * Today's daily run: the same run while it is today and still going, otherwise a fresh one from the date seed,
 * with the streak kept when yesterday was played.
 */
export function openDaily(date = localDate()): DailySave {
  if (store.daily && store.daily.date === date) return store.daily;
  const best = store.bests.daily;
  const previous = store.daily?.lastDay ?? null;
  const streak = previous === previousDay(date) ? (store.daily?.streak ?? 0) + 1 : 1;
  session.telemetry.metric('daily.streak', streak);
  store.daily = {
    date,
    seed: dailySeed(date),
    game: newGame(dailySeed(date), best, 'daily', { dailyDate: date }),
    score: 0,
    best,
    streak,
    lastDay: date,
  };
  return store.daily;
}

/** Banks a daily run's score and best. */
export function recordDaily(state: State): void {
  const daily = store.daily;
  if (!daily || daily.date !== state.daily?.date) return;
  daily.score = Math.max(daily.score, state.score);
  daily.best = Math.max(daily.best, state.score);
  store.bests.daily = Math.max(store.bests.daily, state.score);
  daily.game = state.over ? null : state;
}

// ------------------------------------------------------------------ the workshop

/** The six machine ranks, by XP. */
export const MACHINE_LEVELS = [0, 40, 120, 280, 560, 1000] as const;

export function levelFor(xp: number): number {
  let level = 0;
  for (let i = 0; i < MACHINE_LEVELS.length; i++) if (xp >= (MACHINE_LEVELS[i] ?? 0)) level = i;
  return level;
}

/** The scrap a blueprint costs; the first two are free. */
export function blueprintCost(part: PartId): number {
  if (part === 'tank' || part === 'chute') return 0;
  return part === 'lube' ? 30 : 60;
}

/** Buys a blueprint when the scrap suffices; returns whether it happened. */
export function buyBlueprint(part: PartId): boolean {
  if (store.workshop.blueprints.includes(part)) return false;
  const cost = blueprintCost(part);
  if (store.workshop.scrap < cost) return false;
  store.workshop.scrap -= cost;
  store.workshop.blueprints = [...store.workshop.blueprints, part];
  session.telemetry.count(`part.buy.${part}`);
  sfx.play('levelUp');
  void persist();
  return true;
}

/** Banks a finished run into the workshop and the mode's best. */
export function bankRun(state: State): void {
  store.workshop.scrap += state.scrap ?? 0;
  store.workshop.xp += state.xp ?? 0;
  if (state.mode === 'classic') store.best = Math.max(store.best, state.best);
  if (state.mode === 'orders') store.bests.orders = Math.max(store.bests.orders, state.best);
  if (state.mode === 'daily') recordDaily(state);
}

// ------------------------------------------------------------------ the shares

/**
 * "Thách bạn" (ADR 0045): asks the hub to share a challenge on `seed` claiming `score` — its sheet; the link is made only
 * if the player sends or copies it. Any answer is fine: cancelled, busy or offline leaves the card as it was.
 */
export function shareChallenge(seed: number, score: number): void {
  void session
    .share({
      payload: challengePayload(seed, score),
      text: t.challenge.text(formatScore(score, session.locale)),
      level: 'any',
    })
    .then(() => session.telemetry.count('challenge.share'))
    .catch((error) => session.log('info', `challenge not shared: ${String(error)}`));
}

/** The daily's share: the same seed and the sender's local date, a claim like the challenge's. */
export function shareDaily(seed: number, score: number, date: string): void {
  void session
    .share({
      payload: dailyPayload(seed, score, date),
      text: t.daily.shareText(formatScore(score, session.locale)),
      level: 'any',
    })
    .then(() => session.telemetry.count('daily.share'))
    .catch((error) => session.log('info', `daily not shared: ${String(error)}`));
}
