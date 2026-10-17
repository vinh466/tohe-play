import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AuditPage } from './pages/AuditPage.tsx';
import { CommunitiesPage } from './pages/CommunitiesPage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { HEALTH_DAYS, HealthPage } from './pages/HealthPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { SecurityPage } from './pages/SecurityPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { Shell } from './pages/Shell.tsx';
import { SystemPage } from './pages/SystemPage.tsx';
import { UserPage } from './pages/UserPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';

const rootRoute = createRootRoute({ component: Shell });

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
const systemRoute = createRoute({ getParentRoute: () => rootRoute, path: '/system', component: SystemPage });
const auditRoute = createRoute({ getParentRoute: () => rootRoute, path: '/audit', component: AuditPage });
const securityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/security',
  component: SecurityPage,
});
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  validateSearch: (search: Record<string, unknown>): { q: string } => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
  component: UsersPage,
});
const userRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users/$id', component: UserPage });
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

/** The console lives under /admin/ on the hub's origin (ADR 0027). */
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    overviewRoute,
    gamesRoute,
    healthRoute,
    systemRoute,
    usersRoute,
    userRoute,
    communitiesRoute,
    settingsRoute,
    auditRoute,
    securityRoute,
  ]),
  basepath: '/admin',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
