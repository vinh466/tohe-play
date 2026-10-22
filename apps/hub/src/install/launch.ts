// The installed app coming back (ADR 0046, docs/architecture/surfaces.md "Coming back"):
// - a link opened while the app runs: the manifest's `launch_handler` (`focus-existing`, Chromium) hands it to the open
//   app through `launchQueue`, which goes there itself;
// - the app's storage: the installed app asks once for persistent storage, so the browser does not clear a device
//   profile's progress when space runs short.
// Pure decisions here; main.tsx wires them.
import { matchHubPath } from '@tohe/routes';

/** Where a link handed to the open app leads: a screen of the app, a page of the players' host, or nowhere. */
export type LaunchTarget = { kind: 'app'; path: string } | { kind: 'page'; url: string } | null;

/**
 * A link handed to the running app. Another origin is not the app's (the browser never hands one). The address the app
 * already shows — the first launch hands the start page too — needs nothing. A page of the app's own namespaces is
 * navigated to inside the app; any other page of the host (a public page) is loaded, as the browser would have.
 */
export function launchTarget(target: string, origin: string, current: string): LaunchTarget {
  let url: URL;
  try {
    url = new URL(target, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const path = `${url.pathname}${url.search}`;
  if (path === current) return null;
  const namespace = matchHubPath(url.pathname);
  if (namespace?.component === 'app' && namespace.served === 'page') return { kind: 'app', path };
  return { kind: 'page', url: url.href };
}

interface LaunchParams {
  targetURL?: string;
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/** Follows the links the browser hands the open app, where it does (`'launchQueue' in window`); elsewhere nothing. */
export function followLaunches(go: (path: string) => void): void {
  const queue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
  if (!queue) return;
  queue.setConsumer((params) => {
    if (!params.targetURL) return;
    const target = launchTarget(
      params.targetURL,
      window.location.origin,
      `${window.location.pathname}${window.location.search}`,
    );
    if (target?.kind === 'app') go(target.path);
    else if (target?.kind === 'page') window.location.assign(target.url);
  });
}

/** Remembered once asked, so a browser that asks its user is asked only once. */
export const PERSIST_KEY = 'tohe:persist-asked';

export type PersistOutcome = 'unsupported' | 'already' | 'asked-before' | 'granted' | 'refused';

/**
 * The installed app asks for persistent storage once (`navigator.storage.persist()`): nothing when the storage is
 * persistent already, or when this device asked before. Chromium grants it to an installed app without asking.
 */
export async function askPersistentStorage(
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined,
  kv: Pick<Storage, 'getItem' | 'setItem'>,
): Promise<PersistOutcome> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'already';
    if (kv.getItem(PERSIST_KEY)) return 'asked-before';
    kv.setItem(PERSIST_KEY, '1');
    return (await storage.persist()) ? 'granted' : 'refused';
  } catch {
    return 'unsupported';
  }
}
