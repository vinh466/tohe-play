import type { JsonValue } from '@tohe/game-sdk';
import Dexie from 'dexie';
import { type LocalRanked, newId, type ToheDb } from './db.ts';

/** A ranked run the game handed in (ADR 0030): it waits on the device until sync takes it to the API. */
export async function recordRanked(
  db: ToheDb,
  entry: Pick<LocalRanked, 'profileId' | 'gameId' | 'run' | 'moves' | 'score'>,
): Promise<void> {
  await db.ranked.add({ ...entry, at: Date.now(), synced: 0 });
}

export async function loadSave(db: ToheDb, profileId: string, gameId: string): Promise<JsonValue | null> {
  return (await db.saves.get([profileId, gameId]))?.data ?? null;
}

export async function storeSave(
  db: ToheDb,
  profileId: string,
  gameId: string,
  data: JsonValue,
): Promise<void> {
  await db.saves.put({ profileId, gameId, data, updatedAt: Date.now(), synced: 0 });
}

/**
 * Records a score. A long run's reports (same `run`) update one row with the highest score, and once final it stays
 * final (ADR 0014); any change makes the row pending again for sync.
 */
export async function recordScore(
  db: ToheDb,
  entry: { profileId: string; gameId: string; board: string; value: number; run?: string; final?: boolean },
): Promise<void> {
  const { run, final = true, ...score } = entry;
  await db.transaction('rw', db.scores, async () => {
    const current = run
      ? await db.scores
          .where('[profileId+gameId]')
          .equals([score.profileId, score.gameId])
          .filter((s) => s.run === run)
          .first()
      : undefined;
    if (current?.id === undefined) {
      await db.scores.add({ ...score, run, final, at: Date.now(), synced: 0, clientId: newId() });
      return;
    }
    const wasFinal = current.final ?? true;
    if (score.value <= current.value && (wasFinal || !final)) return; // nothing new
    await db.scores.update(current.id, {
      value: Math.max(current.value, score.value),
      at: score.value > current.value ? Date.now() : current.at,
      final: wasFinal || final,
      synced: 0,
    });
  });
}

/** Whether a profile has played anything on this device. */
export async function hasProgress(db: ToheDb, profileId: string): Promise<boolean> {
  return (
    (await db.saves
      .where('[profileId+gameId]')
      .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
      .count()) > 0 ||
    (await db.scores
      .where('[profileId+gameId]')
      .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
      .count()) > 0
  );
}

export async function bestScore(db: ToheDb, profileId: string, gameId: string): Promise<number | null> {
  const scores = await db.scores.where('[profileId+gameId]').equals([profileId, gameId]).toArray();
  return scores.length === 0 ? null : Math.max(...scores.map((s) => s.value));
}

/** Network first, falling back to the last good copy so the hub still opens offline. */
export async function withOfflineCache<T>(db: ToheDb, key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const value = await fetcher();
    await db.cache.put({ key, value, at: Date.now() });
    return value;
  } catch (error) {
    const cached = await db.cache.get(key);
    if (cached) return cached.value as T;
    throw error;
  }
}
