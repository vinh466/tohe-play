import type { JsonValue } from '@tohe/game-sdk';
import type { LocalProfile, ToheDb } from './db.ts';

const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐧', '🐨', '🦁', '🐰'];

/** crypto.randomUUID only exists in secure contexts; a phone testing over plain http on the LAN is not one. */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Until accounts exist (milestone M1) every device has one local guest profile. */
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

export async function recordScore(
  db: ToheDb,
  entry: { profileId: string; gameId: string; board: string; value: number },
): Promise<void> {
  await db.scores.add({ ...entry, at: Date.now(), synced: 0 });
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
