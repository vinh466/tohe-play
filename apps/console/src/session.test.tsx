import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminMe } from './api/client.ts';
import { Shell } from './pages/Shell.tsx';
import { routeTree } from './router.tsx';
import { meKey } from './security/Gate.tsx';

/**
 * What a page of the console asks the API for, rendered at `path` once the router has matched it: every query the
 * render starts, by its key — ['admin', 'overview'] is GET /api/admin/overview. `me` is who the console's session
 * says is signed in: null for nobody, undefined while the answer is still on its way.
 */
async function queriesAt(path: string, me?: AdminMe | null): Promise<string[]> {
  const queryClient = new QueryClient();
  if (me !== undefined) queryClient.setQueryData(meKey, me);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey.join('/'))
    .sort();
}

const signedIn = {
  displayName: 'Cô Ba',
  role: 'owner',
  permissions: ['admin.read'],
  openUntil: '2026-10-19T20:00:00Z',
  secureUntil: null,
} as unknown as AdminMe;

// Asked before anyone signs in, and answered then without a 401: the API's anonymous console routes.
const anonymous = ['admin/config', 'admin/me', 'admin/setup'];

const behindTheSession = (queries: string[]) => queries.filter((query) => !anonymous.includes(query));

describe('the console asks for nothing behind its session without one', () => {
  it('asks only for the setup at /setup', async () => {
    expect(await queriesAt('/setup')).toEqual(['admin/setup']);
  });

  it('asks only who is signed in at / while the answer is on its way', async () => {
    const queries = await queriesAt('/');
    expect(queries).toContain('admin/me');
    expect(behindTheSession(queries)).toEqual([]);
  });

  it('shows the sign-in at / and every other page without a session, asking only the anonymous routes', async () => {
    for (const path of ['/', '/games', '/users/abc', '/security']) {
      const queries = await queriesAt(path, null);
      expect(behindTheSession(queries), path).toEqual([]);
      // The sign-in's own question: whether the deployment still waits for its first owner.
      expect(queries, path).toContain('admin/setup');
    }
  });

  // Which pages the shell guards is the router's tree, not a test of the URL: the URL changes before the router has
  // matched the next page, so a page outside the shell would render for a moment on the way to /setup.
  it('keeps every page but /setup inside the shell', () => {
    type Node = { fullPath: string; options: { component?: unknown }; parentRoute?: Node; isRoot?: boolean };
    const routes = Object.values(createRouter({ routeTree }).routesById) as unknown as Node[];
    const insideShell = (route: Node): boolean =>
      route.parentRoute
        ? route.parentRoute.options.component === Shell || insideShell(route.parentRoute)
        : false;
    const pages = routes.filter((route) => !route.isRoot && route.options.component !== Shell);
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.filter((route) => !insideShell(route)).map((route) => route.fullPath)).toEqual(['/setup']);
  });

  it('asks for the page once signed in (so the test sees what a page asks for)', async () => {
    expect(behindTheSession(await queriesAt('/', signedIn))).toEqual(['admin/overview']);
    expect(behindTheSession(await queriesAt('/setup', signedIn))).toEqual([]);
  });
});
