// The service worker's registration (update.ts says what it does): apart, so the pure part is testable without the
// PWA plugin's virtual module.
import { registerSW } from 'virtual:pwa-register';
import { holdsWork, updates } from './update.ts';

/** How often a long session asks the server whether a new version is there. */
export const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker in the prompt mode: no `skipWaiting`, no `clientsClaim`, no reload of its own. A long
 * session checks for a new version every hour while the app is in sight; going out of sight on a screen of the frame
 * with nothing in progress, the page takes a version that waits (`appliesOutOfSight`).
 */
export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  let registration: ServiceWorkerRegistration | undefined;
  const update = registerSW({
    onNeedRefresh: () => updates.found(),
    onNeedReload: () => updates.controlling(),
    onRegisteredSW: (_url, found) => {
      registration = found;
      if (!found) return;
      setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) void found.update().catch(() => {});
      }, CHECK_EVERY_MS);
    },
  });
  updates.connect({
    skipWaiting: () => update(),
    hasWaiting: () => Boolean(registration?.waiting),
    reload: () => window.location.reload(),
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    void updates.outOfSight(window.location, holdsWork(document)).catch(() => {});
  });
}
