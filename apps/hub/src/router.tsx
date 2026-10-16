import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { DataPage } from './pages/DataPage.tsx';
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

/** What telemetry sends, this device's switch and the last batch (ADR 0015); open to everyone. */
const dataRoute = createRoute({ getParentRoute: () => rootRoute, path: '/data', component: DataPage });

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId',
  // The launcher pulls in the protocol validator (Zod); keep it out of the catalog's first load.
  component: lazyRouteComponent(() => import('./pages/PlayPage.tsx'), 'PlayPage'),
});

/** Online rooms (ADR 0016): a game's lobby, a room link, and a room. Loaded on demand (SignalR, QR codes). */
const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms/$gameId',
  component: lazyRouteComponent(() => import('./pages/RoomsPage.tsx'), 'RoomsPage'),
});
const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/r/$code',
  component: lazyRouteComponent(() => import('./pages/JoinPage.tsx'), 'JoinPage'),
});
const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/room/$roomId',
  component: lazyRouteComponent(() => import('./pages/RoomPage.tsx'), 'RoomPage'),
});

const replayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/replay/$roomId/$hand',
  component: lazyRouteComponent(() => import('./pages/ReplayPage.tsx'), 'ReplayPage'),
});

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      catalogRoute,
      welcomeRoute,
      registerRoute,
      profilesRoute,
      familyRoute,
      dataRoute,
      playRoute,
      roomsRoute,
      joinRoute,
      roomRoute,
      replayRoute,
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
