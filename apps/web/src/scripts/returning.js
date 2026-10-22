// Marks a browser that has already opened a game here, before the page paints, so every public page shows *Chơi tiếp*
// in its header — in place of *Chơi ngay* — and the home pages at the top too, at once, without a jump (ADR 0046,
// docs/architecture/surfaces.md). It never navigates: `/` never redirects, a link to it always shows it. Run it as a
// blocking classic script in <head>, like theme-init.js: the page's CSP forbids inline scripts, so it is a file under
// /_web/. It sets `data-returning` on <html>, and the stylesheet shows `.again` and `.continue` under it and hides
// `.new`.
//
// "Has played here" is one key the app keeps in this origin's localStorage, and writes when a game is opened (where the
// app notes "opened": apps/hub/src/launcher/recent.ts), not on every start:
//   tohe:returning
// A device from before this rule has no compatibility: its first game opened writes the key (the owner: "làm như mới").
// The session cookie is HttpOnly and cannot be read here. returning.test.ts reads the app's code to keep the name true.
(() => {
  try {
    if (localStorage.getItem('tohe:returning') !== null) {
      document.documentElement.setAttribute('data-returning', '');
    }
  } catch {
    // Storage blocked (private mode, cookies off): the page as a newcomer sees it.
  }
})();
