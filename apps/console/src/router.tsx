import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AuditPage } from './pages/AuditPage.tsx';
import { CommunitiesPage } from './pages/CommunitiesPage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { HEALTH_DAYS, HealthPage } from './pages/HealthPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { type ReviewList, ReviewPage } from './pages/ReviewPage.tsx';
import { ReviewResultPage } from './pages/ReviewResultPage.tsx';
import { SecurityPage } from './pages/SecurityPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { Root } from './pages/Shell.tsx';
import { SystemPage } from './pages/SystemPage.tsx';
import { UserPage } from './pages/UserPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { SetupPage } from './security/Gate.tsx';

// Every page but /setup sits behind the console's session: its shell shows the sign-in in its place without one.
const rootRoute = createRootRoute({ component: Root });

// A new deployment's first owner (ADR 0027), before anyone can sign in.
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/setup', component: SetupPage });

const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: OverviewPage });
const gamesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/games', component: GamesPage });
const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/health',
  validateSearch: (search: Record<string, unknown>): { days: number } => {
    const days = Number(search.days);
    return { days: HEALTH_DAYS.some((offered) => offered === days) ? days : 7 };
  },
  component: HealthPage,
});
const systemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/system',
  component: SystemPage,
});
const auditRoute = createRoute({ getParentRoute: () => rootRoute, path: '/audit', component: AuditPage });
const securityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/security',
  component: SecurityPage,
});
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  // ?deleting=true: only the accounts whose owner asked to delete them (ADR 0038).
  validateSearch: (search: Record<string, unknown>): { q: string; deleting?: boolean } => ({
    q: typeof search.q === 'string' ? search.q : '',
    deleting: search.deleting === true || search.deleting === 'true' ? true : undefined,
  }),
  component: UsersPage,
});
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$id',
  component: UserPage,
});
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  validateSearch: (search: Record<string, unknown>): { list: ReviewList } => ({
    list: search.list === 'decided' ? 'decided' : 'held',
  }),
  component: ReviewPage,
});
const reviewResultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review/$id',
  component: ReviewResultPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
const communitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/communities',
  component: CommunitiesPage,
});

/**
 * The console lives at the root of a host of its own (ADR 0042); every path here is a namespace of the console's host
 * in @tohe/routes, and the console's Caddy site answers 404 to any other (console.test.ts checks it).
 */
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    setupRoute,
    overviewRoute,
    gamesRoute,
    healthRoute,
    systemRoute,
    usersRoute,
    userRoute,
    reviewRoute,
    reviewResultRoute,
    communitiesRoute,
    settingsRoute,
    auditRoute,
    securityRoute,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
