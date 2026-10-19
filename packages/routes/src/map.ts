// The map of Tò He's hosts and of the namespaces on the hub's host and the console's (ADR 0042,
// docs/architecture/hosts-and-paths.md). It is the one place a path prefix is given to a component: the Caddy routes of
// both hosts, the service worker's list of app pages, robots.txt and the API's links to the hub and the console are
// generated from it (scripts/generate.ts). A new namespace is one entry here, reviewed; a new host needs an ADR.

/** A host's role. Hosts come from configuration (`publicUrls`), never from code: this names roles, not addresses. */
export type HostRole =
  | 'hub'
  | 'console'
  | 'games'
  | 'docs'
  | 'status'
  | 'notify'
  | 'www'
  | 'api'
  | 'account'
  | 'studio'
  | 'media'
  | 'uat';

export interface Host {
  role: HostRole;
  /** The label in front of the domain in production: '' for the root, 'games' for games.toheplay.io.vn. */
  label: string;
  /** `serving`: runs today; `decided`: decided in ADR 0042, not running yet; `reserved`: kept for later, no DNS. */
  state: 'serving' | 'decided' | 'reserved';
  purpose: string;
}

export const hosts: readonly Host[] = [
  {
    role: 'hub',
    label: '',
    state: 'serving',
    purpose: 'Players: the public pages, the app, the API',
  },
  { role: 'games', label: 'games', state: 'serving', purpose: 'Game code, untrusted (ADR 0002, 0040)' },
  {
    role: 'docs',
    label: 'docs',
    state: 'serving',
    purpose: 'Developer documentation, at the root of the host',
  },
  {
    role: 'console',
    label: 'console',
    state: 'serving',
    purpose: 'Operators: the console and the API’s console routes, behind Cloudflare Access',
  },
  {
    role: 'status',
    label: 'status',
    state: 'decided',
    purpose: 'The status page, outside Tò He’s infrastructure',
  },
  { role: 'notify', label: 'notify', state: 'decided', purpose: 'Sends transactional mail; no web' },
  { role: 'www', label: 'www', state: 'serving', purpose: 'A redirect to the root' },
  { role: 'api', label: 'api', state: 'reserved', purpose: 'Only for a public API with keys' },
  {
    role: 'account',
    label: 'account',
    state: 'reserved',
    purpose: 'One sign-in shared by three or more origins',
  },
  { role: 'studio', label: 'studio', state: 'reserved', purpose: 'Tools for making games' },
  { role: 'media', label: 'media', state: 'reserved', purpose: 'Files people upload' },
  { role: 'uat', label: 'uat', state: 'reserved', purpose: 'UAT’s names, once it has HTTPS' },
];

/** Who owns a namespace on the hub's host or the console's. */
export type Component = 'public' | 'app' | 'console' | 'api' | 'platform';

/**
 * How a namespace is served:
 * - `page`: a single-page app's page (its index.html), whatever the path under the namespace;
 * - `static`: files from the image, as they are;
 * - `proxy`: passed to a service behind the hub (the API);
 * - `generated`: written by the platform — at build time (robots.txt) or by Caddy at run time (security.txt);
 * - `redirect`: answered with a temporary redirect to `redirectTo` (a placeholder until a page of its own arrives; no
 *   namespace is one today).
 */
export type Served = 'page' | 'static' | 'proxy' | 'generated' | 'redirect';

/**
 * Which paths a namespace covers:
 * - `exact`: only `path`;
 * - `tree`: `path` and everything under `path/` (`/account` covers `/account` and `/account/email`, not `/accounts`);
 * - `prefix`: every path that starts with `path` — only for files with hashed names (`/workbox-<hash>.js`).
 */
export type Match = 'exact' | 'tree' | 'prefix';

export interface Namespace {
  /** A short name, unique in the map. */
  id: string;
  path: string;
  match: Match;
  component: Component;
  served: Served;
  /** Search engines may index it (`X-Robots-Tag` otherwise says `noindex`). Only public pages are indexed. */
  indexed: boolean;
  /** robots.txt lets crawlers fetch it. A page that is not indexed must stay crawlable, or its noindex is never seen. */
  crawl: boolean;
  /**
   * How the hub's service worker treats a navigation to it: `app-shell` answers with the cached app page (it works
   * offline); `network` leaves it to the network.
   */
  navigation: 'app-shell' | 'network';
  /** Static files only: `immutable` for hashed names, cached for a year; `revalidate` for the rest. */
  cache?: 'immutable' | 'revalidate';
  /** Redirects only: where the namespace's path leads, with a 302 (the query is kept). */
  redirectTo?: string;
  note: string;
}

const appPage = (id: string, path: string, note: string, match: Match = 'tree'): Namespace => ({
  id,
  path,
  match,
  component: 'app',
  served: 'page',
  indexed: false,
  crawl: true,
  navigation: 'app-shell',
  note,
});

const appFile = (
  id: string,
  path: string,
  match: Match,
  cache: 'immutable' | 'revalidate',
  note: string,
): Namespace => ({
  id,
  path,
  match,
  component: 'app',
  served: 'static',
  indexed: false,
  crawl: true,
  navigation: 'network',
  cache,
  note,
});

/**
 * The hub's host (ADR 0042): the public pages own the root (apps/web), the app owns /play and /account (and the short
 * link /r/). The console has a host of its own (consoleNamespaces).
 */
export const hubNamespaces: readonly Namespace[] = [
  // The API, on the players' origin (the backend-for-frontend pattern).
  {
    id: 'api',
    path: '/api',
    match: 'tree',
    component: 'api',
    served: 'proxy',
    indexed: false,
    crawl: false,
    navigation: 'network',
    note: 'The API, proxied on the same origin',
  },
  // The public pages (apps/web), built into the hub image and served from /srv/web. Not app pages, so the service
  // worker leaves them to the network. Their CSP allows no inline script: scripts are files under /_web/.
  {
    id: 'home',
    path: '/',
    match: 'exact',
    component: 'public',
    served: 'static',
    indexed: true,
    crawl: true,
    navigation: 'network',
    cache: 'revalidate',
    note: 'The public home page (Vietnamese); a browser that has played here is sent on to /play',
  },
  {
    id: 'public-assets',
    path: '/_web',
    match: 'tree',
    component: 'public',
    served: 'static',
    indexed: false,
    crawl: true,
    navigation: 'network',
    cache: 'immutable',
    note: 'Scripts, styles and images the public pages’ build adds, with hashed names',
  },

  // The app's pages (apps/hub/src/router.tsx): only game ids under /play, everything of a person under /account.
  appPage(
    'play',
    '/play',
    'The catalog (/play), a game (/play/<gameId>), its online rooms (/play/<gameId>/rooms), a room (…/rooms/<roomId>) and a hand played again (…/rooms/<roomId>/replay/<hand>)',
  ),
  appPage(
    'account',
    '/account',
    'A person’s pages: /account/sign-in (and /continue), /register (and /confirm), /password/forgot, /password/reset, /profiles, /data; the account itself at /account and /account/email',
  ),
  appPage('room-link', '/r', 'A room’s short link: /r/<code>'),
  // Rendered by the app for now; the public pages’ pull request serves them as static pages at the same URLs.
  appPage('terms', '/terms', 'The terms of use', 'exact'),
  appPage('privacy', '/privacy', 'The privacy notice', 'exact'),

  // The app's files (apps/hub/public and what the build adds).
  appFile('assets', '/assets', 'tree', 'immutable', 'Scripts, styles and images with hashed names'),
  appFile(
    'index',
    '/index.html',
    'exact',
    'revalidate',
    'The app page itself, which the service worker caches',
  ),
  appFile('manifest', '/manifest.webmanifest', 'exact', 'revalidate', 'The web app manifest'),
  appFile('service-worker', '/sw.js', 'exact', 'revalidate', 'The service worker'),
  appFile('register-sw', '/registerSW.js', 'exact', 'revalidate', 'Registers the service worker'),
  appFile('workbox', '/workbox-', 'prefix', 'revalidate', 'The service worker’s runtime, /workbox-<hash>.js'),
  appFile('theme-init', '/theme-init.js', 'exact', 'revalidate', 'Light or dark before the first paint'),
  appFile('favicon', '/favicon.svg', 'exact', 'revalidate', 'The icon in browser tabs'),
  appFile('apple-touch-icon', '/apple-touch-icon.png', 'exact', 'revalidate', 'The home-screen icon on iOS'),
  appFile('icon-192', '/icon-192.png', 'exact', 'revalidate', 'The app icon'),
  appFile('icon-512', '/icon-512.png', 'exact', 'revalidate', 'The app icon, large and maskable'),

  // The platform's files.
  {
    id: 'robots',
    path: '/robots.txt',
    match: 'exact',
    component: 'platform',
    served: 'generated',
    indexed: false,
    crawl: true,
    navigation: 'network',
    note: 'Generated from this map',
  },
  {
    id: 'sitemap',
    path: '/sitemap.xml',
    match: 'exact',
    component: 'platform',
    served: 'generated',
    indexed: false,
    crawl: true,
    navigation: 'network',
    note: 'The indexed public pages, with absolute URLs from TOHE_HUB_URL, written by the hub’s Caddy',
  },
  {
    id: 'well-known',
    path: '/.well-known',
    match: 'tree',
    component: 'platform',
    served: 'generated',
    indexed: false,
    crawl: true,
    navigation: 'network',
    note: 'security.txt (RFC 9116), written by the hub’s Caddy',
  },
];

const consolePage = (id: string, path: string, note: string, match: Match = 'exact'): Namespace => ({
  id,
  path,
  match,
  component: 'console',
  served: 'page',
  indexed: false,
  crawl: true,
  navigation: 'network',
  note,
});

const consoleFile = (
  id: string,
  path: string,
  match: Match,
  cache: 'immutable' | 'revalidate',
  note: string,
): Namespace => ({
  id,
  path,
  match,
  component: 'console',
  served: 'static',
  indexed: false,
  crawl: true,
  navigation: 'network',
  cache,
  note,
});

/**
 * The console's host (ADR 0027, 0042): a second site of the hub image's Caddy, on a port of its own. Its app at the
 * root, the API's console routes and nothing else — no service worker, no robots.txt, never indexed; any other path is
 * a 404. The API's player routes are not served here: the console's session authenticates nothing outside them.
 */
export const consoleNamespaces: readonly Namespace[] = [
  {
    id: 'console-api',
    path: '/api/admin',
    match: 'tree',
    component: 'api',
    served: 'proxy',
    indexed: false,
    crawl: true,
    navigation: 'network',
    note: 'The API’s console routes: signing in to the console, its session and its pages’ data',
  },

  // The console's pages (apps/console/src/router.tsx); signing in is shown in place of any of them.
  consolePage('overview', '/', 'Tổng quan, the platform at a glance'),
  consolePage('games', '/games', 'Every game in the registry'),
  consolePage('health', '/health', 'Device telemetry'),
  consolePage('system', '/system', 'The running deployment'),
  consolePage('users', '/users', 'Accounts found (/users), one account (/users/<id>)', 'tree'),
  consolePage('review', '/review', 'Held and decided results (/review), one result (/review/<id>)', 'tree'),
  consolePage('communities', '/communities', 'Communities and their invite codes'),
  consolePage('settings', '/settings', 'Sign-in methods and the registration mode'),
  consolePage('audit', '/audit', 'The audit log'),
  consolePage('security', '/security', 'The operator’s own two-factor authentication'),
  consolePage('setup', '/setup', 'Where a new deployment’s first owner claims it'),

  // The console's files (apps/console/public and what the build adds).
  consoleFile('console-assets', '/assets', 'tree', 'immutable', 'Scripts and styles with hashed names'),
  consoleFile('console-index', '/index.html', 'exact', 'revalidate', 'The console page itself'),
  consoleFile(
    'console-theme-init',
    '/theme-init.js',
    'exact',
    'revalidate',
    'Light or dark before the first paint',
  ),
  consoleFile('console-favicon', '/favicon.svg', 'exact', 'revalidate', 'The icon in browser tabs'),
];

/**
 * The console's pages and routes the API names — in its log when a deployment has no owner yet, and where it serves
 * the console's routes. The C# class ConsolePaths is generated from these.
 */
export const consoleLinks = {
  Setup: { path: '/setup', note: 'Where a new deployment’s first owner claims it' },
  Api: { path: '/api/admin', note: 'The API’s console routes, served only on the console’s host' },
} as const satisfies Record<string, { path: string; note: string }>;

/**
 * The hub's pages the API links and redirects to — in emails and after a sign-in with a provider. Queries are added
 * by the API. The C# class HubPaths is generated from these.
 */
export const hubLinks = {
  Welcome: {
    path: '/account/sign-in',
    note: 'The sign-in screen; ?external= after a provider, ?deleting= after a deletion',
  },
  SignInContinue: {
    path: '/account/sign-in/continue',
    note: 'One more step after a provider, the first time',
  },
  RegisterConfirm: {
    path: '/account/register/confirm',
    note: 'The link in the sign-up email: ?attempt=&code=',
  },
  PasswordReset: { path: '/account/password/reset', note: 'The link in the password email: ?attempt=&code=' },
  AccountEmail: { path: '/account/email', note: 'The link that confirms a new address: ?attempt=&code=' },
  Account: { path: '/account', note: 'The account page; ?linked= or ?link_error= after linking a provider' },
  Profiles: {
    path: '/account/profiles',
    note: 'The profile picker; ?auto=true goes straight on with one profile',
  },
} as const satisfies Record<string, { path: string; note: string }>;

/**
 * An old path of the app that answers 301 to its new one, the query kept. `from` and `to` may share `:name` segments
 * (one path segment each); with `tree`, `from` also covers what follows it (`/register/confirm`) and `to` takes it over.
 */
export interface Redirect {
  /** A short name, unique in the map: it names the Caddy matcher. */
  id: string;
  from: string;
  to: string;
  tree: boolean;
  note: string;
}

/**
 * The paths the app had at the root before ADR 0042 moved it under /play and /account. They are kept for the links in
 * emails already sent and for bookmarks; no date is set for removing them. /room/<id> and /replay/… are not here: they
 * are only reached from inside the app and need a game id that an old link does not carry, so they are a 404.
 * No `from` may lie in a namespace of the map (a test checks it).
 */
export const hubRedirects: readonly Redirect[] = [
  { id: 'welcome', from: '/welcome', to: '/account/sign-in', tree: false, note: 'Signing in' },
  {
    id: 'signIn',
    from: '/sign-in',
    to: '/account/sign-in',
    tree: true,
    note: 'Back from a provider: /sign-in/continue',
  },
  {
    id: 'register',
    from: '/register',
    to: '/account/register',
    tree: true,
    note: 'Signing up, and the link in the sign-up email: /register/confirm',
  },
  {
    id: 'password',
    from: '/password',
    to: '/account/password',
    tree: true,
    note: 'A forgotten password, and the link in the password email: /password/reset',
  },
  { id: 'profiles', from: '/profiles', to: '/account/profiles', tree: false, note: 'The profile picker' },
  { id: 'data', from: '/data', to: '/account/data', tree: false, note: 'What telemetry sends' },
  { id: 'terms', from: '/legal/terms', to: '/terms', tree: false, note: 'The terms of use' },
  { id: 'privacy', from: '/legal/privacy', to: '/privacy', tree: false, note: 'The privacy notice' },
  {
    id: 'rooms',
    from: '/rooms/:gameId',
    to: '/play/:gameId/rooms',
    tree: false,
    note: 'A game’s online rooms',
  },
];
