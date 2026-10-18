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

/** "Chơi thử": play without an account on this device, until someone signs in. */
export const guestMode = {
  enabled: () => localStorage.getItem(GUEST_FLAG) === '1',
  enable: () => localStorage.setItem(GUEST_FLAG, '1'),
  disable: () => localStorage.removeItem(GUEST_FLAG),
};

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
