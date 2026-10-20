// The device profile that signs up (ADR 0043): asked about when it has progress, then sent with the step that makes the
// account — by email or with a provider — and dropped from the device's list once the account took it.
import { queryOptions } from '@tanstack/react-query';
import type { DeviceProfileUpload, MeView } from '../api/client.ts';
import { db, type LocalProfile, type ToheDb } from '../storage/db.ts';
import { adoptedOnDevice, currentDeviceProfile, deviceProfileData } from '../storage/deviceProfiles.ts';
import { hasProgress } from '../storage/repository.ts';
import { uploadOf } from './bringInChoices.ts';

/** "Hồ sơ 'Mèo Cam' là của bạn?" — yes by default; no means a child's, with its age band. */
export interface SignUpAnswer {
  mine: boolean;
  ageBand: string;
}

export const defaultAnswer: SignUpAnswer = { mine: true, ageBand: '6-8' };

/** The device profile playing on this device, when it has progress: the one the sign-up asks about. */
export async function signingUpDevice(store: ToheDb): Promise<LocalProfile | null> {
  const id = currentDeviceProfile.get();
  const profile = id ? await store.profiles.get(id) : undefined;
  return profile && (await hasProgress(store, profile.id)) ? profile : null;
}

export const signingUpDeviceQuery = queryOptions({
  queryKey: ['signing-up-device'],
  queryFn: () => signingUpDevice(db),
  staleTime: 0,
});

/**
 * The device profile as the step that makes the account sends it: its own profile — named as the person chose on the
 * form — or a child's, keeping its name (ADR 0043).
 */
export async function signUpUpload(
  store: ToheDb,
  device: LocalProfile,
  answer: SignUpAnswer,
  ownName: string,
): Promise<DeviceProfileUpload> {
  const named = answer.mine ? { ...device, name: ownName } : device;
  return {
    ...uploadOf(named, answer.mine ? null : answer.ageBand),
    data: await deviceProfileData(store, device.id),
  };
}

/** The account took the device profile (same id): it leaves the device's list; its saves and scores stay under it. */
export async function afterSignUp(store: ToheDb, me: MeView, deviceId: string | null): Promise<boolean> {
  if (!deviceId || !me.profiles.some((profile) => profile.id === deviceId)) return false;
  await adoptedOnDevice(store, deviceId);
  return true;
}

const PENDING = 'tohe:sign-up';

interface Pending {
  attemptId: string;
  deviceId: string;
  mine: boolean;
  ageBand: string;
  name: string;
}

/**
 * A sign-up by email waiting for its code, so the link in the email — opened in another tab of this browser — still
 * sends the device profile. Another device has none of this and makes the account the usual way.
 */
export const pendingSignUp = {
  remember: (pending: Pending) => localStorage.setItem(PENDING, JSON.stringify(pending)),
  find(attemptId: string): Pending | null {
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING) ?? 'null') as Pending | null;
      return pending?.attemptId === attemptId ? pending : null;
    } catch {
      return null;
    }
  },
  forget: () => localStorage.removeItem(PENDING),
};
