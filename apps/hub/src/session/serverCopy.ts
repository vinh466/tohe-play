// A device profile's copy on the server (ADR 0043, step I2a): made the first time its player sits at a table, after
// the `named` screen and its terms line; brought up to date when its name or avatar changed; given a new id when the
// server cannot take its id, or says its copy is gone; deleted with the device profile.
// docs/architecture/identity.md#device-profiles-on-the-server
import {
  ApiError,
  type DeviceProfileRegistration,
  type DeviceProfileView,
  type ProofOfWorkSolution,
} from '../api/client.ts';
import type { LocalProfile, ToheDb } from '../storage/db.ts';
import { deleteDeviceProfile, reIdDeviceProfile } from '../storage/deviceProfiles.ts';
import { cleanName } from './profileNames.ts';

/** The requests a server copy needs; injected so the logic is testable without a server. */
export interface ServerCopyApi {
  /** The device's key (a cookie); a device that has one keeps it. */
  start(): Promise<unknown>;
  register(body: DeviceProfileRegistration): Promise<DeviceProfileView>;
  remove(id: string): Promise<unknown>;
}

/** Sends a request with a solved proof-of-work when the server asks for one (session/proofOfWork.ts). */
export type Prove = <T>(send: (proof: ProofOfWorkSolution | null) => Promise<T>) => Promise<T>;

/**
 * The `named` screen first (ADR 0043): before the device profile's data first reaches the server, and again whenever
 * the terms the hub shows are not the ones its player accepted.
 */
export function needsNamedScreen(profile: LocalProfile, terms: string): boolean {
  return profile.termsVersion !== terms;
}

/** The copy is missing, or holds another name or avatar than the device's: it is sent before the profile acts. */
export function needsUpload(profile: LocalProfile): boolean {
  return !profile.server || profile.server.name !== profile.name || profile.server.avatar !== profile.avatar;
}

/**
 * What a device profile does before it acts at a table — a room link, the lobby, a room (ADR 0043): the `named` screen,
 * sending its copy without asking, or nothing more.
 */
export function tablesStep(profile: LocalProfile, terms: string): 'name' | 'send' | 'play' {
  if (needsNamedScreen(profile, terms)) return 'name';
  return needsUpload(profile) ? 'send' : 'play';
}

/** The player may go on from the named screen: a name, and the line ticked. */
export function mayEnter(name: string, ticked: boolean): boolean {
  return ticked && cleanName(name).length > 0;
}

/**
 * Makes, or brings up to date, the device profile's copy, with the terms its player accepted: a device key first, then
 * the copy. An id the server cannot take (`id_taken`) is replaced on the device — its saves and scores move under the
 * new one — and asked again. The server answers with the name it keeps — a moderator's, or the one it had when the day's
 * renames are used up (ADR 0035) — and the device keeps that one too. Returns the profile as the device keeps it now.
 */
export async function sendServerCopy(
  db: ToheDb,
  api: ServerCopyApi,
  profile: LocalProfile,
  terms: string,
  prove: Prove,
): Promise<LocalProfile> {
  await api.start();
  let id = profile.id;
  const name = cleanName(profile.name);
  let kept: DeviceProfileView;
  for (let attempt = 0; ; attempt++) {
    try {
      kept = await prove((proof) =>
        api.register({ id, name, avatar: profile.avatar, termsVersion: terms, proof: proof ?? null }),
      );
      break;
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'id_taken') || attempt >= 2) throw error;
      id = await reIdDeviceProfile(db, id);
    }
  }
  await db.profiles.update(id, {
    name: kept.name,
    server: { name: kept.name, avatar: kept.avatar },
    termsVersion: terms,
  });
  const stored = await db.profiles.get(id);
  if (!stored) throw new Error('The device profile is gone');
  return stored;
}

/**
 * The server says the copy is gone — deleted, or cleaned up after 90 days unused (ADR 0043): the device profile gets a
 * new id on the device, its saves and scores moved under it, and no copy until it next acts. The terms its player
 * accepted stay: its next copy is sent without asking again. Returns the new id.
 */
export async function lostServerCopy(db: ToheDb, id: string): Promise<string | null> {
  // Several requests may hear it at once: the first gives the new id.
  const lost = await db.profiles.get(id);
  if (!lost) return null;
  const next = await reIdDeviceProfile(db, id);
  // The same player accepted these terms already: the copy goes again without asking (identity.md).
  if (lost.termsVersion) await db.profiles.update(next, { termsVersion: lost.termsVersion });
  return next;
}

/** The terms changed since its player accepted them: the named screen asks again. */
export async function termsAgain(db: ToheDb, id: string): Promise<void> {
  await db.profiles.update(id, { termsVersion: undefined });
}

/**
 * Deletes a device profile on the device and, when it has one, its copy on the server (ADR 0043): its seats there read
 * "Người chơi đã xoá". Offline, or the server's copy already gone, the device deletes its own anyway: the server deletes
 * a copy unused for 90 days by itself. False when the device keeps it — its last one.
 */
export async function deleteEverywhere(
  db: ToheDb,
  api: ServerCopyApi,
  profile: LocalProfile,
): Promise<boolean> {
  if ((await db.profiles.count()) <= 1) return false;
  if (profile.server) await api.remove(profile.id).catch(() => undefined);
  return deleteDeviceProfile(db, profile.id);
}
