import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { canonicalEntry } from './entry/codes.ts';
import { AppFrame } from './frame/AppFrame.tsx';
import { AccountEmailPage } from './pages/AccountEmailPage.tsx';
import { AccountPage, type AccountSearch } from './pages/AccountPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { ContinueSignInPage } from './pages/ContinueSignInPage.tsx';
import { DataPage } from './pages/DataPage.tsx';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPage.tsx';
import { ProfilesPage } from './pages/ProfilesPage.tsx';
import { ConfirmRegistrationPage, RegisterPage } from './pages/RegisterPage.tsx';
import { TogetherPage } from './pages/TogetherPage.tsx';
import { WelcomePage } from './pages/WelcomePage.tsx';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

/**
 * The app's frame (ADR 0046): the three tabs — Trò chơi, Chơi cùng, Tôi — around every screen of the Play zone but a
 * game in play, its lobby, a table, a replay and the links into them, which stay full screen (ADR 0020).
 */
const frameRoute = createRoute({ getParentRoute: () => rootRoute, id: '_frame', component: AppFrame });

const catalogRoute = createRoute({ getParentRoute: () => frameRoute, path: '/play', component: CatalogPage });
/** Chơi cùng: a code, the tables the player sits at, the invitations to them, the links they sent (ADR 0046). */
const togetherRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/together',
  component: TogetherPage,
});
const welcomeRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/sign-in',
  // ?external=failed: back from a provider that refused, or was cancelled (ADR 0026). ?deleting=<when>: the account
  // just asked to be deleted, and goes then (ADR 0034).
  validateSearch: (search: Record<string, unknown>): { external?: string; deleting?: string } => ({
    external: typeof search.external === 'string' ? search.external : undefined,
    deleting: typeof search.deleting === 'string' ? search.deleting : undefined,
  }),
  component: WelcomePage,
});
/** Back from a provider for the first time: one more step on this browser (ADR 0026). */
const continueSignInRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/sign-in/continue',
  component: ContinueSignInPage,
});
const registerRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/register',
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
  getParentRoute: () => frameRoute,
  path: '/account/register/confirm',
  validateSearch: codeLink,
  component: ConfirmRegistrationPage,
});
const forgotPasswordRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/password/forgot',
  component: ForgotPasswordPage,
});
const resetPasswordRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/password/reset',
  validateSearch: codeLink,
  component: ResetPasswordPage,
});
const accountEmailRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/email',
  validateSearch: codeLink,
  component: AccountEmailPage,
});
const profilesRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/profiles',
  // ?auto=true when the hub sent someone here to pick a player: an account with one profile and no PIN plays at once
  // (D-01). Opened by hand ("Đổi người chơi"), the picker always shows, to add profiles or manage the account.
  validateSearch: (search: Record<string, unknown>): { auto?: boolean } => ({
    auto: search.auto === true || search.auto === 'true' ? true : undefined,
  }),
  component: ProfilesPage,
});
/**
 * Tôi (ADR 0046), and Quản lý tài khoản behind the parent gate with `?manage=true`. ?add=true opens the "new profile"
 * form right after the gate; ?linked= and ?link_error= come back from linking a provider (ADR 0026) — both are
 * Quản lý tài khoản's too.
 */
const accountRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account',
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    manage: search.manage === true || search.manage === 'true' ? true : undefined,
    add: search.add === true || search.add === 'true' ? true : undefined,
    linked: typeof search.linked === 'string' ? search.linked : undefined,
    link_error: typeof search.link_error === 'string' ? search.link_error : undefined,
  }),
  component: AccountPage,
});

// The terms of use and the privacy notice are static pages of apps/web (/terms/, /privacy/), rendered from
// ./legal/documents.ts; the app links to them with a full navigation (ADR 0042).

/**
 * The transfer code (ADR 0043, I2b): the new device redeems one here — six digits, a QR code scanned, or the QR code's
 * link, its secret after `#` — and the old device shows one for a device profile (`?profile=`). Loaded on demand (QR
 * codes, the camera).
 */
const transferRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/transfer',
  component: lazyRouteComponent(() => import('./pages/TransferPage.tsx'), 'TransferReceivePage'),
});
const transferSendRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/transfer/send',
  validateSearch: (search: Record<string, unknown>): { profile: string } => ({
    profile: typeof search.profile === 'string' ? search.profile : '',
  }),
  component: lazyRouteComponent(() => import('./pages/TransferPage.tsx'), 'TransferSendPage'),
});

/** "Link của tôi" (ADR 0044): the share links the profile playing made, their counts, a new expiry, revoking. */
const linksRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/links',
  component: lazyRouteComponent(() => import('./pages/LinksPage.tsx'), 'LinksPage'),
});

/** What telemetry sends, this device's switch and the last batch (ADR 0015); open to everyone. */
const dataRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/account/data',
  component: DataPage,
});

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId',
  // The launcher pulls in the protocol validator (Zod); keep it out of the catalog's first load.
  component: lazyRouteComponent(() => import('./pages/PlayPage.tsx'), 'PlayPage'),
});

/** Online rooms (ADR 0016): a game's lobby, a room link, and a room. Loaded on demand (SignalR, QR codes). */
const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId/rooms',
  component: lazyRouteComponent(() => import('./pages/RoomsPage.tsx'), 'RoomsPage'),
});
/**
 * The entry pipeline (ADR 0044): a table's link and a share link. A person sent on from a link preview's card arrives
 * with `?app=1`, which means nothing here: the address drops it, and takes the code in its canonical form.
 */
const noSearch = (): Record<string, never> => ({});
const roomLinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/r/$code',
  validateSearch: noSearch,
  beforeLoad: ({ params, search }) => {
    const canonical = canonicalEntry('room', params.code, search);
    if (canonical) throw redirect({ to: '/r/$code', params: canonical, search: {}, replace: true });
  },
  component: lazyRouteComponent(() => import('./pages/EntryPage.tsx'), 'RoomEntryPage'),
});
const shareLinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/s/$code',
  validateSearch: noSearch,
  beforeLoad: ({ params, search }) => {
    const canonical = canonicalEntry('share', params.code, search);
    if (canonical) throw redirect({ to: '/s/$code', params: canonical, search: {}, replace: true });
  },
  component: lazyRouteComponent(() => import('./pages/EntryPage.tsx'), 'ShareEntryPage'),
});
const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId/rooms/$roomId',
  component: lazyRouteComponent(() => import('./pages/RoomPage.tsx'), 'RoomPage'),
});

const replayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$gameId/rooms/$roomId/replay/$hand',
  component: lazyRouteComponent(() => import('./pages/ReplayPage.tsx'), 'ReplayPage'),
});

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      frameRoute.addChildren([
        catalogRoute,
        togetherRoute,
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
        transferRoute,
        transferSendRoute,
        linksRoute,
      ]),
      playRoute,
      roomsRoute,
      roomLinkRoute,
      shareLinkRoute,
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
