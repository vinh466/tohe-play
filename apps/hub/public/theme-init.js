// Runs before the first paint (a blocking script in <head>, served from our origin as the CSP requires) and applies
// the saved light/dark choice, so a dark hub never flashes white. Mirrors src/theme/theme.ts — theme.test.ts keeps
// the two in step — and the app takes over once it starts.
(() => {
  const saved = /(?:^|;\s*)tohe-theme=(light|dark)(?:;|$)/.exec(document.cookie);
  const deviceDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved ? saved[1] : deviceDark ? 'dark' : 'light';
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#17110e' : '#f97316');
})();
