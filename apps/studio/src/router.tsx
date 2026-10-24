import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { safeRedirect } from './format.ts';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { PackPage } from './pages/PackPage.tsx';
import { Shell } from './pages/Shell.tsx';
import { StylePage, StylesPage } from './pages/StylesPage.tsx';
import { VersionPage } from './pages/VersionPage.tsx';
import { Centered, SignInPage } from './security/Gate.tsx';

function NotFound() {
  return (
    <Centered>
      <p className="text-ink">Không có trang này.</p>
      <Link to="/" className="font-semibold text-brand-ink underline underline-offset-4">
        Về thư viện
      </Link>
    </Centered>
  );
}

const rootRoute = createRootRoute({ component: Outlet, notFoundComponent: NotFound });

/**
 * The sign-in's query: `redirect`, the page to go back to — a page of this host only. Always the key, even when it is
 * refused: the root passes the raw query on, and only a value here replaces it (the router then drops it from the URL).
 */
export const signInSearch = (search: Record<string, unknown>): { redirect?: string | undefined } => ({
  redirect: safeRedirect(search.redirect),
});

// The Studio's own sign-in (ADR 0051).
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: signInSearch,
  component: function SignInRoute() {
    const { redirect } = signInRoute.useSearch();
    return <SignInPage redirect={safeRedirect(redirect)} />;
  },
});

/**
 * Every other page sits behind the Studio's session: a layout without a path of its own, which sends the browser to the
 * sign-in without one. A route of the tree rather than a test of the URL, so no page renders — and asks the API for
 * anything — before the router has matched it under the shell.
 */
const sessionRoute = createRoute({ getParentRoute: () => rootRoute, id: '_session', component: Shell });

const libraryRoute = createRoute({ getParentRoute: () => sessionRoute, path: '/', component: LibraryPage });
const packRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/packs/$packId',
  component: PackPage,
});
const versionRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/packs/$packId/$versionId',
  component: VersionPage,
});
const stylesRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/styles',
  component: StylesPage,
});
const styleRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/styles/$styleId',
  component: StylePage,
});

/**
 * The Studio lives at the root of a host of its own (ADR 0051); every path here is a namespace of the Studio's host in
 * @tohe/routes, and the Studio's Caddy site answers 404 to any other (studio.test.ts checks it).
 */
export const routeTree = rootRoute.addChildren([
  signInRoute,
  sessionRoute.addChildren([libraryRoute, packRoute, versionRoute, stylesRoute, styleRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
