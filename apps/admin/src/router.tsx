import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AuditPage } from './pages/AuditPage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { HEALTH_DAYS, HealthPage } from './pages/HealthPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { SecurityPage } from './pages/SecurityPage.tsx';
import { Shell } from './pages/Shell.tsx';
import { SystemPage } from './pages/SystemPage.tsx';

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

/** The console lives under /admin/ on the hub's origin (ADR 0027). */
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    overviewRoute,
    gamesRoute,
    healthRoute,
    systemRoute,
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
