// Device profiles (ADR 0043, step I1): "Hồ sơ trên máy này" — up to five per device, each a name, an avatar, saves and
// scores in IndexedDB, nothing on the server until one is brought into an account. The `profiles` table holds them; the
// guest of earlier versions is the first one (db.ts, version 4). docs/architecture/identity.md#device-profiles
import Dexie from 'dexie';
import type { DeviceProfileData } from '../api/client.ts';
import { type LocalProfile, type LocalScore, newId, type ToheDb } from './db.ts';

/** A device holds at most this many device profiles (ADR 0043). */
export const MAX_DEVICE_PROFILES = 5;

/** The avatars a profile may have: the API's `ProfileOptions.Avatars`, mirrored so a new device needs no request. */
export const AVATARS = [
  '🦊',
  '🐼',
  '🐯',
  '🐸',
  '🐧',
  '🐨',
  '🦁',
  '🐰',
  '🐱',
  '🐶',
  '🦄',
  '🐙',
  '🐢',
  '🦖',
  '🐝',
  '🦉',
] as const;

/** What one request bringing a device profile in may carry (the API's `DeviceProfiles.MaxSaves`, `MaxScores`). */
export const MAX_UPLOAD_SAVES = 50;
export const MAX_UPLOAD_SCORES = 1000;

const CURRENT = 'tohe:device-profile';

export const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? '🦊';

/** Which device profile plays on this device, remembered across visits. */
export const currentDeviceProfile = {
  get: (): string | null => localStorage.getItem(CURRENT),
  set: (id: string) => localStorage.setItem(CURRENT, id),
  clear: () => localStorage.removeItem(CURRENT),
};

/** The device's profiles, oldest first. */
export function listDeviceProfiles(db: ToheDb): Promise<LocalProfile[]> {
  return db.profiles.orderBy('createdAt').toArray();
}

/**
 * The device profile that plays: the one chosen last, else the oldest — or a new one, made silently with the name
 * given (the `any` level of ADR 0043). `made` says the device had none before.
 */
export async function ensureDeviceProfile(
  db: ToheDb,
  suggestName: () => string,
): Promise<{ profile: LocalProfile; made: boolean }> {
  const chosen = currentDeviceProfile.get();
  const current = chosen ? await db.profiles.get(chosen) : undefined;
  if (current) return { profile: current, made: false };
  const oldest = await db.profiles.orderBy('createdAt').first();
  if (oldest) {
    currentDeviceProfile.set(oldest.id);
    return { profile: oldest, made: false };
  }
  const profile = await createDeviceProfile(db, { name: suggestName(), avatar: randomAvatar() });
  return { profile, made: true };
}

export class TooManyDeviceProfiles extends Error {
  constructor() {
    super(`A device holds at most ${MAX_DEVICE_PROFILES} device profiles`);
  }
}

/** A new device profile, which plays from now on. Refused past five. */
/** `chosen`: the player named it (the profile picker), rather than the hub making it silently. */
export async function createDeviceProfile(
  db: ToheDb,
  { name, avatar, chosen = false }: { name: string; avatar: string; chosen?: boolean },
): Promise<LocalProfile> {
  const profile: LocalProfile = {
    id: newId(),
    name,
    avatar,
    createdAt: Date.now(),
    ...(chosen ? { chosen } : {}),
  };
  await db.transaction('rw', db.profiles, async () => {
    if ((await db.profiles.count()) >= MAX_DEVICE_PROFILES) throw new TooManyDeviceProfiles();
    await db.profiles.add(profile);
  });
  currentDeviceProfile.set(profile.id);
  return profile;
}

/** A new name or avatar: the player chose it, so a sign-up asks about this device profile (ADR 0043). */
export async function updateDeviceProfile(
  db: ToheDb,
  id: string,
  changes: Partial<Pick<LocalProfile, 'name' | 'avatar'>>,
): Promise<void> {
  await db.profiles.update(id, { ...changes, chosen: true });
}

const ofProfile = (id: string) => [
  [id, Dexie.minKey],
  [id, Dexie.maxKey],
];

/**
 * Deletes a device profile and everything it played, on this device only (I1). The last one stays: a device always has
 * someone to play as.
 */
export async function deleteDeviceProfile(db: ToheDb, id: string): Promise<boolean> {
  const deleted = await db.transaction('rw', db.profiles, db.saves, db.scores, db.ranked, async () => {
    if ((await db.profiles.count()) <= 1 || !(await db.profiles.get(id))) return false;
    await removeEverything(db, id);
    return true;
  });
  if (deleted && currentDeviceProfile.get() === id) currentDeviceProfile.clear();
  return deleted;
}

async function removeEverything(db: ToheDb, id: string) {
  const [from, to] = ofProfile(id);
  await db.saves.where('[profileId+gameId]').between(from, to).delete();
  await db.scores.where('[profileId+gameId]').between(from, to).delete();
  await db.ranked.filter((ranked) => ranked.profileId === id).delete();
  await db.profiles.delete(id);
}

/**
 * The server cannot take this id (`id_taken`): the device profile gets a new one, and its saves and scores move under
 * it. Returns the new id.
 */
export async function reIdDeviceProfile(db: ToheDb, id: string): Promise<string> {
  const next = newId();
  await db.transaction('rw', db.profiles, db.saves, db.scores, db.ranked, async () => {
    const profile = await db.profiles.get(id);
    if (!profile) return;
    const [from, to] = ofProfile(id);
    const saves = await db.saves.where('[profileId+gameId]').between(from, to).toArray();
    await db.saves.bulkPut(saves.map((save) => ({ ...save, profileId: next })));
    await db.saves.where('[profileId+gameId]').between(from, to).delete();
    await db.scores.where('[profileId+gameId]').between(from, to).modify({ profileId: next });
    await db.ranked.filter((ranked) => ranked.profileId === id).modify({ profileId: next });
    await db.profiles.delete(id);
    await db.profiles.add({ ...profile, id: next });
  });
  if (currentDeviceProfile.get() === id) currentDeviceProfile.set(next);
  return next;
}

/**
 * What a device profile played, as one request carries it: every save, newest first, and the scores — each board's
 * best first, so a profile that played a lot still brings its best (ADR 0043).
 */
export async function deviceProfileData(db: ToheDb, id: string): Promise<DeviceProfileData> {
  const [from, to] = ofProfile(id);
  const saves = (await db.saves.where('[profileId+gameId]').between(from, to).toArray())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_UPLOAD_SAVES);
  const scores = await db.scores.where('[profileId+gameId]').between(from, to).toArray();
  return {
    saves: saves.map((save) => ({
      gameId: save.gameId,
      data: save.data,
      updatedAt: new Date(save.updatedAt).toISOString(),
    })),
    scores: bestFirst(scores)
      .slice(0, MAX_UPLOAD_SCORES)
      .map((score) => ({
        clientId: score.clientId,
        gameId: score.gameId,
        board: score.board,
        value: score.value,
        achievedAt: new Date(score.at).toISOString(),
        final: score.final ?? true,
      })),
  };
}

/** Each board's scores, highest first, taken in turns across boards so every board keeps its best. */
export function bestFirst(scores: LocalScore[]): LocalScore[] {
  const boards = new Map<string, LocalScore[]>();
  for (const score of scores) {
    const key = `${score.gameId}\u0000${score.board}`;
    boards.set(key, [...(boards.get(key) ?? []), score]);
  }
  const queues = [...boards.values()].map((list) => list.sort((a, b) => b.value - a.value));
  const out: LocalScore[] = [];
  for (let i = 0; out.length < scores.length; i++) {
    for (const queue of queues) {
      const score = queue[i];
      if (score) out.push(score);
    }
  }
  return out;
}

/**
 * The device profile is now an account's profile with the same id (adopted): it leaves the device's list; its saves and
 * scores stay under that id, marked as sent, so ordinary sync never sends them again, unmarked.
 */
export async function adoptedOnDevice(db: ToheDb, id: string): Promise<void> {
  const [from, to] = ofProfile(id);
  await db.transaction('rw', db.profiles, db.scores, async () => {
    // Every score, the ones past the request's limit too: they never reach the server, where nothing would mark them.
    // Saves past the limit stay pending: a save carries no mark, so ordinary sync takes them.
    await db.scores.where('[profileId+gameId]').between(from, to).modify({ synced: 1 });
    await db.profiles.delete(id);
  });
  if (currentDeviceProfile.get() === id) currentDeviceProfile.clear();
}

/**
 * The device profile was merged into an account's profile: its scores join the target's on this device, marked as sent;
 * the saves sent go — the server kept the newer of each, and the next sync brings it. Saves past the request's limit
 * stay with the device profile, which then stays on the device: returns how many.
 */
export async function mergedOnDevice(
  db: ToheDb,
  id: string,
  targetId: string,
  sentSaves: string[],
): Promise<number> {
  const [from, to] = ofProfile(id);
  const left = await db.transaction('rw', db.profiles, db.saves, db.scores, db.ranked, async () => {
    await db.scores.where('[profileId+gameId]').between(from, to).modify({ profileId: targetId, synced: 1 });
    for (const gameId of sentSaves) await db.saves.delete([id, gameId]);
    const remaining = await db.saves.where('[profileId+gameId]').between(from, to).count();
    if (remaining === 0) await removeEverything(db, id);
    return remaining;
  });
  if (left === 0 && currentDeviceProfile.get() === id) currentDeviceProfile.clear();
  return left;
}

/**
 * What a request is about to send counts as sent before it goes, so ordinary sync — should the profile already be the
 * account's — never sends it first, without its mark (ADR 0043). `release` undoes it when the request failed.
 */
export const upload = {
  async hold(db: ToheDb, id: string, data: DeviceProfileData): Promise<void> {
    await mark(db, id, data, 1);
  },
  async release(db: ToheDb, id: string, data: DeviceProfileData): Promise<void> {
    await mark(db, id, data, 0);
  },
};

async function mark(db: ToheDb, id: string, data: DeviceProfileData, synced: 0 | 1) {
  const [from, to] = ofProfile(id);
  const games = new Set((data.saves ?? []).map((save) => save.gameId));
  await db.transaction('rw', db.saves, db.scores, async () => {
    await db.scores.where('[profileId+gameId]').between(from, to).modify({ synced });
    await db.saves
      .where('[profileId+gameId]')
      .between(from, to)
      .filter((save) => games.has(save.gameId))
      .modify({ synced });
  });
}
