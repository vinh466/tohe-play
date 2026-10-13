import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { FamilyPage } from './pages/FamilyPage.tsx';
import { ProfilesPage } from './pages/ProfilesPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { WelcomePage } from './pages/WelcomePage.tsx';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const catalogRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: CatalogPage });
const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  component: WelcomePage,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});
const profilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profiles',
  component: ProfilesPage,
});
const familyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/family',
  // ?add=true opens the "new child profile" form right after the parent gate.
  validateSearch: (search: Record<string, unknown>): { add: boolean } => ({
    add: search.add === true || search.add === 'true',
  }),
  component: FamilyPage,
});

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId',
  // The launcher pulls in the protocol validator (Zod); keep it out of the catalog's first load.
  component: lazyRouteComponent(() => import('./pages/PlayPage.tsx'), 'PlayPage'),
});

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      catalogRoute,
      welcomeRoute,
      registerRoute,
      profilesRoute,
      familyRoute,
      playRoute,
    ]),
    context: { queryClient },
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
