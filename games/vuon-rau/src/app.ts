// What both stages share (ADR 0020): the session, the words, the sounds and the player's farm. The menu stage (main.ts)
// reads the farm for its summary; the play stage (stage.ts) plays it and writes it back after every action.
import { createSfx } from '@tohe/game-kit';
import { connect } from '@tohe/game-sdk';
import { newGame, restore, type State } from './logic.ts';
import { stringsFor } from './strings.ts';

export interface Saved {
  /** The farm, as logic.ts keeps it; `v` inside says which version wrote it. */
  farm: State;
  /** The how-to was shown before the first game. */
  seenHowTo: boolean;
}

export const session = await connect<Saved>({ gameId: 'vuon-rau' });
export const t = stringsFor(session.locale);

export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;

/** The farm in memory: one farm, kept for good — there is no losing and no end. */
export const store: { farm: State; seenHowTo: boolean } = {
  farm: restore(saved?.farm) ?? newGame(),
  seenHowTo: saved?.seenHowTo ?? false,
};

/** Writes the save. */
export function persist(): Promise<void> {
  const data: Saved = { farm: store.farm, seenHowTo: store.seenHowTo };
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}
