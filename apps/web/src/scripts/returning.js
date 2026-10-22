// Sends a browser that has already played here on to the app, before the page paints (ADR 0042,
// docs/architecture/hosts-and-paths.md): the home pages, / and /en/, are for people who have not used Tò He yet. Run it
// as a blocking classic script in <head>, like theme-init.js: the page's CSP forbids inline scripts, so it is a file
// under /_web/. From /en/ the app is opened with ?lang=en, as every link of an English page into the app is (ADR 0047).
//
// "Has played here" is what the app itself keeps in this origin's localStorage:
//   tohe:returning         set by the app on every start, for guests and accounts alike
//   tohe:guest             a guest on this device; with the next key, it covers devices from before tohe:returning
//   tohe:telemetry:device  the id the app's telemetry gives this device on its first visit
// The session cookie is HttpOnly and cannot be read here. ?stay never redirects, so the page can still be looked at.
// returning.test.ts reads the app's code to keep the names true.
(() => {
  const DEVICE_KEYS = ['tohe:returning', 'tohe:guest', 'tohe:telemetry:device'];
  try {
    if (new URLSearchParams(location.search).has('stay')) return;
    const english = location.pathname === '/en' || location.pathname.startsWith('/en/');
    if (DEVICE_KEYS.some((key) => localStorage.getItem(key) !== null)) {
      location.replace(english ? '/play?lang=en' : '/play');
    }
  } catch {
    // Storage blocked (private mode, cookies off): show the page.
  }
})();
