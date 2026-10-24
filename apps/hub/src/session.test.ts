import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type MeView } from './api/client.ts';
import { errorKey } from './api/errors.ts';
import { deviceMode, parentUnlocked, playerGate, resolveSession } from './session/session.ts';

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
    consoleUrl: null,
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
      invites: 'anyone',
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
      invites: 'account',
    },
  ],
  activeProfileId: null,
  parentUnlockedUntil: null,
  secureUntil: null,
  ...overrides,
});

const deviceProfile = { id: 'device-1', name: 'Mèo Cam', avatar: '🐸', createdAt: 0 };

describe('resolveSession', () => {
  it('is signed out without an account or device mode', () => {
    expect(resolveSession(null, false, deviceProfile)).toEqual({ status: 'signedOut' });
  });

  it('plays as the device profile in device mode, by its own name (ADR 0043)', () => {
    expect(resolveSession(null, true, deviceProfile)).toMatchObject({
      status: 'device',
      player: { id: 'device-1', name: 'Mèo Cam', kind: 'device' },
    });
  });

  it('prefers the account over device mode and needs a chosen profile to play', () => {
    expect(resolveSession(me(), true, deviceProfile)).toMatchObject({ status: 'account', player: null });
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
    // An account without a password adds no authenticator: the console's sign-in asks for one.
    expect(errorKey(new ApiError(409, 'password_required'))).toBe('errors.passwordRequired');
  });

  it('reads validation codes case-insensitively', () => {
    expect(new ApiError(400, null, { Password: ['password_too_short'] }).field('password')).toBe(
      'password_too_short',
    );
  });
});

describe('playerGate: a link plays at once (E-03), the app’s door asks once (ADR 0055)', () => {
  const signedOut = resolveSession(null, false, deviceProfile);
  const device = resolveSession(null, true, deviceProfile);

  it('a link on a device with no session enters device mode by itself, with no sign-in screen', () => {
    expect(playerGate(signedOut, { device: true })).toBe('enter-as-device');
    expect(playerGate(signedOut, { device: true, door: false })).toBe('enter-as-device');
  });

  it('a screen of the frame sends a device that never chose to the door', () => {
    expect(playerGate(signedOut, { device: true, door: true })).toBe('door');
  });

  it('a device that chose to play on itself is never asked again', () => {
    expect(playerGate(device, { device: true, door: true })).toBe('play');
  });

  it('a device profile and a chosen profile play at once', () => {
    expect(playerGate(device, { device: true })).toBe('play');
    expect(playerGate(resolveSession(me({ activeProfileId: 'p-kid' }), false, null), { device: true })).toBe(
      'play',
    );
  });

  it('an account with no chosen profile goes to the picker', () => {
    expect(playerGate(resolveSession(me(), false, null), { device: true })).toBe('choose-profile');
  });

  it('what needs an account (a room link) still asks a signed-out device to sign in', () => {
    expect(playerGate(signedOut, { device: false })).toBe('sign-in');
    // A device profile reaches the page, which sends it to sign up (the room link's entry) or shows the bots (RoomsPage).
    expect(playerGate(device, { device: false })).toBe('play');
  });
});

describe('deviceMode', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });

  it('tells the screens when a visitor plays as a device profile, and when someone signs in', () => {
    let heard = 0;
    const stop = deviceMode.subscribe(() => heard++);
    expect(deviceMode.enabled()).toBe(false);
    deviceMode.enable();
    expect(deviceMode.enabled()).toBe(true);
    // The key the public pages read stays the one guest mode had.
    expect(localStorage.getItem('tohe:guest')).toBe('1');
    deviceMode.disable();
    expect(deviceMode.enabled()).toBe(false);
    stop();
    deviceMode.enable();
    expect(heard).toBe(2);
  });
});
