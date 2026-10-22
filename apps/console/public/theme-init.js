// Applies the saved light/dark choice before the first paint, so a dark page never flashes white. Run it as a
// blocking script in <head>: the hub serves a copy from its own origin (its CSP forbids inline scripts), the site
// inlines it. Mirrors src/theme.ts — theme.test.ts keeps the two in step — and each page takes over once it starts.
(() => {
  const saved = /(?:^|;\s*)tohe-theme=(light|dark)(?:;|$)/.exec(document.cookie);
  const deviceDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved ? saved[1] : deviceDark ? 'dark' : 'light';
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  // Every theme-color tag, so a page with one per scheme (media="(prefers-color-scheme: …)") shows the chosen theme's
  // colour whichever scheme the device is in.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', theme === 'dark' ? '#17110e' : '#f97316');
  }
})();
