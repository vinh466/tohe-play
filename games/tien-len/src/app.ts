// What both stages share (ADR 0020): the session, the words, the sounds, the table this phone is at (online) or the
// hand it replays, and the player's save. The menu stage (main.ts) reads and changes the table's settings; the play
// stage (stage.ts) plays from the save and writes it back.
import { createSfx } from '@tohe/game-kit';
import { connect, type RoomSession } from '@tohe/game-sdk';
import { isLevel, type Level } from './bots.ts';
import { rules } from './module.ts';
import { type Deck, isDeck } from './palette.ts';
import { DEFAULT_OPTIONS, normalizeOptions, type Options, restore, type State, type View } from './rules.ts';
import { stringsFor } from './strings.ts';

/** The player's seat against bots; the bots sit at the others. */
export const ME = 0;

export interface Saved {
  v: 1;
  /** The hand in progress, or the last one when it is over. */
  state: State | null;
  /** Points of each seat at this table (bảng điểm). */
  series: number[];
  /** Hands played at this table. */
  hands: number;
  seats: number;
  level: Level;
  options: Options;
  deck: Deck;
  sort: 'rank' | 'combos';
  tutorialSeen: boolean;
  /** The practice hand (suggestions on every turn) is done. */
  practiced: boolean;
  stats: { hands: number; places: number[] };
}

export const session = await connect<Saved>({ gameId: 'tien-len' });
export const t = stringsFor(session.locale);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

/** Online (ADR 0016): the table this phone sits at; null against bots. */
export const room = session.room as RoomSession<View> | null;
/** A finished online hand to replay (ADR 0016): set up and played back with this rules module. */
export const replay = session.replay;

const saved = session.saved;
const seats = saved?.seats && saved.seats >= 2 && saved.seats <= 4 ? saved.seats : 4;
const options = normalizeOptions(saved?.options ?? DEFAULT_OPTIONS);
const resumed = restore(saved?.state);
const state: State =
  resumed && resumed.seats === seats
    ? resumed
    : rules.setup({ seats, seed: session.seed, options, carry: null });

/** The save in memory: the menu stage changes the settings, the play stage the table. */
export const store = {
  seats,
  level: (isLevel(saved?.level) ? saved.level : 'normal') as Level,
  options,
  deck: (isDeck(saved?.deck) ? saved.deck : 'classic') as Deck,
  sort: (saved?.sort === 'combos' ? 'combos' : 'rank') as 'rank' | 'combos',
  tutorialSeen: saved?.tutorialSeen ?? false,
  practiced: saved?.practiced ?? false,
  stats: saved?.stats ?? { hands: 0, places: [0, 0, 0, 0] },
  state,
  series:
    Array.isArray(saved?.series) && saved.series.length === state.seats
      ? saved.series
      : state.hands.map(() => 0),
  hands: resumed ? (saved?.hands ?? 0) : 0,
  /** A hand is on this table (resumed, or dealt since): "Chơi tiếp" continues it. */
  dealt: Boolean(resumed && !resumed.over && resumed.seats === seats && resumed.moves > 0),
};

export function persist(): Promise<void> {
  const data: Saved = {
    v: 1,
    state: store.state,
    series: store.series,
    hands: store.hands,
    seats: store.seats,
    level: store.level,
    options: store.options,
    deck: store.deck,
    sort: store.sort,
    tutorialSeen: store.tutorialSeen,
    practiced: store.practiced,
    stats: store.stats,
  };
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}
