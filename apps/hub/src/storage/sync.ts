// Background sync of saves and scores (M2, ADR 0005). Every write lands on the device first; this pushes what is
// pending and pulls what other devices wrote, for the profile active in the session (the API only accepts that
// one). A pending local save always wins: it reaches the server later, and the server keeps the version it
// replaces. Guests never sync.
import type { JsonValue } from '@tohe/game-sdk';
import type { ToheDb } from './db.ts';

/** The API calls sync needs; injected so the logic is testable without a server. */
export interface ProgressApi {
  listSaves(): Promise<{ gameId: string; data: unknown; updatedAt: string }[]>;
  putSave(gameId: string, data: JsonValue): Promise<{ updatedAt: string }>;
  recordScores(
    scores: {
      clientId: string;
      gameId: string;
      board: string;
      value: number;
      achievedAt: string;
      final: boolean;
    }[],
  ): Promise<unknown>;
}

const SCORE_BATCH = 100;

/** Pushes the profile's pending saves and scores, then pulls saves made on other devices. */
export async function syncProfile(db: ToheDb, api: ProgressApi, profileId: string): Promise<void> {
  await pushSaves(db, api, profileId);
  await pushScores(db, api, profileId);
  await pullSaves(db, api, profileId);
}

async function pushSaves(db: ToheDb, api: ProgressApi, profileId: string) {
  const pending = await db.saves
    .where('synced')
    .equals(0)
    .filter((save) => save.profileId === profileId)
    .toArray();
  for (const save of pending) {
    const { updatedAt } = await api.putSave(save.gameId, save.data);
    // Mark it synced only if the game did not save again while the request was in flight.
    await db.saves
      .where('[profileId+gameId]')
      .equals([profileId, save.gameId])
      .and((current) => current.updatedAt === save.updatedAt)
      .modify({ synced: 1, serverUpdatedAt: Date.parse(updatedAt) });
  }
}

async function pushScores(db: ToheDb, api: ProgressApi, profileId: string) {
  const pending = await db.scores
    .where('synced')
    .equals(0)
    .filter((score) => score.profileId === profileId)
    .toArray();
  for (let i = 0; i < pending.length; i += SCORE_BATCH) {
    const batch = pending.slice(i, i + SCORE_BATCH);
    await api.recordScores(
      batch.map(({ clientId, gameId, board, value, at, final }) => ({
        clientId,
        gameId,
        board,
        value,
        achievedAt: new Date(at).toISOString(),
        final: final ?? true,
      })),
    );
    // A run may have reported a higher score while the request was in flight: only what was sent is synced.
    for (const sent of batch) {
      await db.scores
        .where('id')
        .equals(sent.id ?? -1)
        .and((current) => current.value === sent.value && current.final === sent.final)
        .modify({ synced: 1 });
    }
  }
}

async function pullSaves(db: ToheDb, api: ProgressApi, profileId: string) {
  for (const remote of await api.listSaves()) {
    const at = Date.parse(remote.updatedAt);
    await db.transaction('rw', db.saves, async () => {
      const local = await db.saves.get([profileId, remote.gameId]);
      if (local?.synced === 0) return; // newer here; it wins when it is pushed
      if (local && (local.serverUpdatedAt ?? 0) >= at) return; // already have it
      await db.saves.put({
        profileId,
        gameId: remote.gameId,
        data: remote.data as JsonValue,
        updatedAt: at,
        serverUpdatedAt: at,
        synced: 1,
      });
    });
  }
}

/**
 * One sync at a time; a request while one runs schedules exactly one more. `syncSoon` waits a moment so a burst of
 * saves (one per move) becomes one round trip.
 */
export function createSyncer(db: ToheDb, api: ProgressApi, delayMs = 1500) {
  let running: Promise<void> | null = null;
  let again: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const syncNow = (profileId: string): Promise<void> => {
    if (running) {
      again = profileId;
      return running;
    }
    running = syncProfile(db, api, profileId).finally(() => {
      running = null;
      const next = again;
      again = null;
      if (next) void syncNow(next).catch(() => {});
    });
    return running;
  };

  return {
    syncNow,
    syncSoon(profileId: string) {
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(profileId).catch(() => {}), delayMs);
    },
  };
}
