import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceProfileData, TransferView } from './api/client.ts';
import { onDeviceTrouble, reportTrouble } from './rooms/devicePlayer.ts';
import {
  checkMoves,
  cleanCode,
  clock,
  movedNotices,
  receive,
  secondsLeft,
  secretFromHash,
  secretFromScan,
  settleMoves,
  showCode,
  startTransfer,
  type TransferApi,
  transferLink,
} from './session/transfer.ts';
import { openDb, type ToheDb } from './storage/db.ts';
import {
  createDeviceProfile,
  currentDeviceProfile,
  MAX_DEVICE_PROFILES,
  TooManyDeviceProfiles,
} from './storage/deviceProfiles.ts';
import { loadSave, recordScore, storeSave } from './storage/repository.ts';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

beforeEach(() => store.clear());

const TERMS = '2026-10-20';
const SECRET = 'q0vF8bJm3sYt6Wc2Hk9LpN4rXe7Ua1Zd5Gi0Ob3Mj8Q';
const ORIGIN = 'https://toheplay.example';
const fresh = () => openDb(`test-${crypto.randomUUID()}`);

/** A server that makes codes and records what it was sent. */
function server() {
  const started: { id: string; termsVersion: string; data: DeviceProfileData }[] = [];
  const api: TransferApi & { started: typeof started } = {
    started,
    start: async (id, body) => {
      started.push({ id, ...body });
      return { code: '482913', secret: SECRET, expiresAt: new Date(Date.now() + 600_000).toISOString() };
    },
    status: async () => ({ state: 'open', expiresAt: new Date().toISOString() }),
    confirm: async () => undefined,
    cancel: async () => undefined,
    redeem: async () => ({ id: 't1', state: 'asked' }),
    get: async () => ({ id: 't1', state: 'asked' }),
  };
  return api;
}

/** A device profile with a copy on the server and the terms accepted, a save and a score. */
async function onServer(db: ToheDb, name = 'Mèo Cam') {
  const profile = await createDeviceProfile(db, { name, avatar: '🐯', chosen: true });
  await db.profiles.update(profile.id, { server: { name, avatar: '🐯' }, termsVersion: TERMS });
  await storeSave(db, profile.id, 'merge-block', { level: 3 });
  await recordScore(db, { profileId: profile.id, gameId: 'merge-block', board: 'score', value: 120 });
  return profile;
}

describe('the code on the old device', () => {
  it('reads as two groups of three, and six typed digits come back whatever the spaces', () => {
    expect(showCode('482913')).toBe('482 913');
    expect(cleanCode(' 482 913 ')).toBe('482913');
    expect(cleanCode('482-913')).toBe('482913');
    expect(cleanCode('48291')).toBeNull();
    expect(cleanCode('48291a')).toBeNull();
  });

  it('counts down in minutes and seconds, never below zero', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    expect(secondsLeft('2026-10-20T10:09:59.200Z', now)).toBe(600);
    expect(clock(599)).toBe('9:59');
    expect(clock(5)).toBe('0:05');
    expect(secondsLeft('2026-10-20T09:59:00Z', now)).toBe(0);
  });

  it('puts the secret after # in its link, and only this hub’s transfer link is read back from a QR code', () => {
    const link = transferLink(ORIGIN, SECRET);
    expect(link).toBe(`${ORIGIN}/account/transfer#${SECRET}`);
    expect(secretFromHash(`#${SECRET}`)).toBe(SECRET);
    expect(secretFromHash('#short')).toBeNull();
    expect(secretFromScan(link, ORIGIN)).toBe(SECRET);
    expect(secretFromScan(link, 'https://elsewhere.example')).toBeNull();
    expect(secretFromScan(`${ORIGIN}/r/482913#${SECRET}`, ORIGIN)).toBeNull();
    expect(secretFromScan('not a link', ORIGIN)).toBeNull();
  });

  it('carries the saves and scores and counts them as sent; what is played after stays unsent', async () => {
    const db = fresh();
    const profile = await onServer(db);
    const api = server();
    const code = await startTransfer(db, api, profile.id, TERMS);

    expect(code.code).toBe('482913');
    const [sent] = api.started;
    expect(sent?.termsVersion).toBe(TERMS);
    expect(sent?.data.saves?.map((save) => save.gameId)).toEqual(['merge-block']);
    expect(sent?.data.scores?.map((score) => score.value)).toEqual([120]);
    expect((await db.saves.toArray()).map((save) => save.synced)).toEqual([1]);
    expect((await db.scores.toArray()).map((score) => score.synced)).toEqual([1]);

    await storeSave(db, profile.id, 'merge-block', { level: 4 });
    await recordScore(db, { profileId: profile.id, gameId: 'merge-block', board: 'score', value: 90 });
    expect((await db.saves.toArray()).map((save) => save.synced)).toEqual([0]);
    expect((await db.scores.orderBy('id').toArray()).map((score) => score.synced)).toEqual([1, 0]);
  });
});

describe('the new device', () => {
  const done = (data: DeviceProfileData = {}): TransferView => ({
    id: 't1',
    state: 'done',
    profile: { id: 'moved-1', name: 'Mèo Cam', avatar: '🐯', termsVersion: TERMS },
    data,
  });
  const data: DeviceProfileData = {
    saves: [{ gameId: 'merge-block', data: { level: 7 }, updatedAt: '2026-10-20T09:00:00Z' }],
    scores: [
      {
        clientId: 'score-1',
        gameId: 'merge-block',
        board: 'score',
        value: 1234,
        achievedAt: '2026-10-20T08:00:00Z',
        final: true,
      },
    ],
  };

  it('takes the profile with its id, name, terms, copy, saves and scores, and plays as it', async () => {
    const db = fresh();
    const received = await receive(db, done(data));

    expect(received?.id).toBe('moved-1');
    const profile = await db.profiles.get('moved-1');
    expect(profile).toMatchObject({
      name: 'Mèo Cam',
      avatar: '🐯',
      termsVersion: TERMS,
      server: { name: 'Mèo Cam', avatar: '🐯' },
    });
    expect(currentDeviceProfile.get()).toBe('moved-1');
    expect(await loadSave(db, 'moved-1', 'merge-block')).toEqual({ level: 7 });
    expect((await db.scores.toArray()).map((score) => [score.clientId, score.value])).toEqual([
      ['score-1', 1234],
    ]);

    // The answer read twice: nothing twice.
    await receive(db, done(data));
    expect(await db.scores.count()).toBe(1);
    expect(await db.profiles.count()).toBe(1);
  });

  it('takes nothing before the old device said yes, and nothing past five profiles', async () => {
    const db = fresh();
    expect(await receive(db, { id: 't1', state: 'asked' })).toBeNull();
    expect(await db.profiles.count()).toBe(0);

    for (let i = 0; i < MAX_DEVICE_PROFILES; i++)
      await createDeviceProfile(db, { name: `Bé ${i}`, avatar: '🐼' });
    await expect(receive(db, done(data))).rejects.toBeInstanceOf(TooManyDeviceProfiles);
  });
});

describe('the old device after the move', () => {
  it('lets the profile go when nothing was played since the code', async () => {
    const db = fresh();
    const keep = await createDeviceProfile(db, { name: 'Gà Con', avatar: '🐥' });
    const moved = await onServer(db);
    await startTransfer(db, server(), moved.id, TERMS);

    expect(await settleMoves(db, [{ profileId: moved.id }])).toEqual([{ name: 'Mèo Cam', kept: false }]);
    expect(await db.profiles.get(moved.id)).toBeUndefined();
    expect(await db.saves.count()).toBe(0);
    expect(await db.scores.count()).toBe(0);
    expect(await db.profiles.get(keep.id)).toBeDefined();
    expect(currentDeviceProfile.get()).toBeNull();
  });

  it('keeps what was played since as a new device profile, with no copy and no terms', async () => {
    const db = fresh();
    const moved = await onServer(db);
    await startTransfer(db, server(), moved.id, TERMS);
    await storeSave(db, moved.id, 'merge-block', { level: 9 });
    await recordScore(db, { profileId: moved.id, gameId: 'merge-block', board: 'score', value: 50 });

    expect(await settleMoves(db, [{ profileId: moved.id }])).toEqual([{ name: 'Mèo Cam', kept: true }]);
    expect(await db.profiles.get(moved.id)).toBeUndefined();
    const [kept] = await db.profiles.toArray();
    expect(kept?.name).toBe('Mèo Cam');
    expect(kept?.server).toBeUndefined();
    expect(kept?.termsVersion).toBeUndefined();
    expect(currentDeviceProfile.get()).toBe(kept?.id);
    expect(await loadSave(db, kept?.id ?? '', 'merge-block')).toEqual({ level: 9 });
    // The score that went with the code left; the one played since stays.
    expect((await db.scores.toArray()).map((score) => score.value)).toEqual([50]);
  });

  it('asks the server only when a device profile has a copy there, and ignores profiles it does not have', async () => {
    const db = fresh();
    await createDeviceProfile(db, { name: 'Gà Con', avatar: '🐥' });
    const list = vi.fn(async () => [{ profileId: 'elsewhere', movedAt: '2026-10-20T10:00:00Z' }]);
    expect(await checkMoves(db, list)).toEqual([]);
    expect(list).not.toHaveBeenCalled();

    await onServer(db);
    expect(await checkMoves(db, list)).toEqual([]);
    expect(list).toHaveBeenCalledOnce();
  });

  it('tells the player once per profile until they dismiss it', () => {
    movedNotices.add([{ name: 'Mèo Cam', kept: true }]);
    movedNotices.add([
      { name: 'Mèo Cam', kept: true },
      { name: 'Gà Con', kept: false },
    ]);
    expect(movedNotices.parse(movedNotices.raw())).toEqual([
      { name: 'Mèo Cam', kept: true },
      { name: 'Gà Con', kept: false },
    ]);
    movedNotices.clear();
    expect(movedNotices.parse(movedNotices.raw())).toEqual([]);
  });

  it('hears a 410 device_profile_moved from the tables like the other troubles', () => {
    const heard: string[] = [];
    const stop = onDeviceTrouble((trouble, id) => heard.push(`${trouble}:${id}`));
    reportTrouble('device_profile_moved', 'p1');
    reportTrouble('room_full', 'p1');
    stop();
    expect(heard).toEqual(['device_profile_moved:p1']);
  });
});
