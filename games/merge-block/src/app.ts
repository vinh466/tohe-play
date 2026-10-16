// What both stages share (ADR 0020): the session, the words, the sounds and the player's save. The menu stage
// (main.ts) reads the save for its summary and settings; the play stage (stage.ts) plays from it and writes it back.
import { createSfx } from '@tohe/game-kit';
import { connect } from '@tohe/game-sdk';
import { restore, type State } from './logic.ts';
import { DEFAULT_PALETTE, isPalette, type PaletteId } from './palette.ts';
import { stringsFor } from './strings.ts';

export interface Saved {
  best: number;
  /** The game in progress, resumed when the game opens again. */
  game: State | null;
  tutorialSeen: boolean;
  /** The id the game in progress reports its score under on the household leaderboard (ADR 0014). */
  run?: string;
  /** The player's block colours (SPEC.md, "Block colours"); absent in saves from before 1.5.0. */
  palette?: PaletteId;
}

export const session = await connect<Saved>({ gameId: 'merge-block' });
export const t = stringsFor(session.locale);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
const resumed = restore(saved?.game);

/** The save in memory. `game` is the last game, finished or not: the next one continues its random sequence. */
export const store: {
  best: number;
  game: State | null;
  tutorialSeen: boolean;
  run: string | null;
  palette: PaletteId;
} = {
  best: saved?.best ?? 0,
  game: resumed && !resumed.over ? resumed : null,
  tutorialSeen: saved?.tutorialSeen ?? false,
  run: (resumed && !resumed.over && saved?.run) || null,
  palette: isPalette(saved?.palette) ? saved.palette : DEFAULT_PALETTE,
};

/** Writes the save; a finished game is not kept (the next opening starts a fresh one). */
export function persist(): Promise<void> {
  const game = store.game && !store.game.over ? store.game : null;
  const data: Saved = {
    best: Math.max(store.best, store.game?.best ?? 0),
    game,
    tutorialSeen: store.tutorialSeen,
    palette: store.palette,
  };
  // JSON has no undefined: the run id is only there with a game in progress.
  if (game && store.run) data.run = store.run;
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}
