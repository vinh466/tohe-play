import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { CatalogPage } from './pages/CatalogPage.tsx';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: CatalogPage,
});

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId',
  // The launcher pulls in the protocol validator (Zod); keep it out of the catalog's first load.
  component: lazyRouteComponent(() => import('./pages/PlayPage.tsx'), 'PlayPage'),
});

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree: rootRoute.addChildren([catalogRoute, playRoute]),
    context: { queryClient },
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
