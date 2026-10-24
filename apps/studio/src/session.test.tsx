import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StudioMe } from './api/client.ts';
import { Shell } from './pages/Shell.tsx';
import { routeTree, signInSearch } from './router.tsx';
import { meKey } from './security/Gate.tsx';

/**
 * What a page of the Studio asks the API for, rendered at `path` once the router has matched it: every query the
 * render starts, by its key — ['studio', 'packs'] is GET /api/studio/packs. `me` is who the Studio's session says is
 * signed in: null for nobody, undefined while the answer is still on its way.
 */
async function render(path: string, me?: StudioMe | null) {
  const queryClient = new QueryClient();
  if (me !== undefined) queryClient.setQueryData(meKey, me);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const queries = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey.join('/'))
    .sort();
  return { html, queries, search: router.state.matches.at(-1)?.search as Record<string, unknown> };
}

const signedIn = {
  accountId: '0b7c5e1a-2f9d-4c1e-9a7b-3d2e1f0a9b8c',
  displayName: 'Cô Ba',
  email: 'co-ba@tohe.test',
  role: 'reviewer',
  permissions: ['studio.read', 'studio.contribute', 'studio.review'],
  twoFactorEnabled: true,
  openUntil: '2026-10-24T20:00:00Z',
  secureUntil: null,
} satisfies StudioMe;

// Asked before anyone signs in, and answered then without a 401: the API's anonymous Studio routes.
const anonymous = ['studio/config', 'studio/me'];

const behindTheSession = (queries: string[]) => queries.filter((query) => !anonymous.includes(query));

describe('the Studio asks for nothing behind its session without one', () => {
  it('asks only who is signed in, and the hub’s address, at /sign-in', async () => {
    const { queries, html } = await render('/sign-in', null);
    expect(behindTheSession(queries)).toEqual([]);
    expect(queries).toContain('studio/config');
    expect(html).toContain('Đăng nhập');
  });

  it('asks only who is signed in at a page while the answer is on its way', async () => {
    const { queries } = await render('/');
    expect(queries).toContain('studio/me');
    expect(behindTheSession(queries)).toEqual([]);
  });

  it('asks for nothing of the library without a session, on every page', async () => {
    for (const path of [
      '/',
      '/packs/farm-crops',
      '/packs/farm-crops/0b7c',
      '/styles',
      '/styles/tohe-pixel',
    ]) {
      const { queries, html } = await render(path, null);
      expect(behindTheSession(queries), path).toEqual([]);
      expect(html, path).not.toContain('Thư viện');
    }
  });

  it('keeps only a page of this host as where the sign-in goes back to', async () => {
    expect((await render('/sign-in?redirect=%2Fpacks%2Ffarm-crops', null)).search).toEqual({
      redirect: '/packs/farm-crops',
    });
    // A refused one is replaced, key and all — the root's raw query would carry it on otherwise.
    for (const unsafe of ['//evil.example', 'https://evil.example', '/\\evil.example', '/sign-in']) {
      expect(signInSearch({ redirect: unsafe }), unsafe).toHaveProperty('redirect', undefined);
    }
    expect(signInSearch({})).toHaveProperty('redirect', undefined);
  });

  // Which pages the shell guards is the router's tree, not a test of the URL: the URL changes before the router has
  // matched the next page, so a page outside the shell would render for a moment on the way to /sign-in.
  it('keeps every page but /sign-in inside the shell', () => {
    type Node = { fullPath: string; options: { component?: unknown }; parentRoute?: Node; isRoot?: boolean };
    const routes = Object.values(createRouter({ routeTree }).routesById) as unknown as Node[];
    const insideShell = (route: Node): boolean =>
      route.parentRoute
        ? route.parentRoute.options.component === Shell || insideShell(route.parentRoute)
        : false;
    const pages = routes.filter((route) => !route.isRoot && route.options.component !== Shell);
    expect(pages.length).toBeGreaterThan(4);
    expect(pages.filter((route) => !insideShell(route)).map((route) => route.fullPath)).toEqual(['/sign-in']);
  });

  it('asks for the page once signed in', async () => {
    expect(behindTheSession((await render('/', signedIn)).queries)).toEqual(['studio/packs']);
    expect(behindTheSession((await render('/styles', signedIn)).queries)).toEqual(['studio/styles']);
    expect(behindTheSession((await render('/styles/tohe-pixel', signedIn)).queries)).toEqual([
      'studio/style/tohe-pixel',
    ]);
    expect(behindTheSession((await render('/packs/farm-crops', signedIn)).queries)).toEqual([
      'studio/pack/farm-crops',
    ]);
    expect(behindTheSession((await render('/packs/farm-crops/0b7c', signedIn)).queries)).toEqual([
      'studio/version/0b7c',
    ]);
  });

  it('shows who is signed in, and a way out, once signed in', async () => {
    const { html } = await render('/', signedIn);
    expect(html).toContain('Cô Ba');
    expect(html).toContain('Người duyệt');
    expect(html).toContain('Đăng xuất');
  });
});
