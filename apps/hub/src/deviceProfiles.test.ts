import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type DeviceProfileUpload, type MeView, type ProfileView } from './api/client.ts';
import {
  type BringInApi,
  bringIn,
  canAdd,
  defaultChoices,
  needsStepUp,
  playsNext,
  refusedKey,
  suggestMergeTarget,
  withProgress,
} from './session/bringInChoices.ts';
import {
  afterSignUp,
  pendingSignUp,
  sendingSignUp,
  signingUpDevice,
  signUpUpload,
} from './session/signUpDevice.ts';
import { type LocalProfile, openDb } from './storage/db.ts';
import {
  adoptedOnDevice,
  bestFirst,
  createDeviceProfile,
  currentDeviceProfile,
  deleteDeviceProfile,
  deviceProfileData,
  ensureDeviceProfile,
  listDeviceProfiles,
  MAX_DEVICE_PROFILES,
  MAX_UPLOAD_SAVES,
  mergedOnDevice,
  reIdDeviceProfile,
  TooManyDeviceProfiles,
  updateDeviceProfile,
} from './storage/deviceProfiles.ts';
import { hasProgress, loadSave, recordScore, storeSave } from './storage/repository.ts';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

beforeEach(() => store.clear());

const fresh = () => openDb(`test-${crypto.randomUUID()}`);

const profile = (overrides: Partial<ProfileView>): ProfileView => ({
  id: crypto.randomUUID(),
  publicId: '572000000006',
  name: 'Bố',
  avatar: '🦊',
  kind: 'adult',
  ageBand: null,
  hasPin: false,
  playWithOthers: true,
  onPublicBoards: true,
  hiddenFromBoards: false,
  invites: 'anyone',
  ...overrides,
});

const meWith = (profiles: ProfileView[]): MeView => ({
  account: {
    id: 'a1',
    email: 'bo@tohe.test',
    username: null,
    displayName: 'Bố',
    telemetry: true,
    hasPassword: true,
    hasManagePin: false,
    termsVersion: '2026-10-18',
    logins: [],
    role: null,
    community: null,
    consoleUrl: null,
  },
  profiles,
  activeProfileId: profiles[0]?.id ?? null,
  parentUnlockedUntil: null,
  secureUntil: null,
});

describe('the guest becomes the first device profile (IndexedDB version 4)', () => {
  it('keeps its id, saves and scores', async () => {
    const name = `test-${crypto.randomUUID()}`;
    // The hub as it was before device profiles: version 3, one guest.
    const old = new Dexie(name);
    old.version(1).stores({
      profiles: 'id',
      saves: '[profileId+gameId], synced',
      scores: '++id, [profileId+gameId], synced',
      cache: 'key',
    });
    old.version(2).stores({ scores: '++id, [profileId+gameId], synced, clientId' });
    old.version(3).stores({ ranked: '++id, synced' });
    await old.table('profiles').add({ id: 'guest-1', name: 'Bạn nhỏ', avatar: '🐸', createdAt: 5 });
    await old
      .table('saves')
      .add({ profileId: 'guest-1', gameId: 'merge-block', data: { level: 7 }, updatedAt: 1, synced: 0 });
    await old.table('scores').add({
      profileId: 'guest-1',
      gameId: 'merge-block',
      board: 'default',
      value: 900,
      at: 1,
      synced: 0,
      clientId: 'c1',
    });
    old.close();

    const db = openDb(name);
    expect(await listDeviceProfiles(db)).toEqual([
      { id: 'guest-1', name: 'Bạn nhỏ', avatar: '🐸', createdAt: 5 },
    ]);
    expect(await loadSave(db, 'guest-1', 'merge-block')).toEqual({ level: 7 });
    expect(await hasProgress(db, 'guest-1')).toBe(true);
    // It is the one that plays: nothing new is made, so the funnel counts no new start.
    expect(await ensureDeviceProfile(db, () => 'Mèo Cam')).toMatchObject({
      profile: { id: 'guest-1' },
      made: false,
    });
    expect(currentDeviceProfile.get()).toBe('guest-1');
  });
});

describe('device profiles', () => {
  it('a new device gets one silently, with the suggested name, once', async () => {
    const db = fresh();
    const first = await ensureDeviceProfile(db, () => 'Mèo Cam');
    expect(first).toMatchObject({ made: true, profile: { name: 'Mèo Cam' } });
    expect(await ensureDeviceProfile(db, () => 'Khác')).toEqual({ profile: first.profile, made: false });
  });

  it('are five at most, switch, and keep the last one', async () => {
    const db = fresh();
    const made: LocalProfile[] = [];
    for (let i = 0; i < MAX_DEVICE_PROFILES; i++)
      made.push(await createDeviceProfile(db, { name: `Hồ sơ ${i}`, avatar: '🐼' }));
    await expect(createDeviceProfile(db, { name: 'Thứ sáu', avatar: '🐼' })).rejects.toBeInstanceOf(
      TooManyDeviceProfiles,
    );
    // The newest plays; another is chosen by setting the pointer.
    expect(currentDeviceProfile.get()).toBe(made[4]?.id);

    await storeSave(db, made[0]?.id ?? '', 'hello', { best: 1 });
    expect(await deleteDeviceProfile(db, made[0]?.id ?? '')).toBe(true);
    expect(await loadSave(db, made[0]?.id ?? '', 'hello')).toBeNull();
    for (const gone of made.slice(1, 4)) await deleteDeviceProfile(db, gone.id);
    expect(await deleteDeviceProfile(db, made[4]?.id ?? '')).toBe(false);
    expect(await listDeviceProfiles(db)).toHaveLength(1);
  });

  it('a new id moves the saves and scores under it', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    await storeSave(db, device.id, 'hello', { best: 3 });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 3 });
    const next = await reIdDeviceProfile(db, device.id);
    expect(next).not.toBe(device.id);
    expect(await hasProgress(db, device.id)).toBe(false);
    expect(await loadSave(db, next, 'hello')).toEqual({ best: 3 });
    expect(await db.scores.where('[profileId+gameId]').equals([next, 'hello']).count()).toBe(1);
    expect(currentDeviceProfile.get()).toBe(next);
    expect((await listDeviceProfiles(db)).map((p) => p.id)).toEqual([next]);
  });

  it('send every board its best first, within one request', async () => {
    const at = 0;
    const score = (gameId: string, value: number) => ({
      profileId: 'p',
      gameId,
      board: 'default',
      value,
      at,
      synced: 0 as const,
      clientId: `${gameId}-${value}`,
    });
    expect(
      bestFirst([score('a', 1), score('a', 9), score('b', 2), score('a', 5)]).map((s) => s.clientId),
    ).toEqual(['a-9', 'b-2', 'a-5', 'a-1']);

    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    await storeSave(db, device.id, 'hello', { best: 3 });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 3 });
    const data = await deviceProfileData(db, device.id);
    expect(data.saves).toMatchObject([{ gameId: 'hello', data: { best: 3 } }]);
    expect(data.scores).toMatchObject([{ gameId: 'hello', board: 'default', value: 3, final: true }]);
  });

  it('once taken by an account, leave the list; their data stays, marked as sent so sync never sends it unmarked', async () => {
    const db = fresh();
    const kept = await createDeviceProfile(db, { name: 'Ở lại', avatar: '🐸' });
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    await storeSave(db, device.id, 'hello', { best: 3 });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 3 });
    await adoptedOnDevice(db, device.id);
    expect((await listDeviceProfiles(db)).map((p) => p.id)).toEqual([kept.id]);
    // Its scores never go up unmarked; a save carries no mark, so one not sent yet is left for ordinary sync.
    expect(await db.scores.where('synced').equals(0).count()).toBe(0);
    expect(await db.saves.where('synced').equals(0).count()).toBe(1);
    expect(await loadSave(db, device.id, 'hello')).toEqual({ best: 3 });

    // Merged: its scores join the target's, sent; its saves go, the server kept the newer.
    await recordScore(db, { profileId: kept.id, gameId: 'hello', board: 'default', value: 8 });
    await storeSave(db, kept.id, 'hello', { best: 8 });
    expect(await mergedOnDevice(db, kept.id, 'target', ['hello'])).toBe(0);
    expect(await listDeviceProfiles(db)).toEqual([]);
    expect(await db.scores.where('[profileId+gameId]').equals(['target', 'hello']).first()).toMatchObject({
      value: 8,
      synced: 1,
    });
    expect(await loadSave(db, kept.id, 'hello')).toBeNull();
  });
});

describe('bringing device profiles in on a sign-in (ADR 0043)', () => {
  const playing: LocalProfile = { id: 'd1', name: 'Mèo Cam', avatar: '🐯', createdAt: 1 };
  const other: LocalProfile = { id: 'd2', name: 'Bé Na', avatar: '🐼', createdAt: 2 };

  it('ask only about device profiles with progress', async () => {
    const db = fresh();
    const played = await createDeviceProfile(db, { name: 'Đã chơi', avatar: '🐯' });
    await createDeviceProfile(db, { name: 'Chưa chơi', avatar: '🐼' });
    await recordScore(db, { profileId: played.id, gameId: 'hello', board: 'default', value: 1 });
    expect((await withProgress(db, await listDeviceProfiles(db))).map((p) => p.id)).toEqual([played.id]);
  });

  it('add the one playing and keep the others, by default', () => {
    expect(defaultChoices([playing, other], 'd1', [profile({})], 5)).toEqual({
      d1: { kind: 'add', ageBand: null },
      d2: { kind: 'keep' },
    });
  });

  it('merge into the profile with the same name, else the same avatar, when the account is full', () => {
    const full = [
      profile({ id: 'p1', name: 'Bố', avatar: '🦊' }),
      profile({ id: 'p2', name: 'Cá', avatar: '🐯' }),
      profile({ id: 'p3', name: 'mèo cam', avatar: '🐸' }),
    ];
    expect(suggestMergeTarget(playing, full)).toBe('p3');
    expect(suggestMergeTarget({ ...playing, name: 'Khác' }, full)).toBe('p2');
    expect(suggestMergeTarget({ ...playing, name: 'Khác', avatar: '🐙' }, full)).toBe('p1');
    expect(defaultChoices([playing], 'd1', full, 3)).toEqual({ d1: { kind: 'merge', into: 'p3' } });
  });

  it('add only while the account stays within its limit, and ask for step-up only to add or merge', () => {
    const choices = { d1: { kind: 'add' as const, ageBand: null }, d2: { kind: 'keep' as const } };
    expect(canAdd(choices, 'd2', 3, 5)).toBe(true);
    expect(canAdd(choices, 'd2', 4, 5)).toBe(false);
    expect(canAdd(choices, 'd1', 4, 5)).toBe(true);
    expect(needsStepUp(choices)).toBe(true);
    expect(needsStepUp({ d1: { kind: 'keep' } })).toBe(false);
  });

  it('an id the server cannot take is replaced on the device and asked again', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 4 });
    const sent: DeviceProfileUpload[] = [];
    const api: BringInApi = {
      adopt: async (body) => {
        sent.push(body);
        if (sent.length === 1) throw new ApiError(409, 'id_taken');
        return meWith([profile({ id: body.id })]);
      },
      merge: async () => meWith([]),
      me: async () => meWith([]),
    };
    const outcome = await bringIn(db, api, device, { kind: 'add', ageBand: null });
    expect(outcome.status).toBe('adopted');
    expect(sent).toHaveLength(2);
    expect(sent[1]?.id).not.toBe(device.id);
    expect(sent[1]?.data?.scores).toHaveLength(1);
    expect(outcome.status === 'adopted' && outcome.id).toBe(sent[1]?.id);
  });

  it('a refused name asks for another', async () => {
    const db = fresh();
    const api: BringInApi = {
      adopt: async () => {
        throw new ApiError(422, 'name_refused', {}, null, 'name_reserved');
      },
      merge: async () => meWith([]),
      me: async () => meWith([]),
    };
    expect(await bringIn(db, api, playing, { kind: 'add', ageBand: '6-8' })).toEqual({
      status: 'rename',
      reason: 'name_reserved',
    });
    expect(refusedKey('name_reserved')).toBe('errors.nameReserved');
    expect(refusedKey(null)).toBe('errors.nameRefused');
  });

  it('a merge sends the name and the data to the target', async () => {
    const db = fresh();
    const merges: [string, string][] = [];
    const api: BringInApi = {
      adopt: async () => meWith([]),
      merge: async (id, name) => {
        merges.push([id, name]);
        return meWith([]);
      },
      me: async () => meWith([]),
    };
    expect(await bringIn(db, api, playing, { kind: 'merge', into: 'p1' })).toMatchObject({
      status: 'merged',
      into: 'p1',
    });
    expect(merges).toEqual([['p1', 'Mèo Cam']]);
  });
});

describe('what one request sends (ADR 0043 review)', () => {
  it('a lost answer: id_taken for an id the account already has is taken as adopted, without a new id', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 4 });
    let adopts = 0;
    const api: BringInApi = {
      adopt: async () => {
        adopts++;
        throw new ApiError(409, 'id_taken');
      },
      merge: async () => meWith([]),
      me: async () => meWith([profile({ id: device.id })]),
    };
    expect(await bringIn(db, api, device, { kind: 'add', ageBand: null })).toMatchObject({
      status: 'adopted',
      id: device.id,
    });
    expect(adopts).toBe(1);
    expect(await listDeviceProfiles(db)).toEqual([]);
    expect(await db.scores.where('synced').equals(0).count()).toBe(0);
  });

  it('counts as sent while the request is out, and as pending again when it failed', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 4 });
    await storeSave(db, device.id, 'hello', { best: 4 });
    const pendingWhileOut: number[] = [];
    const api: BringInApi = {
      adopt: async () => {
        pendingWhileOut.push(
          (await db.scores.where('synced').equals(0).count()) +
            (await db.saves.where('synced').equals(0).count()),
        );
        throw new TypeError('offline');
      },
      merge: async () => meWith([]),
      me: async () => null,
    };
    await expect(bringIn(db, api, device, { kind: 'add', ageBand: null })).rejects.toThrow('offline');
    expect(pendingWhileOut).toEqual([0]);
    expect(await db.scores.where('synced').equals(0).count()).toBe(1);
    expect(await db.saves.where('synced').equals(0).count()).toBe(1);
    expect(await listDeviceProfiles(db)).toHaveLength(1);
  });

  it('a merge with more saves than one request carries keeps the rest with the device profile, on the device', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    for (let i = 0; i < MAX_UPLOAD_SAVES + 2; i++) await storeSave(db, device.id, `game-${i}`, { i });
    let sentSaves = 0;
    const api: BringInApi = {
      adopt: async () => meWith([]),
      merge: async (_id, _name, data) => {
        sentSaves = data?.saves?.length ?? 0;
        return meWith([]);
      },
      me: async () => null,
    };
    const outcome = await bringIn(db, api, device, { kind: 'merge', into: 'p1' });
    expect(sentSaves).toBe(MAX_UPLOAD_SAVES);
    expect(outcome).toMatchObject({ status: 'merged', savesLeft: 2 });
    expect((await listDeviceProfiles(db)).map((p) => p.id)).toEqual([device.id]);
    expect(
      await db.saves.where('[profileId+gameId]').between([device.id, ''], [device.id, '\uffff']).count(),
    ).toBe(2);
  });
});

describe('who plays after a sign-in brought the device profiles in', () => {
  const me = meWith([]);

  it('the profile the device profile being played became — its new id after id_taken — or its merge target', () => {
    expect(playsNext('d1', { d1: { status: 'adopted', id: 'd1-new', me } })).toBe('d1-new');
    expect(playsNext('d1', { d1: { status: 'merged', into: 'p3', me, savesLeft: 0 } })).toBe('p3');
  });

  it('nobody new when it stayed on the device, or only another one came in', () => {
    expect(playsNext('d1', {})).toBeNull();
    expect(playsNext('d1', { d2: { status: 'adopted', id: 'd2', me } })).toBeNull();
    expect(playsNext(null, { d2: { status: 'adopted', id: 'd2', me } })).toBeNull();
  });
});

describe('the sign-up question (ADR 0043)', () => {
  it('is asked about the device profile playing, once it has progress', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo Cam', avatar: '🐯' });
    expect(await signingUpDevice(db)).toBeNull();
    await storeSave(db, device.id, 'hello', { best: 1 });
    expect(await signingUpDevice(db)).toMatchObject({ id: device.id });
  });

  it('or once the player named it or chose its avatar — never for the untouched one the hub made', async () => {
    const db = fresh();
    const { profile: silent } = await ensureDeviceProfile(db, () => 'Mèo Vui');
    expect(await signingUpDevice(db)).toBeNull();
    await updateDeviceProfile(db, silent.id, { avatar: '🦄' });
    expect(await signingUpDevice(db)).toMatchObject({ id: silent.id });
    const named = await createDeviceProfile(db, { name: 'Tên tôi đặt', avatar: '🐯', chosen: true });
    expect(await signingUpDevice(db)).toMatchObject({ id: named.id });
  });

  it('mine: the device profile becomes the first profile with the name chosen; a child keeps its name and age band', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo Cam', avatar: '🐯' });
    expect(await signUpUpload(db, device, { mine: true, ageBand: '6-8' }, 'Bố Mèo')).toMatchObject({
      id: device.id,
      name: 'Bố Mèo',
      avatar: '🐯',
      ageBand: null,
    });
    expect(await signUpUpload(db, device, { mine: false, ageBand: '9-12' }, 'Bố')).toMatchObject({
      id: device.id,
      name: 'Mèo Cam',
      ageBand: '9-12',
    });
  });

  it('the account took it: it leaves the device; another device kept it', async () => {
    const db = fresh();
    const device = await createDeviceProfile(db, { name: 'Mèo Cam', avatar: '🐯' });
    await recordScore(db, { profileId: device.id, gameId: 'hello', board: 'default', value: 2 });
    const sent = await signUpUpload(db, device, { mine: true, ageBand: '6-8' }, 'Mèo Cam');
    // Made the usual way (the link opened elsewhere, or its id taken meanwhile): its data is pending again.
    await sendingSignUp(db, sent, async () => meWith([profile({})]));
    expect(await afterSignUp(db, meWith([profile({})]), sent)).toBe(false);
    expect(await listDeviceProfiles(db)).toHaveLength(1);
    expect(await db.scores.where('synced').equals(0).count()).toBe(1);
    expect(await afterSignUp(db, meWith([profile({ id: device.id })]), sent)).toBe(true);
    expect(await listDeviceProfiles(db)).toHaveLength(0);
  });

  it('the email link opened in this browser finds the sign-up it started', () => {
    pendingSignUp.remember({ attemptId: 'a1', deviceId: 'd1', mine: true, ageBand: '6-8', name: 'Mèo' });
    expect(pendingSignUp.find('a1')).toMatchObject({ deviceId: 'd1' });
    expect(pendingSignUp.find('other')).toBeNull();
    pendingSignUp.forget();
    expect(pendingSignUp.find('a1')).toBeNull();
  });
});
