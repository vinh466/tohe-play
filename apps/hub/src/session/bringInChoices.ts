// Bringing device profiles into an account (ADR 0043, step I1): what the hub asks, its defaults, and the requests.
// docs/architecture/identity.md#bringing-one-into-an-account
import {
  ApiError,
  type DeviceProfileData,
  type DeviceProfileUpload,
  type MeView,
  type ProfileView,
} from '../api/client.ts';
import type { LocalProfile, ToheDb } from '../storage/db.ts';
import {
  adoptedOnDevice,
  deviceProfileData,
  mergedOnDevice,
  reIdDeviceProfile,
  upload,
} from '../storage/deviceProfiles.ts';
import { hasProgress } from '../storage/repository.ts';

/** What happens to one device profile when its device signs in to an account. */
export type BringInChoice =
  | { kind: 'add'; ageBand: string | null }
  | { kind: 'merge'; into: string }
  | { kind: 'keep' };

export type BringInChoices = Record<string, BringInChoice>;

/** The device profiles worth asking about: those with progress on this device (ADR 0043). */
export async function withProgress(db: ToheDb, profiles: LocalProfile[]): Promise<LocalProfile[]> {
  const kept: LocalProfile[] = [];
  for (const profile of profiles) if (await hasProgress(db, profile.id)) kept.push(profile);
  return kept;
}

const same = (a: string, b: string) =>
  a.normalize('NFC').trim().toLocaleLowerCase('vi') === b.normalize('NFC').trim().toLocaleLowerCase('vi');

/**
 * The account's profile a device profile would merge into: one with the same name, else the same avatar, else the first
 * — the same person on two devices, most likely (ADR 0043).
 */
export function suggestMergeTarget(device: LocalProfile, profiles: ProfileView[]): string | null {
  return (
    profiles.find((profile) => same(profile.name, device.name))?.id ??
    profiles.find((profile) => profile.avatar === device.avatar)?.id ??
    profiles[0]?.id ??
    null
  );
}

/**
 * The defaults (ADR 0043): the device profile playing is added — merged into the suggested profile when the account is
 * full — and the others stay on the device; on a shared device, nobody else's progress joins someone's profile.
 */
export function defaultChoices(
  devices: LocalProfile[],
  playingId: string | null,
  profiles: ProfileView[],
  maxProfiles: number,
): BringInChoices {
  const playing =
    devices.find((device) => device.id === playingId) ?? (devices.length === 1 ? devices[0] : undefined);
  const choices: BringInChoices = {};
  for (const device of devices) {
    if (device !== playing) {
      choices[device.id] = { kind: 'keep' };
      continue;
    }
    const into = suggestMergeTarget(device, profiles);
    choices[device.id] =
      profiles.length < maxProfiles
        ? { kind: 'add', ageBand: null }
        : into
          ? { kind: 'merge', into }
          : { kind: 'keep' };
  }
  return choices;
}

/** Whether `deviceId` may be added: the account's profiles and the other adds chosen stay within its limit. */
export function canAdd(
  choices: BringInChoices,
  deviceId: string,
  accountProfiles: number,
  maxProfiles: number,
): boolean {
  const others = Object.entries(choices).filter(
    ([id, choice]) => id !== deviceId && choice.kind === 'add',
  ).length;
  return accountProfiles + others < maxProfiles;
}

/** Adding or merging is profile management: it needs step-up level 1 (ADR 0025). */
export const needsStepUp = (choices: BringInChoices) =>
  Object.values(choices).some((choice) => choice.kind !== 'keep');

/** The API calls bringing in needs; injected so the logic is testable without a server. */
export interface BringInApi {
  adopt(body: DeviceProfileUpload): Promise<MeView>;
  merge(id: string, name: string, data: DeviceProfileUpload['data']): Promise<MeView>;
  /** The account as the server sees it now: an answer may have been lost. */
  me(): Promise<MeView | null>;
}

export type BringInOutcome =
  | { status: 'adopted'; id: string; me: MeView }
  /** `savesLeft`: saves past one request's limit, kept with the device profile, which stays on the device then. */
  | { status: 'merged'; into: string; me: MeView; savesLeft: number }
  /** The name rules refused its name: the player renames it first (`reason` is the rule). */
  | { status: 'rename'; reason: string | null };

/**
 * Brings one device profile in, and tidies the device after it. What the request sends counts as sent before it goes
 * (`upload.hold`), and pending again if it failed. An id the server cannot take (`id_taken`) is first looked for in the
 * account — the answer to an earlier request may have been lost, and then it is in already — else replaced on the device,
 * its saves and scores moved under the new one, and asked again, once.
 */
export async function bringIn(
  db: ToheDb,
  api: BringInApi,
  device: LocalProfile,
  choice: Exclude<BringInChoice, { kind: 'keep' }>,
): Promise<BringInOutcome> {
  try {
    if (choice.kind === 'merge') {
      const data = await deviceProfileData(db, device.id);
      const me = await sending(db, device.id, data, () => api.merge(choice.into, device.name, data));
      const sent = (data.saves ?? []).map((save) => save.gameId);
      const savesLeft = await mergedOnDevice(db, device.id, choice.into, sent);
      return { status: 'merged', into: choice.into, me, savesLeft };
    }
    let id = device.id;
    for (let attempt = 0; ; attempt++) {
      const data = await deviceProfileData(db, id);
      const body = { ...uploadOf(device, choice.ageBand), id, data };
      try {
        const me = await sending(db, id, data, () => api.adopt(body));
        await adoptedOnDevice(db, id);
        return { status: 'adopted', id, me };
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 'id_taken') || attempt > 0) throw error;
        const now = await api.me();
        if (now?.profiles.some((profile) => profile.id === id)) {
          await adoptedOnDevice(db, id);
          return { status: 'adopted', id, me: now };
        }
        id = await reIdDeviceProfile(db, id);
      }
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'name_refused')
      return { status: 'rename', reason: error.reason };
    throw error;
  }
}

/** Sends a device profile's data, held as sent meanwhile and released when the request failed. */
async function sending<T>(
  db: ToheDb,
  id: string,
  data: DeviceProfileData,
  request: () => Promise<T>,
): Promise<T> {
  await upload.hold(db, id, data);
  try {
    return await request();
  } catch (error) {
    await upload.release(db, id, data);
    throw error;
  }
}

/**
 * Who plays next once device profiles came in: the player goes on as the one they were playing — the profile it became
 * when added (its id, or the new one after `id_taken`), or the target it was merged into. Null: nothing changes.
 */
export function playsNext(
  playingId: string | null,
  outcomes: Record<string, Exclude<BringInOutcome, { status: 'rename' }>>,
): string | null {
  const outcome = playingId ? outcomes[playingId] : undefined;
  if (!outcome) return null;
  return outcome.status === 'adopted' ? outcome.id : outcome.into;
}

/** A device profile as a request carries it, without its data: an adult's, or a child's with an age band. */
export function uploadOf(device: LocalProfile, ageBand: string | null): DeviceProfileUpload {
  return { id: device.id, name: device.name.normalize('NFC').trim(), avatar: device.avatar, ageBand };
}

/** The message for the name rule that refused a device profile's name. */
export function refusedKey(reason: string | null): string {
  switch (reason) {
    case 'name_reserved':
      return 'errors.nameReserved';
    case 'name_inappropriate':
      return 'errors.nameInappropriate';
    case 'name_too_long':
      return 'errors.nameTooLong';
    case 'name_required':
      return 'errors.nameRequired';
    case 'name_invalid_character':
      return 'errors.nameInvalidCharacter';
    default:
      return 'errors.nameRefused';
  }
}
