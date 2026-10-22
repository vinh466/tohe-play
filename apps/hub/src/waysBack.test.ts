// A way back on every screen (ADR 0046): an installed app on an iPhone has no Back, so a screen that is not a tab's root
// must draw its own "←" — the frame's `Screen` does it for every sub-screen of the frame (`backTarget`), and the full
// screen ones (a lobby, a table, an entry gate…) hold a `BackLink` themselves. This test goes over the router's routes
// and fails for a route that has neither the frame's tab root nor a way back, so a new screen cannot leave a child
// stuck. It reads the sources, as the other tests of the router do.
import { describe, expect, it } from 'vitest';
import { backTarget, ownBack, tabs } from './frame/tabs.ts';
import router from './router.tsx?raw';

const sources = import.meta.glob<string>(['./pages/*.tsx', './entry/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

interface Route {
  /** The route's path, `$gameId` and the like as `x`. */
  path: string;
  framed: boolean;
  /** The page's component name, and the text of the file that defines it. */
  component: string;
  source: string;
}

/** Each `createRoute({ … })` of router.tsx: its parent, its path and its component, and the page's source. */
function routes(): Route[] {
  const parts = router.split('createRoute({').slice(1);
  return parts.map((part) => {
    const body = part.split(/\n\}\);/)[0] ?? part;
    const path = /path: '([^']+)'/.exec(body)?.[1] ?? '';
    const lazy = /lazyRouteComponent\(\(\) => import\('\.\/pages\/\w+\.tsx'\), '(\w+)'\)/.exec(body)?.[1];
    const component = lazy ?? /component: (\w+)/.exec(body)?.[1] ?? '';
    const source =
      Object.values(sources).find((text) => new RegExp(`export function ${component}\\b`).test(text)) ?? '';
    return {
      path: path.replace(/\$\w+/g, 'x'),
      framed: /getParentRoute: \(\) => frameRoute/.test(body),
      component,
      source,
    };
  });
}

const all = routes().filter((route) => route.path !== '');
const roots = tabs.map((tab) => tab.to as string);

describe('a way back on every screen', () => {
  it('goes over every route of the router, each with the page that draws it', () => {
    expect(all.length).toBeGreaterThan(15);
    const unknown = all.filter((route) => route.source === '');
    expect(unknown.map((route) => `${route.path} (${route.component})`)).toEqual([]);
  });

  it('gives every screen of the frame that is not a tab’s root an arrow: the frame’s, or its own', () => {
    const framed = all.filter((route) => route.framed && !roots.includes(route.path));
    expect(framed.length).toBeGreaterThan(8);
    const stuck = framed.filter(
      (route) =>
        backTarget(route.path) === null &&
        !(ownBack.includes(route.path) && /<BackLink\b/.test(route.source)),
    );
    expect(
      stuck.map((route) => route.path),
      'add the screen to backTarget in frame/tabs.ts',
    ).toEqual([]);
  });

  it('draws no arrow on a tab’s root, which the bar already is', () => {
    for (const root of roots) expect(backTarget(root), root).toBeNull();
  });

  it('leads each arrow to a screen of the frame, and down to a tab’s root without a loop', () => {
    const framedPaths = new Set(all.filter((route) => route.framed).map((route) => route.path));
    for (const route of all.filter((candidate) => candidate.framed)) {
      const seen = new Set<string>();
      for (let at: string | null = backTarget(route.path); at !== null; at = backTarget(at)) {
        expect(framedPaths.has(at), `${route.path} → ${at}`).toBe(true);
        expect(seen.has(at), `${route.path} loops at ${at}`).toBe(false);
        seen.add(at);
      }
    }
  });

  it('has a BackLink in every screen outside the frame: a game’s lobby, a table, a replay, the entry pages', () => {
    const full = all.filter((route) => !route.framed);
    expect(full.length).toBeGreaterThan(4);
    const stuck = full.filter((route) => !/<BackLink\b/.test(route.source));
    expect(stuck.map((route) => `${route.path} (${route.component})`)).toEqual([]);
  });

  it('draws the frame’s arrow in Screen, and an unframed gate or form passes its own `back`', () => {
    const screen = Object.entries(
      import.meta.glob<string>('./ui/Screen.tsx', { query: '?raw', import: 'default', eager: true }),
    )[0]?.[1];
    expect(screen).toMatch(/FrameBackContext/);
    expect(screen).toMatch(/<BackLink/);
    // The guest's naming form — the rooms lobby, a table or a link's gate for a device profile — has a way out.
    const atTables = import.meta.glob<string>('./session/AtTables.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.values(atTables)[0]).toMatch(/<Screen narrow back="\/play">\s*\{content\}/);
  });
});
