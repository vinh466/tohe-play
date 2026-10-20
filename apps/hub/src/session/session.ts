// Who is using this device, and who is playing. Pure functions here; hooks in useSession.ts.
import type { MeView } from '../api/client.ts';
import type { LocalProfile } from '../storage/db.ts';

/** What the hub hands to a game as `profile` in its init message. */
export interface Player {
  id: string;
  name: string;
  avatar: string;
  /** Child profiles see games filtered by age; device profiles (ADR 0043) and adults do not. */
  kind: 'adult' | 'child' | 'device';
}

export type SessionState =
  | { status: 'signedOut' }
  | { status: 'device'; player: Player }
  | { status: 'account'; me: MeView; player: Player | null };

/** Kept from guest mode: the public pages read it to send a returning device to the app (hosts-and-paths.md). */
const DEVICE_FLAG = 'tohe:guest';

const deviceListeners = new Set<() => void>();
const deviceChanged = () => {
  for (const listener of deviceListeners) listener();
};

/**
 * This device plays as its device profiles (ADR 0043), until someone signs in. A visitor with no session enters it by
 * themselves (`RequireSession`); "Chơi luôn" on the sign-in screen is the same flag. It stays on through a sign-in until
 * the profile picker has offered to bring the device profiles into the account. Listeners let the screens follow it.
 */
export const deviceMode = {
  enabled: () => localStorage.getItem(DEVICE_FLAG) === '1',
  enable: () => {
    localStorage.setItem(DEVICE_FLAG, '1');
    deviceChanged();
  },
  disable: () => {
    localStorage.removeItem(DEVICE_FLAG);
    deviceChanged();
  },
  subscribe: (listener: () => void) => {
    deviceListeners.add(listener);
    return () => void deviceListeners.delete(listener);
  },
};

/** What a screen that needs someone playing does with the session (RequireSession). */
export type PlayerGate = 'play' | 'enter-as-device' | 'sign-in' | 'choose-profile';

/**
 * Opening the hub is playing (E-03): a device with no session plays as its device profile, made silently on the first
 * visit, so no sign-in screen stands before the first game — nor before a table, since ADR 0043's I2a: a room link asks
 * for a name and the terms line instead. A screen that needs an account passes `device: false` and sends signed-out
 * devices to sign in (or up).
 */
export function playerGate(session: SessionState, { device }: { device: boolean }): PlayerGate {
  if (session.status === 'signedOut') return device ? 'enter-as-device' : 'sign-in';
  if (session.status === 'account' && !session.player) return 'choose-profile';
  return 'play';
}

export function resolveSession(
  me: MeView | null,
  asDevice: boolean,
  deviceProfile: LocalProfile | null,
): SessionState {
  if (me) {
    const active = me.profiles.find((p) => p.id === me.activeProfileId);
    return {
      status: 'account',
      me,
      player: active
        ? {
            id: active.id,
            name: active.name,
            avatar: active.avatar,
            kind: active.kind === 'child' ? 'child' : 'adult',
          }
        : null,
    };
  }
  if (asDevice && deviceProfile) {
    return {
      status: 'device',
      player: {
        id: deviceProfile.id,
        name: deviceProfile.name,
        avatar: deviceProfile.avatar,
        kind: 'device',
      },
    };
  }
  return { status: 'signedOut' };
}

/** True while account management is unlocked (the API is the authority; this only drives the UI). */
export function parentUnlocked(me: MeView, now = new Date()): boolean {
  return me.parentUnlockedUntil !== null && new Date(me.parentUnlockedUntil) > now;
}

/** True while account security (step-up level 2, ADR 0025) is open on this device; the API decides. */
export function isSecure(me: MeView, now = new Date()): boolean {
  return me.secureUntil !== null && new Date(me.secureUntil) > now;
}
