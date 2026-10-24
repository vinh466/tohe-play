// Who is using this device, and who is playing. Pure functions here; hooks in useSession.ts.
import type { MeView } from '../api/client.ts';
import type { LocalProfile } from '../storage/db.ts';
import { sessionEnded } from './ended.ts';

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
    // Choosing this device's profiles answers an ended session's notice (ended.ts): the player chose them.
    sessionEnded.clear();
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
export type PlayerGate = 'play' | 'enter-as-device' | 'door' | 'sign-in' | 'choose-profile';

/**
 * A link plays at once (E-03): a device with no session plays as its device profile, made silently, so no sign-in
 * screen stands before the game a link opens — nor before a table, since ADR 0043's I2a: a room link asks for a name
 * and the terms line instead. The app's own door asks once (ADR 0055): a screen of the frame passes `door: true`, and a
 * device with no session that never chose is sent to the sign-in screen, where it signs in or plays on this device;
 * once it chose, it plays as its device profiles and is never asked again. A screen that needs an account passes
 * `device: false` and sends signed-out devices to sign in (or up).
 */
export function playerGate(
  session: SessionState,
  { device, door = false }: { device: boolean; door?: boolean },
): PlayerGate {
  if (session.status === 'signedOut') return !device ? 'sign-in' : door ? 'door' : 'enter-as-device';
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
