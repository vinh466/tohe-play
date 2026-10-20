// The device profile that signs up (ADR 0043): asked about when it has progress, then sent with the step that makes the
// account — by email or with a provider — and dropped from the device's list once the account took it.
import { queryOptions } from '@tanstack/react-query';
import type { DeviceProfileUpload, MeView } from '../api/client.ts';
import { db, type LocalProfile, type ToheDb } from '../storage/db.ts';
import {
  adoptedOnDevice,
  currentDeviceProfile,
  deviceProfileData,
  upload,
} from '../storage/deviceProfiles.ts';
import { hasProgress } from '../storage/repository.ts';
import { uploadOf } from './bringInChoices.ts';

/** "Hồ sơ 'Mèo Cam' là của bạn?" — yes by default; no means a child's, with its age band. */
export interface SignUpAnswer {
  mine: boolean;
  ageBand: string;
}

export const defaultAnswer: SignUpAnswer = { mine: true, ageBand: '6-8' };

/**
 * The device profile playing on this device, when the player made something of it — played, or named it or chose its
 * avatar: the one the sign-up asks about. One the hub made silently and nobody touched is not asked about.
 */
export async function signingUpDevice(store: ToheDb): Promise<LocalProfile | null> {
  const id = currentDeviceProfile.get();
  const profile = id ? await store.profiles.get(id) : undefined;
  if (!profile) return null;
  return profile.chosen || (await hasProgress(store, profile.id)) ? profile : null;
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

/**
 * Sends the step that makes the account with the device profile's data held as sent (`upload.hold`), so ordinary sync
 * never sends it first, unmarked; released when the request failed.
 */
export async function sendingSignUp<T>(
  store: ToheDb,
  device: DeviceProfileUpload | null,
  request: () => Promise<T>,
): Promise<T> {
  if (device?.data) await upload.hold(store, device.id, device.data);
  try {
    return await request();
  } catch (error) {
    if (device?.data) await upload.release(store, device.id, device.data);
    throw error;
  }
}

/**
 * The account took the device profile (same id): it leaves the device's list; its saves and scores stay under it. Made
 * the usual way instead, the device keeps it, its data pending again.
 */
export async function afterSignUp(
  store: ToheDb,
  me: MeView,
  device: DeviceProfileUpload | null,
): Promise<boolean> {
  if (!device) return false;
  if (!me.profiles.some((profile) => profile.id === device.id)) {
    if (device.data) await upload.release(store, device.id, device.data);
    return false;
  }
  await adoptedOnDevice(store, device.id);
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
