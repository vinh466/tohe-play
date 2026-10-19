// Who is using this device, and who is playing. Pure functions here; hooks in useSession.ts.
import type { MeView } from '../api/client.ts';
import type { LocalProfile } from '../storage/db.ts';

/** What the hub hands to a game as `profile` in its init message. */
export interface Player {
  id: string;
  name: string;
  avatar: string;
  /** Child profiles see games filtered by age; guests and adults do not. */
  kind: 'adult' | 'child' | 'guest';
}

export type SessionState =
  | { status: 'signedOut' }
  | { status: 'guest'; player: Player }
  | { status: 'account'; me: MeView; player: Player | null };

const GUEST_FLAG = 'tohe:guest';

const guestListeners = new Set<() => void>();
const guestChanged = () => {
  for (const listener of guestListeners) listener();
};

/**
 * Playing without an account on this device, until someone signs in. A visitor with no session enters it by
 * themselves (`RequireSession`); "Chơi thử" on the sign-in screen is the same flag. Listeners let the screens follow it.
 */
export const guestMode = {
  enabled: () => localStorage.getItem(GUEST_FLAG) === '1',
  enable: () => {
    localStorage.setItem(GUEST_FLAG, '1');
    guestChanged();
  },
  disable: () => {
    localStorage.removeItem(GUEST_FLAG);
    guestChanged();
  },
  subscribe: (listener: () => void) => {
    guestListeners.add(listener);
    return () => void guestListeners.delete(listener);
  },
};

/** What a screen that needs someone playing does with the session (RequireSession). */
export type PlayerGate = 'play' | 'enter-as-guest' | 'sign-in' | 'choose-profile';

/**
 * Opening the hub is playing (E-03): a device with no session and no guest flag becomes a guest by itself, so no
 * sign-in screen stands before the first game. A screen that needs an account — a room link — passes
 * `guest: false` and keeps sending guests and signed-out devices to sign in (or up).
 */
export function playerGate(session: SessionState, { guest }: { guest: boolean }): PlayerGate {
  if (session.status === 'signedOut') return guest ? 'enter-as-guest' : 'sign-in';
  if (session.status === 'account' && !session.player) return 'choose-profile';
  return 'play';
}

export function resolveSession(
  me: MeView | null,
  guest: boolean,
  guestProfile: LocalProfile | null,
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
  if (guest && guestProfile) {
    return {
      status: 'guest',
      player: { id: guestProfile.id, name: guestProfile.name, avatar: guestProfile.avatar, kind: 'guest' },
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
