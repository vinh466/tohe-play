import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type DeviceProfileRegistration } from './api/client.ts';
import {
  actAsDevice,
  deviceHeaders,
  hubRefusal,
  hubUrl,
  onActingChanged,
  onDeviceTrouble,
  PROFILE_HEADER,
  reportTrouble,
  TERMS_HEADER,
} from './rooms/devicePlayer.ts';
import {
  deleteEverywhere,
  lostServerCopy,
  mayEnter,
  needsNamedScreen,
  needsUpload,
  type Prove,
  type ServerCopyApi,
  sendServerCopy,
  tablesStep,
  termsAgain,
} from './session/serverCopy.ts';
import { playerGate } from './session/session.ts';
import { type LocalProfile, openDb } from './storage/db.ts';
import {
  createDeviceProfile,
  currentDeviceProfile,
  listDeviceProfiles,
  reIdDeviceProfile,
} from './storage/deviceProfiles.ts';
import { loadSave, storeSave } from './storage/repository.ts';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

beforeEach(() => store.clear());

const TERMS = '2026-10-20';
const fresh = () => openDb(`test-${crypto.randomUUID()}`);
const noProof: Prove = (send) => send(null);

/** A server that takes ids it does not know yet, as the API does (ADR 0043). */
function server(taken: string[] = []) {
  const sent: DeviceProfileRegistration[] = [];
  const known = new Set(taken);
  const api: ServerCopyApi & { sent: DeviceProfileRegistration[]; removed: string[]; started: number } = {
    sent,
    removed: [],
    started: 0,
    start: async () => {
      api.started++;
    },
    register: async (body) => {
      sent.push(body);
      if (known.has(body.id)) throw new ApiError(409, 'id_taken');
      return { id: body.id, name: body.name, avatar: body.avatar, termsVersion: body.termsVersion };
    },
    remove: async (id) => {
      api.removed.push(id);
    },
  };
  return api;
}

describe('the named screen (ADR 0043)', () => {
  const profile = (overrides: Partial<LocalProfile> = {}): LocalProfile => ({
    id: 'p1',
    name: 'Mèo Cam',
    avatar: '🐯',
    createdAt: 1,
    ...overrides,
  });

  it('comes before anything of the profile reaches the server, and again with new terms', () => {
    expect(needsNamedScreen(profile(), TERMS)).toBe(true);
    expect(tablesStep(profile(), TERMS)).toBe('name');
    const accepted = profile({ termsVersion: TERMS, server: { name: 'Mèo Cam', avatar: '🐯' } });
    expect(tablesStep(accepted, TERMS)).toBe('play');
    expect(tablesStep(accepted, '2026-12-01')).toBe('name');
  });

  it('needs the line ticked and a name', () => {
    expect(mayEnter('Mèo Cam', false)).toBe(false);
    expect(mayEnter('   ', true)).toBe(false);
    expect(mayEnter(' Mèo Cam ', true)).toBe(true);
  });

  it('is not asked again for a copy sent anew: a new id, or a new name', () => {
    const renamed = profile({ termsVersion: TERMS, server: { name: 'Mèo', avatar: '🐯' } });
    expect(needsUpload(renamed)).toBe(true);
    expect(tablesStep(renamed, TERMS)).toBe('send');
    expect(tablesStep(profile({ termsVersion: TERMS }), TERMS)).toBe('send');
  });

  it('a room link on a new phone plays as its device profile, not a sign-in', () => {
    expect(playerGate({ status: 'signedOut' }, { device: true })).toBe('enter-as-device');
  });
});

describe('the server copy', () => {
  it('is made with a device key and the terms ticked, and remembered', async () => {
    const db = fresh();
    const made = await createDeviceProfile(db, { name: ' Mèo Cam ', avatar: '🐯' });
    const api = server();
    const stored = await sendServerCopy(db, api, made, TERMS, noProof);
    expect(api.started).toBe(1);
    expect(api.sent).toEqual([
      { id: made.id, name: 'Mèo Cam', avatar: '🐯', termsVersion: TERMS, proof: null },
    ]);
    expect(stored).toMatchObject({
      id: made.id,
      termsVersion: TERMS,
      name: 'Mèo Cam',
      server: { name: 'Mèo Cam', avatar: '🐯' },
    });
  });

  it('gets a new id when the server cannot take its id, with its saves moved', async () => {
    const db = fresh();
    const made = await createDeviceProfile(db, { name: 'Mèo Cam', avatar: '🐯' });
    await storeSave(db, made.id, 'merge-block', { level: 3 });
    const api = server([made.id]);
    const stored = await sendServerCopy(db, api, made, TERMS, noProof);
    expect(stored.id).not.toBe(made.id);
    expect(api.sent.map((body) => body.id)).toEqual([made.id, stored.id]);
    expect(await loadSave(db, stored.id, 'merge-block')).toEqual({ level: 3 });
    expect(currentDeviceProfile.get()).toBe(stored.id);
    expect((await listDeviceProfiles(db)).map((p) => p.id)).toEqual([stored.id]);
  });

  it('keeps the name the server answers with: a moderator’s, or the one before the day’s renames ran out', async () => {
    const db = fresh();
    const made = await createDeviceProfile(db, { name: 'Tên xấu', avatar: '🐯' });
    const api = server();
    api.register = async (body) => ({
      id: body.id,
      name: 'Người chơi',
      avatar: body.avatar,
      termsVersion: body.termsVersion,
    });
    const stored = await sendServerCopy(db, api, made, TERMS, noProof);
    expect(stored).toMatchObject({ name: 'Người chơi', server: { name: 'Người chơi', avatar: '🐯' } });
    // No loop: what the device keeps is what the server has.
    expect(tablesStep(stored, TERMS)).toBe('play');
  });

  it('a new id is unknown to the server: no copy and no terms until it is sent', async () => {
    const db = fresh();
    const made = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    const sent = await sendServerCopy(db, server(), made, TERMS, noProof);
    const next = await reIdDeviceProfile(db, sent.id);
    const now = (await listDeviceProfiles(db)).find((p) => p.id === next);
    expect(now?.server).toBeUndefined();
    expect(now?.termsVersion).toBeUndefined();
  });

  it('found gone on the server: a new id on the device, sent again without asking', async () => {
    const db = fresh();
    const made = await createDeviceProfile(db, { name: 'Mèo Cam', avatar: '🐯' });
    await storeSave(db, made.id, 'merge-block', { level: 5 });
    const sent = await sendServerCopy(db, server(), made, TERMS, noProof);
    const next = await lostServerCopy(db, sent.id);
    expect(next).not.toBe(sent.id);
    expect(await lostServerCopy(db, sent.id)).toBeNull();
    const now = (await listDeviceProfiles(db))[0];
    expect(now).toMatchObject({ id: next, termsVersion: TERMS });
    expect(now?.server).toBeUndefined();
    expect(now && tablesStep(now, TERMS)).toBe('send');
    expect(await loadSave(db, next ?? '', 'merge-block')).toEqual({ level: 5 });
  });

  it('asks the terms again when the server says so', async () => {
    const db = fresh();
    const made = await createDeviceProfile(db, { name: 'Mèo Cam', avatar: '🐯' });
    const sent = await sendServerCopy(db, server(), made, TERMS, noProof);
    await termsAgain(db, sent.id);
    const now = (await listDeviceProfiles(db))[0];
    expect(now && tablesStep(now, TERMS)).toBe('name');
  });

  it('goes with the device profile, never the last one', async () => {
    const db = fresh();
    const first = await createDeviceProfile(db, { name: 'Mèo', avatar: '🐯' });
    const second = await sendServerCopy(
      db,
      server(),
      await createDeviceProfile(db, { name: 'Gà', avatar: '🐸' }),
      TERMS,
      noProof,
    );
    const api = server();
    expect(await deleteEverywhere(db, api, second)).toBe(true);
    expect(api.removed).toEqual([second.id]);
    // One without a copy deletes nothing on the server; the last one stays.
    expect(await deleteEverywhere(db, api, first)).toBe(false);
    expect(api.removed).toEqual([second.id]);
  });
});

describe('acting at the tables', () => {
  it('names the device profile on rooms requests and the hub’s address only', () => {
    actAsDevice('p1', TERMS);
    expect(deviceHeaders('/api/rooms/code/482913')).toEqual({
      [PROFILE_HEADER]: 'p1',
      [TERMS_HEADER]: TERMS,
    });
    expect(deviceHeaders('/api/progress/saves')).toEqual({});
    expect(hubUrl()).toBe(`/api/rooms/hub?deviceProfile=p1&terms=${TERMS}`);
    actAsDevice(null);
    expect(deviceHeaders('/api/rooms/mine')).toEqual({});
    expect(hubUrl()).toBe('/api/rooms/hub');
  });

  it('a new player acting makes a new connection; the same one does not', () => {
    const heard = vi.fn();
    const off = onActingChanged(heard);
    actAsDevice('p2', TERMS);
    actAsDevice('p2', TERMS);
    actAsDevice(null);
    off();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('hears that the copy is gone or the terms changed, from requests and the hub', () => {
    const heard = vi.fn();
    const off = onDeviceTrouble(heard);
    reportTrouble('device_profile_not_found', 'p1');
    reportTrouble('room_full', 'p1');
    reportTrouble(
      hubRefusal(
        new Error(
          "An unexpected error occurred invoking 'Enter' on the server. HubException: terms_required",
        ),
      ),
      'p1',
    );
    off();
    expect(heard.mock.calls).toEqual([
      ['device_profile_not_found', 'p1'],
      ['terms_required', 'p1'],
    ]);
  });
});
