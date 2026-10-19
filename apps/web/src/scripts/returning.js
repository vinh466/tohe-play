// Sends a browser that has already played here on to the app, before the page paints (ADR 0042,
// docs/architecture/hosts-and-paths.md): the root is for people who have not used Tò He yet. Run it as a blocking
// classic script in <head>, like theme-init.js: the page's CSP forbids inline scripts, so it is a file under /_web/.
//
// "Has played here" is what the app itself keeps in this origin's localStorage:
//   tohe:guest             a guest on this device ("Chơi thử"); the app removes it when the person signs in
//   tohe:telemetry:device  the id the app's telemetry gives this device on its first visit, for guests and accounts
// The session cookie is HttpOnly and cannot be read here. /?stay never redirects, so the page can still be looked at.
// A localStorage key that the app sets on every visit would replace this list; returning.test.ts reads the app's code
// to keep the names true.
(() => {
  const DEVICE_KEYS = ['tohe:guest', 'tohe:telemetry:device'];
  try {
    if (new URLSearchParams(location.search).has('stay')) return;
    if (DEVICE_KEYS.some((key) => localStorage.getItem(key) !== null)) location.replace('/play');
  } catch {
    // Storage blocked (private mode, cookies off): show the page.
  }
})();
