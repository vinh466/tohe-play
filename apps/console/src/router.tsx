import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { AuditPage } from './pages/AuditPage.tsx';
import { CommunitiesPage } from './pages/CommunitiesPage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { HEALTH_DAYS, HealthPage } from './pages/HealthPage.tsx';
import { LinksPage } from './pages/LinksPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { type ReviewList, ReviewPage } from './pages/ReviewPage.tsx';
import { ReviewResultPage } from './pages/ReviewResultPage.tsx';
import { SecurityPage } from './pages/SecurityPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { Shell } from './pages/Shell.tsx';
import { SystemPage } from './pages/SystemPage.tsx';
import { UserPage } from './pages/UserPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { SetupPage } from './security/Gate.tsx';

const rootRoute = createRootRoute({ component: Outlet });

// A new deployment's first owner (ADR 0027), before anyone can sign in.
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/setup', component: SetupPage });

/**
 * Every other page sits behind the console's session: a layout without a path of its own, whose shell shows the
 * sign-in in their place without one. A route of the tree rather than a test of the URL, so no page renders — and asks
 * the API for anything — before the router has matched it under the shell.
 */
const sessionRoute = createRoute({ getParentRoute: () => rootRoute, id: '_session', component: Shell });

const overviewRoute = createRoute({ getParentRoute: () => sessionRoute, path: '/', component: OverviewPage });
const gamesRoute = createRoute({ getParentRoute: () => sessionRoute, path: '/games', component: GamesPage });
const healthRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/health',
  validateSearch: (search: Record<string, unknown>): { days: number } => {
    const days = Number(search.days);
    return { days: HEALTH_DAYS.some((offered) => offered === days) ? days : 7 };
  },
  component: HealthPage,
});
const systemRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/system',
  component: SystemPage,
});
const auditRoute = createRoute({ getParentRoute: () => sessionRoute, path: '/audit', component: AuditPage });
const securityRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/security',
  component: SecurityPage,
});
const usersRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/users',
  // ?deleting=true: only the accounts whose owner asked to delete them (ADR 0038).
  validateSearch: (search: Record<string, unknown>): { q: string; deleting?: boolean } => ({
    q: typeof search.q === 'string' ? search.q : '',
    deleting: search.deleting === true || search.deleting === 'true' ? true : undefined,
  }),
  component: UsersPage,
});
const userRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/users/$id',
  component: UserPage,
});
const reviewRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/review',
  validateSearch: (search: Record<string, unknown>): { list: ReviewList } => ({
    list: search.list === 'decided' ? 'decided' : 'held',
  }),
  component: ReviewPage,
});
const reviewResultRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/review/$id',
  component: ReviewResultPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/settings',
  component: SettingsPage,
});
const communitiesRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/communities',
  component: CommunitiesPage,
});
const linksRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/links',
  // ?code=: the share link to find (ADR 0044).
  validateSearch: (search: Record<string, unknown>): { code: string } => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
  component: LinksPage,
});

/**
 * The console lives at the root of a host of its own (ADR 0042); every path here is a namespace of the console's host
 * in @tohe/routes, and the console's Caddy site answers 404 to any other (console.test.ts checks it).
 */
export const routeTree = rootRoute.addChildren([
  setupRoute,
  sessionRoute.addChildren([
    overviewRoute,
    gamesRoute,
    healthRoute,
    systemRoute,
    usersRoute,
    userRoute,
    reviewRoute,
    reviewResultRoute,
    communitiesRoute,
    linksRoute,
    settingsRoute,
    auditRoute,
    securityRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
