import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDb, type ToheDb } from './storage/db.ts';
import { loadSave, recordRanked, recordScore, storeSave } from './storage/repository.ts';
import { createSyncer, type ProgressApi, syncProfile } from './storage/sync.ts';

/** An in-memory API with the server's rules: the last write wins; a score's clientId is stored once. */
function fakeServer() {
  let clock = Date.parse('2026-10-14T08:00:00Z');
  const saves = new Map<string, { data: unknown; updatedAt: string }>();
  const scores = new Map<string, { value: number; final: boolean }>();
  /** Ranked runs taken, by run; `refuse` holds runs the server will never take, `down` makes it unreachable. */
  const ranked = new Map<string, { moves: unknown[]; score: number }>();
  const refuse = new Set<string>();
  const api: ProgressApi & { calls: number; down?: boolean; onPut?: () => Promise<void> } = {
    calls: 0,
    async finishRun(run, moves, score) {
      api.calls++;
      if (api.down) throw new Error('offline');
      if (refuse.has(run)) return 'refused';
      ranked.set(run, { moves, score });
      return 'taken';
    },
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
      for (const score of list) {
        const known = scores.get(score.clientId);
        scores.set(score.clientId, {
          value: Math.max(known?.value ?? score.value, score.value),
          final: (known?.final ?? false) || score.final,
        });
      }
      return { recorded: list.length };
    },
  };
  return { api, saves, scores, ranked, refuse };
}

let databases = 0;
const device = (): ToheDb => openDb(`sync-test-${++databases}`);
const KID = 'kid-1';

describe('sync', () => {
  it('hands ranked runs in once, drops one the server will never take, and keeps one it could not reach', async () => {
    const db = device();
    const server = fakeServer();
    server.refuse.add('closed-run');
    await recordRanked(db, {
      profileId: KID,
      gameId: 'merge-block',
      run: 'run-1',
      moves: [0, 3, 4],
      score: 64,
    });
    await recordRanked(db, {
      profileId: KID,
      gameId: 'merge-block',
      run: 'closed-run',
      moves: [1],
      score: 2,
    });

    await syncProfile(db, server.api, KID);
    await syncProfile(db, server.api, KID);
    expect([...server.ranked]).toEqual([['run-1', { moves: [0, 3, 4], score: 64 }]]);
    expect(await db.ranked.where('synced').equals(0).count()).toBe(0);

    server.api.down = true;
    await recordRanked(db, { profileId: KID, gameId: 'merge-block', run: 'run-2', moves: [2], score: 4 });
    await expect(syncProfile(db, server.api, KID)).rejects.toThrow('offline');
    server.api.down = false;
    await syncProfile(db, server.api, KID);
    expect(server.ranked.get('run-2')).toEqual({ moves: [2], score: 4 });
  });

  it('pushes pending saves and scores once, then marks them synced', async () => {
    const db = device();
    const server = fakeServer();
    await storeSave(db, KID, 'merge-block', { score: 40 });
    await recordScore(db, { profileId: KID, gameId: 'merge-block', board: 'default', value: 40 });

    await syncProfile(db, server.api, KID);
    await syncProfile(db, server.api, KID);

    expect(server.saves.get('merge-block')?.data).toEqual({ score: 40 });
    expect([...server.scores.values()]).toEqual([{ value: 40, final: true }]);
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

  it('keeps a long run as one score that rises, then turns final (ADR 0014)', async () => {
    const db = device();
    const server = fakeServer();
    const report = (value: number, final: boolean) =>
      recordScore(db, { profileId: KID, gameId: 'merge-block', board: 'default', value, run: 'r1', final });
    await report(10, false);
    await report(30, false);
    await report(20, false);
    expect(await db.scores.count()).toBe(1);

    await syncProfile(db, server.api, KID);
    expect([...server.scores.values()]).toEqual([{ value: 30, final: false }]);

    await report(30, true);
    await syncProfile(db, server.api, KID);
    expect(await db.scores.toArray()).toMatchObject([{ value: 30, final: true, synced: 1 }]);
    expect([...server.scores.values()]).toEqual([{ value: 30, final: true }]);
  });

  it('keeps a run report made while the previous one was being pushed', async () => {
    const db = device();
    const server = fakeServer();
    const report = (value: number) =>
      recordScore(db, {
        profileId: KID,
        gameId: 'merge-block',
        board: 'default',
        value,
        run: 'r2',
        final: false,
      });
    await report(5);
    const recordScores = server.api.recordScores;
    server.api.recordScores = async (list) => {
      await report(50);
      return recordScores(list);
    };

    await syncProfile(db, server.api, KID);

    expect(await db.scores.toArray()).toMatchObject([{ value: 50, synced: 0 }]);
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
