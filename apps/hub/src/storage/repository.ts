import type { JsonValue } from '@tohe/game-sdk';
import Dexie from 'dexie';
import { type LocalProfile, newId, type ToheDb } from './db.ts';

const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐧', '🐨', '🦁', '🐰'];

/** The local profile used in "Chơi thử" (guest) mode: one per device, saves stay on the device. */
export async function ensureGuestProfile(db: ToheDb): Promise<LocalProfile> {
  const existing = await db.profiles.toCollection().first();
  if (existing) return existing;
  const profile: LocalProfile = {
    id: newId(),
    name: 'Bạn nhỏ',
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? '🦊',
    createdAt: Date.now(),
  };
  await db.profiles.add(profile);
  return profile;
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

/**
 * Hands the guest's progress on this device to a real profile (offered once, the first time a profile is chosen).
 * Scores move over; a save moves only where the target profile has none, so nothing it already has is overwritten.
 */
export async function moveProgress(db: ToheDb, fromProfileId: string, toProfileId: string): Promise<void> {
  await db.transaction('rw', db.saves, db.scores, async () => {
    const saves = await db.saves
      .where('[profileId+gameId]')
      .between([fromProfileId, Dexie.minKey], [fromProfileId, Dexie.maxKey])
      .toArray();
    for (const save of saves) {
      if (!(await db.saves.get([toProfileId, save.gameId]))) {
        await db.saves.put({ ...save, profileId: toProfileId, synced: 0 });
      }
      await db.saves.delete([fromProfileId, save.gameId]);
    }
    await db.scores
      .where('[profileId+gameId]')
      .between([fromProfileId, Dexie.minKey], [fromProfileId, Dexie.maxKey])
      .modify({ profileId: toProfileId, synced: 0 });
  });
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
