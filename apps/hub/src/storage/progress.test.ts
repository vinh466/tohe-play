import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDb } from './db.ts';
import { progressOf, recordScore, storeSave } from './repository.ts';

let databases = 0;
const device = () => openDb(`progress-test-${++databases}`);

describe('a profile’s progress on this device', () => {
  it('groups saves and scores by game, keeps the best score, and puts the newest first', async () => {
    const db = device();
    await storeSave(db, 'p1', 'merge-block', { score: 12 });
    await recordScore(db, { profileId: 'p1', gameId: 'merge-block', board: 'score', value: 120 });
    await recordScore(db, { profileId: 'p1', gameId: 'merge-block', board: 'score', value: 300 });
    await storeSave(db, 'p1', 'tien-len', { hand: 1 });

    const rows = await progressOf(db, 'p1');
    expect(rows.map((row) => row.gameId)).toEqual(['tien-len', 'merge-block']);
    expect(rows.find((row) => row.gameId === 'merge-block')).toMatchObject({
      best: 300,
      saves: 1,
    });
    expect(rows.find((row) => row.gameId === 'tien-len')).toMatchObject({
      best: null,
      saves: 1,
    });
  });
});
