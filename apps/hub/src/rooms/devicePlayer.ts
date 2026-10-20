// Who acts at the tables (ADR 0043): the account's session, or a device profile with its device's key. The API reads
// the device key only when a request names a device profile — by a header, or in the rooms hub's address, as a
// WebSocket carries no headers — so the hub names one exactly while a device profile plays. docs/architecture/rooms.md
import { api } from '../api/client.ts';
import { TERMS_VERSION } from '../legal/documents.ts';

/** The header naming the device profile that acts (the API's `DeviceKey.ProfileHeader`). */
export const PROFILE_HEADER = 'X-Tohe-Device-Profile';

/** The header carrying the terms the hub shows, which the device profile must have accepted (`DeviceKey.TermsHeader`). */
export const TERMS_HEADER = 'X-Tohe-Terms';

const HUB_PATH = '/api/rooms/hub';

interface Acting {
  id: string;
  terms: string;
}

let acting: Acting | null = null;
const changeListeners = new Set<() => void>();

/** The device profile that acts at tables from now on, or null while an account's profile plays. */
export function actAsDevice(id: string | null, terms = TERMS_VERSION): void {
  if ((acting?.id ?? null) === id && (!id || acting?.terms === terms)) return;
  acting = id ? { id, terms } : null;
  for (const listener of changeListeners) listener();
}

/** The device profile acting now, if one is. */
export const actingDevice = (): Acting | null => acting;

/** Told when who acts changes: the rooms hub's connection is made again for them. */
export function onActingChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** The rooms hub's address: it names the device profile acting, if one is. */
export function hubUrl(who: Acting | null = acting): string {
  if (!who) return HUB_PATH;
  const query = new URLSearchParams({ deviceProfile: who.id, terms: who.terms });
  return `${HUB_PATH}?${query.toString()}`;
}

/** The headers a rooms request carries while a device profile acts. */
export function deviceHeaders(path: string, who: Acting | null = acting): Record<string, string> {
  if (!who || !path.startsWith('/api/rooms')) return {};
  return { [PROFILE_HEADER]: who.id, [TERMS_HEADER]: who.terms };
}

/**
 * What the API said of the device profile acting (ADR 0043): its copy on the server is gone — deleted, or cleaned up
 * after 90 days unused — it moved to another device with a transfer code, or the terms changed and its player must
 * accept them again.
 */
export type DeviceTrouble = 'device_profile_not_found' | 'device_profile_moved' | 'terms_required';

const TROUBLES: readonly string[] = ['device_profile_not_found', 'device_profile_moved', 'terms_required'];

const troubleListeners = new Set<(trouble: DeviceTrouble, id: string) => void>();

export function onDeviceTrouble(listener: (trouble: DeviceTrouble, id: string) => void): () => void {
  troubleListeners.add(listener);
  return () => troubleListeners.delete(listener);
}

/** The code a rooms hub call was refused with (the server's `HubException`), if any. */
export function hubRefusal(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  return /HubException: ([a-z_]+)/.exec(message)?.[1] ?? null;
}

/** Tells the listeners; the rooms hub's calls report their refusals here too. */
export function reportTrouble(code: string | null | undefined, id: string | undefined = acting?.id): void {
  if (!id || !code || !TROUBLES.includes(code)) return;
  for (const listener of troubleListeners) listener(code as DeviceTrouble, id);
}

api.use({
  onRequest({ request }) {
    const headers = deviceHeaders(new URL(request.url, window.location.origin).pathname);
    for (const [name, value] of Object.entries(headers)) request.headers.set(name, value);
    return request;
  },
  async onResponse({ request, response }) {
    const id = request.headers.get(PROFILE_HEADER);
    if (!id || (response.status !== 404 && response.status !== 410 && response.status !== 412))
      return undefined;
    const problem = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: unknown } | null;
    reportTrouble(typeof problem?.code === 'string' ? problem.code : null, id);
    return undefined;
  },
});
