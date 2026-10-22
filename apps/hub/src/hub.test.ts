import 'fake-indexeddb/auto';
import { GameManifest } from '@tohe/contract';
import { describe, expect, it } from 'vitest';
import type { GameSummary } from './api/client.ts';
import { descriptionOf, linkGameName, nameOf } from './launcher/gameWords.ts';
import { dailySeed, hasShell, isTrustedEntry, manifestFrom } from './launcher/manifest.ts';
import { openDb } from './storage/db.ts';
import { bestScore, loadSave, recordScore, storeSave, withOfflineCache } from './storage/repository.ts';

const hello: GameSummary = {
  id: 'hello',
  name: 'Tap Dot',
  names: { vi: 'Chạm Chấm' },
  version: '1.0.0',
  description: 'Tap the dot.',
  descriptions: { vi: 'Chạm vào chấm.', en: 'Tap the dot.' },
  entryUrl: 'http://localhost:4730/hello/1.0.0/index.html',
  iconUrl: null,
  orientation: 'portrait',
  capabilities: ['save', 'scores', 'unknown'],
  tags: [],
  minAge: 3,
  sizeKb: 10,
  rooms: null,
  identity: { play: 'any', rooms: null },
  entries: [],
};

describe('launcher', () => {
  it('rebuilds a valid manifest from the API view, dropping unknown capabilities', () => {
    const manifest = manifestFrom(hello);
    expect(GameManifest.safeParse(manifest).success).toBe(true);
    expect(manifest.capabilities).toEqual(['save', 'scores']);
  });

  it('keeps the standard name and the words per language in the manifest (ADR 0048)', () => {
    const manifest = manifestFrom(hello);
    expect(manifest).toMatchObject({
      name: 'Tap Dot',
      names: { vi: 'Chạm Chấm' },
      description: 'Tap the dot.',
    });
    expect(manifest.descriptions).toEqual({ vi: 'Chạm vào chấm.', en: 'Tap the dot.' });
  });

  it('shows a game in the hub’s language, else its standard words (ADR 0048)', () => {
    expect(nameOf(hello, 'vi')).toBe('Chạm Chấm');
    expect(nameOf(hello, 'en')).toBe('Tap Dot');
    expect(descriptionOf(hello, 'vi')).toBe('Chạm vào chấm.');
    expect(descriptionOf(hello, 'en')).toBe('Tap the dot.');
    // A catalog cached before the API returned the words per language.
    const cached = { name: 'Chạm Chấm', description: 'Chạm vào chấm.' };
    expect([nameOf(cached, 'en'), descriptionOf(cached, 'en')]).toEqual(['Chạm Chấm', 'Chạm vào chấm.']);
    // A resolved link: its game's standard name and names, or none when the game is not listed.
    expect(linkGameName({ gameName: 'Tap Dot', gameNames: { vi: 'Chạm Chấm' } }, 'vi')).toBe('Chạm Chấm');
    expect(linkGameName({ gameName: 'Tiến Lên', gameNames: null }, 'en')).toBe('Tiến Lên');
    expect(linkGameName({ gameName: null }, 'vi')).toBeNull();
  });

  it('keeps the shell capability: the game draws its own menus and the hub no bar (ADR 0018)', () => {
    const shelled = { ...hello, capabilities: ['save', 'scores', 'shell'] };
    expect(manifestFrom(shelled).capabilities).toEqual(['save', 'scores', 'shell']);
    expect(hasShell(shelled)).toBe(true);
    expect(hasShell(hello)).toBe(false);
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
  it('keeps saves and best scores per profile', async () => {
    const db = openDb(`test-${crypto.randomUUID()}`);
    const profile = { id: crypto.randomUUID() };

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
