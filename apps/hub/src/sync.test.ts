import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDb, type ToheDb } from './storage/db.ts';
import { loadSave, recordScore, storeSave } from './storage/repository.ts';
import { createSyncer, type ProgressApi, syncProfile } from './storage/sync.ts';

/** An in-memory API with the server's rules: the last write wins; a score's clientId is stored once. */
function fakeServer() {
  let clock = Date.parse('2026-10-14T08:00:00Z');
  const saves = new Map<string, { data: unknown; updatedAt: string }>();
  const scores = new Map<string, number>();
  const api: ProgressApi & { calls: number; onPut?: () => Promise<void> } = {
    calls: 0,
    async listSaves() {
      api.calls++;
      return [...saves].map(([gameId, save]) => ({ gameId, ...save }));
    },
    async putSave(gameId, data) {
      api.calls++;
      await api.onPut?.();
      clock += 1000;
      const save = { data, updatedAt: new Date(clock).toISOString() };
      saves.set(gameId, save);
      return save;
    },
    async recordScores(list) {
      api.calls++;
      for (const score of list) scores.set(score.clientId, score.value);
      return { recorded: list.length };
    },
  };
  return { api, saves, scores };
}

let databases = 0;
const device = (): ToheDb => openDb(`sync-test-${++databases}`);
const KID = 'kid-1';

describe('sync', () => {
  it('pushes pending saves and scores once, then marks them synced', async () => {
    const db = device();
    const server = fakeServer();
    await storeSave(db, KID, 'merge-block', { score: 40 });
    await recordScore(db, { profileId: KID, gameId: 'merge-block', board: 'default', value: 40 });

    await syncProfile(db, server.api, KID);
    await syncProfile(db, server.api, KID);

    expect(server.saves.get('merge-block')?.data).toEqual({ score: 40 });
    expect([...server.scores.values()]).toEqual([40]);
    expect(await db.saves.where('synced').equals(0).count()).toBe(0);
    expect(await db.scores.where('synced').equals(0).count()).toBe(0);
  });

  it('brings a save made on another device', async () => {
    const server = fakeServer();
    const phone = device();
    const tablet = device();
    await storeSave(phone, KID, 'merge-block', { score: 99 });
    await syncProfile(phone, server.api, KID);

    await syncProfile(tablet, server.api, KID);

    expect(await loadSave(tablet, KID, 'merge-block')).toEqual({ score: 99 });
  });

  it('never overwrites a save that waits to be pushed: it wins instead', async () => {
    const server = fakeServer();
    const phone = device();
    const tablet = device();
    await storeSave(phone, KID, 'merge-block', { from: 'phone' });
    await syncProfile(phone, server.api, KID);
    await storeSave(tablet, KID, 'merge-block', { from: 'tablet, offline' });

    await syncProfile(tablet, server.api, KID);

    expect(await loadSave(tablet, KID, 'merge-block')).toEqual({ from: 'tablet, offline' });
    expect(server.saves.get('merge-block')?.data).toEqual({ from: 'tablet, offline' });
  });

  it('keeps a save made while the previous one was being pushed', async () => {
    const db = device();
    const server = fakeServer();
    await storeSave(db, KID, 'merge-block', { move: 1 });
    server.api.onPut = async () => {
      server.api.onPut = undefined;
      await new Promise((resolve) => setTimeout(resolve, 5));
      await storeSave(db, KID, 'merge-block', { move: 2 });
    };

    await syncProfile(db, server.api, KID);

    const local = await db.saves.get([KID, 'merge-block']);
    expect(local?.data).toEqual({ move: 2 });
    expect(local?.synced).toBe(0);
  });

  it('runs one sync at a time', async () => {
    const db = device();
    const server = fakeServer();
    const syncer = createSyncer(db, server.api, 0);
    await storeSave(db, KID, 'hello', { best: 3 });

    await Promise.all([syncer.syncNow(KID), syncer.syncNow(KID), syncer.syncNow(KID)]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Two runs at most (the first, plus one for the requests made meanwhile), each: put + list.
    expect(server.api.calls).toBeLessThanOrEqual(4);
  });
});
