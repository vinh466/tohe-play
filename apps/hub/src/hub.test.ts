import 'fake-indexeddb/auto';
import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import type { GameSummary } from './api/client.ts';
import { dailySeed, isTrustedEntry, manifestFrom } from './launcher/manifest.ts';
import { openDb } from './storage/db.ts';
import {
  bestScore,
  ensureGuestProfile,
  loadSave,
  recordScore,
  storeSave,
  withOfflineCache,
} from './storage/repository.ts';

const hello: GameSummary = {
  id: 'hello',
  name: 'Chạm Chấm',
  version: '1.0.0',
  description: '',
  entryUrl: 'http://localhost:4730/hello/1.0.0/index.html',
  iconUrl: null,
  orientation: 'portrait',
  capabilities: ['save', 'scores', 'unknown'],
  tags: [],
  minAge: 3,
  sizeKb: 10,
  rooms: null,
};

describe('launcher', () => {
  it('rebuilds a valid manifest from the API view, dropping unknown capabilities', () => {
    const manifest = manifestFrom(hello);
    expect(GameManifest.safeParse(manifest).success).toBe(true);
    expect(manifest.capabilities).toEqual(['save', 'scores']);
  });

  it('only trusts entries on the games origin', () => {
    expect(isTrustedEntry(hello.entryUrl, 'http://localhost:4730')).toBe(true);
    expect(isTrustedEntry('https://evil.example/x.html', 'http://localhost:4730')).toBe(false);
    expect(isTrustedEntry('not a url', 'http://localhost:4730')).toBe(false);
  });

  it('derives the daily seed from the local date', () => {
    expect(dailySeed(new Date(2026, 9, 13))).toBe(20261013);
  });
});

describe('local storage', () => {
  it('creates one guest profile and keeps saves and best scores per profile', async () => {
    const db = openDb(`test-${crypto.randomUUID()}`);
    const profile = await ensureGuestProfile(db);
    expect(await ensureGuestProfile(db)).toEqual(profile);

    expect(await loadSave(db, profile.id, 'hello')).toBeNull();
    await storeSave(db, profile.id, 'hello', { best: 3 });
    expect(await loadSave(db, profile.id, 'hello')).toEqual({ best: 3 });

    await recordScore(db, { profileId: profile.id, gameId: 'hello', board: 'default', value: 3 });
    await recordScore(db, { profileId: profile.id, gameId: 'hello', board: 'default', value: 7 });
    expect(await bestScore(db, profile.id, 'hello')).toBe(7);
  });

  it('falls back to the cached copy when the network fails', async () => {
    const db = openDb(`test-${crypto.randomUUID()}`);
    expect(await withOfflineCache(db, 'games', async () => ['a'])).toEqual(['a']);
    expect(
      await withOfflineCache(db, 'games', async () => {
        throw new Error('offline');
      }),
    ).toEqual(['a']);
    await expect(
      withOfflineCache(db, 'other', async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });
});
