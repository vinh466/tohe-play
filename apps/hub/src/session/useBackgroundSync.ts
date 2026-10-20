import { useEffect } from 'react';
import { ApiError, progress, runs } from '../api/client.ts';
import { db } from '../storage/db.ts';
import { createSyncer, type ProgressApi } from '../storage/sync.ts';
import { telemetry } from '../telemetry/telemetry.ts';
import type { Player } from './session.ts';

/**
 * A failed sync request, counted for telemetry (ADR 0015) by kind: `http-4xx`, `http-5xx` or `network`. Being offline
 * is normal for a local-first hub, so failures then are not counted.
 */
function counted<T>(request: Promise<T>): Promise<T> {
  return request.catch((error: unknown) => {
    if (navigator.onLine) {
      const kind = error instanceof ApiError ? `http-${Math.floor(error.status / 100)}xx` : 'network';
      telemetry.count(`hub.sync.failed.${kind}`);
    }
    throw error;
  });
}

const trackedProgress: ProgressApi = {
  listSaves: () => counted(progress.listSaves()),
  putSave: (gameId, data) => counted(progress.putSave(gameId, data)),
  recordScores: (scores) => counted(progress.recordScores(scores)),
  finishRun: (run, moves, score) =>
    counted(runs.finish(run, moves, score)).then(
      () => 'taken' as const,
      (error: unknown) => {
        // The API will never take it (closed by a newer run, not this profile's, too many moves): drop it.
        if (error instanceof ApiError && [400, 404, 409].includes(error.status)) return 'refused' as const;
        throw error;
      },
    ),
};

/** The hub's one syncer (M2): saves and scores of the playing profile, to and from the API. */
export const syncer = createSyncer(db, trackedProgress);

/** Account profiles sync; device profiles keep everything on the device (ADR 0043). */
export const syncsWithServer = (player: Player | null): player is Player =>
  player !== null && player.kind !== 'device';

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
