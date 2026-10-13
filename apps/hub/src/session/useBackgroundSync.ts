import { useEffect } from 'react';
import { progress } from '../api/client.ts';
import { db } from '../storage/db.ts';
import { createSyncer } from '../storage/sync.ts';
import type { Player } from './session.ts';

/** The hub's one syncer (M2): saves and scores of the playing profile, to and from the API. */
export const syncer = createSyncer(db, progress);

/** Account profiles sync; guests keep everything on the device. */
export const syncsWithServer = (player: Player | null): player is Player =>
  player !== null && player.kind !== 'guest';

/** Syncs the playing profile when a screen opens and whenever the device comes back online. */
export function useBackgroundSync(player: Player | null) {
  const profileId = syncsWithServer(player) ? player.id : null;
  useEffect(() => {
    if (!profileId) return;
    const run = () => void syncer.syncNow(profileId).catch(() => {});
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [profileId]);
}
