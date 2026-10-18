import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ApiError, type MeView } from './api/client.ts';
import { errorKey } from './api/errors.ts';
import { parentUnlocked, resolveSession } from './session/session.ts';
import { openDb } from './storage/db.ts';
import { hasProgress, loadSave, moveProgress, recordScore, storeSave } from './storage/repository.ts';

const me = (overrides: Partial<MeView> = {}): MeView => ({
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
  },
  profiles: [
    {
      id: 'p-adult',
      publicId: '572000000006',
      name: 'Bố',
      avatar: '🦊',
      kind: 'adult',
      ageBand: null,
      hasPin: false,
      playWithOthers: true,
      onPublicBoards: true,
      hiddenFromBoards: false,
    },
    {
      id: 'p-kid',
      publicId: '890000000001',
      name: 'Na',
      avatar: '🐼',
      kind: 'child',
      ageBand: '3-5',
      hasPin: true,
      playWithOthers: false,
      onPublicBoards: false,
      hiddenFromBoards: false,
    },
  ],
  activeProfileId: null,
  parentUnlockedUntil: null,
  secureUntil: null,
  ...overrides,
});

const guestProfile = { id: 'guest-1', name: 'Bạn nhỏ', avatar: '🐸', createdAt: 0 };

describe('resolveSession', () => {
  it('is signed out without an account or guest mode', () => {
    expect(resolveSession(null, false, guestProfile)).toEqual({ status: 'signedOut' });
  });

  it('plays as the local guest in guest mode', () => {
    expect(resolveSession(null, true, guestProfile)).toMatchObject({
      status: 'guest',
      player: { id: 'guest-1', kind: 'guest' },
    });
  });

  it('prefers the account over guest mode and needs a chosen profile to play', () => {
    expect(resolveSession(me(), true, guestProfile)).toMatchObject({ status: 'account', player: null });
    expect(resolveSession(me({ activeProfileId: 'p-kid' }), false, null)).toMatchObject({
      status: 'account',
      player: { id: 'p-kid', name: 'Na', kind: 'child' },
    });
  });

  it('treats the parent gate as unlocked only until it expires', () => {
    const now = new Date('2026-10-13T10:00:00Z');
    expect(parentUnlocked(me({ parentUnlockedUntil: '2026-10-13T10:05:00Z' }), now)).toBe(true);
    expect(parentUnlocked(me({ parentUnlockedUntil: '2026-10-13T09:59:00Z' }), now)).toBe(false);
    expect(parentUnlocked(me(), now)).toBe(false);
  });
});

describe('errorKey', () => {
  it('maps API codes, validation codes, rate limits and network failures', () => {
    expect(errorKey(new ApiError(401, 'invalid_credentials'))).toBe('errors.invalidCredentials');
    expect(errorKey(new ApiError(400, null, { email: ['email_invalid'] }))).toBe('errors.emailInvalid');
    expect(errorKey(new ApiError(429, null))).toBe('errors.tooManyRequests');
    expect(errorKey(new TypeError('Failed to fetch'))).toBe('errors.offline');
    expect(errorKey(new ApiError(500, null))).toBe('errors.generic');
  });

  it('reads validation codes case-insensitively', () => {
    expect(new ApiError(400, null, { Password: ['password_too_short'] }).field('password')).toBe(
      'password_too_short',
    );
  });
});

describe('moving guest progress', () => {
  it('moves scores and saves without overwriting the target profile', async () => {
    const db = openDb(`test-${crypto.randomUUID()}`);
    await storeSave(db, 'guest', 'hello', { best: 5 });
    await storeSave(db, 'guest', 'merge', { level: 2 });
    await storeSave(db, 'kid', 'merge', { level: 9 });
    await recordScore(db, { profileId: 'guest', gameId: 'hello', board: 'default', value: 5 });

    expect(await hasProgress(db, 'guest')).toBe(true);
    await moveProgress(db, 'guest', 'kid');

    expect(await hasProgress(db, 'guest')).toBe(false);
    expect(await loadSave(db, 'kid', 'hello')).toEqual({ best: 5 });
    expect(await loadSave(db, 'kid', 'merge')).toEqual({ level: 9 });
    expect(await db.scores.where('[profileId+gameId]').equals(['kid', 'hello']).count()).toBe(1);
  });
});
