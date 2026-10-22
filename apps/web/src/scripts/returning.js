// Marks a browser that has already played here, before the page paints, so the home pages (/ and /en/) show their
// *Chơi tiếp* button at the top at once, without a jump (ADR 0046, docs/architecture/surfaces.md). It never navigates:
// `/` never redirects, a link to it always shows it. Run it as a blocking classic script in <head>, like theme-init.js:
// the page's CSP forbids inline scripts, so it is a file under /_web/. It sets `data-returning` on <html>, and the
// stylesheet shows `.continue` under it.
//
// "Has played here" is what the app itself keeps in this origin's localStorage:
//   tohe:returning         set by the app on every start, for guests and accounts alike
//   tohe:guest             a guest on this device; with the next key, it covers devices from before tohe:returning
//   tohe:telemetry:device  the id the app's telemetry gives this device on its first visit
// The session cookie is HttpOnly and cannot be read here. returning.test.ts reads the app's code to keep the names true.
(() => {
  const DEVICE_KEYS = ['tohe:returning', 'tohe:guest', 'tohe:telemetry:device'];
  try {
    if (DEVICE_KEYS.some((key) => localStorage.getItem(key) !== null)) {
      document.documentElement.setAttribute('data-returning', '');
    }
  } catch {
    // Storage blocked (private mode, cookies off): the page as a newcomer sees it.
  }
})();
