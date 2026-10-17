import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { AccountEmailPage } from './pages/AccountEmailPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { ContinueSignInPage } from './pages/ContinueSignInPage.tsx';
import { DataPage } from './pages/DataPage.tsx';
import { PrivacyPage, TermsPage } from './pages/LegalPage.tsx';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPage.tsx';
import { ProfilesPage } from './pages/ProfilesPage.tsx';
import { ConfirmRegistrationPage, RegisterPage } from './pages/RegisterPage.tsx';
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
  // ?external=failed: back from a provider that refused, or was cancelled (ADR 0026).
  validateSearch: (search: Record<string, unknown>): { external?: string } => ({
    external: typeof search.external === 'string' ? search.external : undefined,
  }),
  component: WelcomePage,
});
/** Back from a provider for the first time: one more step on this browser (ADR 0026). */
const continueSignInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in/continue',
  component: ContinueSignInPage,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  // ?invite=CODE: a community's invite link (ADR 0028).
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite: typeof search.invite === 'string' ? search.invite : undefined,
  }),
  component: RegisterPage,
});

/**
 * A link in an email carries the attempt and its code (ADR 0024). The router reads "482913" as a number; the code is
 * text, so it is turned back.
 */
const codeLink = (search: Record<string, unknown>): { attempt: string; code: string } => ({
  attempt: String(search.attempt ?? ''),
  code: String(search.code ?? ''),
});

const confirmRegistrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register/confirm',
  validateSearch: codeLink,
  component: ConfirmRegistrationPage,
});
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/password/forgot',
  component: ForgotPasswordPage,
});
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/password/reset',
  validateSearch: codeLink,
  component: ResetPasswordPage,
});
const accountEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account/email',
  validateSearch: codeLink,
  component: AccountEmailPage,
});
const profilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profiles',
  // ?auto=true when the hub sent someone here to pick a player: an account with one profile and no PIN plays at once
  // (D-01). Opened by hand ("Đổi người chơi"), the picker always shows, to add profiles or manage the account.
  validateSearch: (search: Record<string, unknown>): { auto?: boolean } => ({
    auto: search.auto === true || search.auto === 'true' ? true : undefined,
  }),
  component: ProfilesPage,
});
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  // ?add=true opens the "new profile" form right after the parent gate. ?linked= and ?link_error= come back from
  // linking a provider (ADR 0026).
  validateSearch: (
    search: Record<string, unknown>,
  ): { add: boolean; linked?: string; link_error?: string } => ({
    add: search.add === true || search.add === 'true',
    linked: typeof search.linked === 'string' ? search.linked : undefined,
    link_error: typeof search.link_error === 'string' ? search.link_error : undefined,
  }),
  component: AccountPage,
});

/** The terms of use and the privacy notice, accepted at sign-up (ADR 0025); open to everyone. */
const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/legal/terms',
  component: TermsPage,
});
const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/legal/privacy',
  component: PrivacyPage,
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
      continueSignInRoute,
      registerRoute,
      confirmRegistrationRoute,
      forgotPasswordRoute,
      resetPasswordRoute,
      profilesRoute,
      accountRoute,
      accountEmailRoute,
      dataRoute,
      termsRoute,
      privacyRoute,
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
