// Zod 4 compiles a faster parser with `new Function(…)` when the page allows it, and finds out by trying — which, under
// the hub's CSP (no 'unsafe-eval', ADR 0040), is refused and reported as a violation on every load of a screen that
// parses (the game's protocol on /play). `jitless` skips the probe and the compile: the schemas parse the same, a little
// slower, with nothing in the console. Imported first by main.tsx, before any schema runs. The public pages (apps/web)
// run Zod only at build time, never in a browser.
import { z } from 'zod';

z.config({ jitless: true });
