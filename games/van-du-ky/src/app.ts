// What the menu stage and the play stage both need: the hub session, the save in memory, the words and the sounds.
import { createSfx } from '@tohe/game-kit';
import { connect } from '@tohe/game-sdk';
import { migrate, type SaveData } from './core/save.ts';
import { stringsFor } from './strings.ts';

export const session = await connect<SaveData>({ gameId: 'van-du-ky' });
export const t = stringsFor(session.locale);
export const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

let save = migrate(session.saved);
const listeners = new Set<() => void>();

/** The save in memory; `set` writes to the hub in the background and tells the HUD. */
export const store = {
  get save(): SaveData {
    return save;
  },
  set(next: SaveData) {
    save = next;
    for (const listener of listeners) listener();
    void persist();
  },
  /** Called after every save change, so the HUD's coins, stage and badges follow. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export async function persist(): Promise<void> {
  try {
    await session.save(save);
  } catch (error) {
    session.log('warn', `save not stored: ${String(error)}`);
  }
}
