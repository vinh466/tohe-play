// A child's way out (ADR 0046, docs/architecture/surfaces.md): when the app opens a public page (Tôi → help, about,
// papers) it adds `?from=app`. This script, a blocking classic file in <head> like returning.js (the page's CSP
// forbids inline scripts), marks such a visit with `data-from-app` on <html>, and the stylesheet hides every link that
// leaves Tò He — the ones marked `data-out`: the developer docs, GitHub, the mailto — before the first paint. The
// visit is remembered in sessionStorage, so the pages the child reads next, which carry no `?from=app`, stay without a
// link out until the tab or the installed app's window closes. The PIN guards the links out inside the app itself.
// from-app.test.ts runs it.
(() => {
  const KEY = 'tohe:from-app';
  let fromApp = false;
  try {
    fromApp = new URLSearchParams(location.search).get('from') === 'app';
  } catch {
    // No address to read: nothing came from the app.
  }
  try {
    if (fromApp) sessionStorage.setItem(KEY, '1');
    else fromApp = sessionStorage.getItem(KEY) !== null;
  } catch {
    // Session storage blocked: the address alone decides, for this page.
  }
  if (fromApp) document.documentElement.setAttribute('data-from-app', '');
})();
