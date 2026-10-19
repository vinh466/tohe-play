// The map of Tò He's hosts and of the namespaces on the hub's host (ADR 0042, docs/architecture/hosts-and-paths.md).
// It is the one place a path prefix is given to a component: the hub's Caddy routes, the service worker's list of app
// pages, robots.txt and the API's links to the hub are generated from it (scripts/generate.ts). A new namespace is one
// entry here, reviewed; a new host needs an ADR.

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
    purpose: 'Players: the app, the API (and the console until it moves)',
  },
  { role: 'games', label: 'games', state: 'serving', purpose: 'Game code, untrusted (ADR 0002, 0040)' },
  {
    role: 'docs',
    label: 'docs',
    state: 'serving',
    purpose: 'Developer documentation (and the landing page for now)',
  },
  {
    role: 'console',
    label: 'console',
    state: 'decided',
    purpose: 'Operators: the console, behind Cloudflare Access',
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

/** Who owns a namespace on the hub's host. */
export type Component = 'app' | 'console' | 'api' | 'platform';

/**
 * How a namespace is served:
 * - `page`: a single-page app's page (its index.html), whatever the path under the namespace;
 * - `static`: files from the image, as they are;
 * - `proxy`: passed to a service behind the hub (the API);
 * - `generated`: written by the platform — at build time (robots.txt) or by Caddy at run time (security.txt).
 */
export type Served = 'page' | 'static' | 'proxy' | 'generated';

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
  note: string;
}

const appPage = (id: string, path: string, note: string): Namespace => ({
  id,
  path,
  match: path === '/' ? 'exact' : 'tree',
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
 * The hub's host today (ADR 0040's layout): the app owns its prefixes at the root, the console is at /admin/. The next
 * steps of ADR 0042 move the app under /play and /account and the console to a host of its own.
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
  // The console (ADR 0027): its own app, built into the hub's image, until it moves to console.
  {
    id: 'console',
    path: '/admin',
    match: 'tree',
    component: 'console',
    served: 'page',
    indexed: false,
    crawl: false,
    navigation: 'network',
    note: 'The operator console, its own app with its own CSP and no service worker',
  },

  // The app's pages (apps/hub/src/router.tsx).
  appPage('catalog', '/', 'The catalog'),
  appPage('welcome', '/welcome', 'Signing in'),
  appPage('sign-in', '/sign-in', 'Back from a sign-in provider: /sign-in/continue'),
  appPage('register', '/register', 'Signing up: /register, /register/confirm'),
  appPage('password', '/password', 'A forgotten password: /password/forgot, /password/reset'),
  appPage('profiles', '/profiles', 'The profile picker'),
  appPage('account', '/account', 'The account: /account, /account/email'),
  appPage('legal', '/legal', 'The terms and the privacy notice: /legal/terms, /legal/privacy'),
  appPage('data', '/data', 'What telemetry sends'),
  appPage('play', '/play', 'A game: /play/<gameId>'),
  appPage('rooms', '/rooms', 'A game’s online rooms: /rooms/<gameId>'),
  appPage('room-link', '/r', 'A room’s short link: /r/<code>'),
  appPage('room', '/room', 'A room: /room/<roomId>'),
  appPage('replay', '/replay', 'A hand played again: /replay/<roomId>/<hand>'),

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

/**
 * The hub's pages the API links and redirects to — in emails and after a sign-in with a provider. Queries are added
 * by the API. The C# class HubPaths is generated from these.
 */
export const hubLinks = {
  Welcome: {
    path: '/welcome',
    note: 'The sign-in screen; ?external= after a provider, ?deleting= after a deletion',
  },
  SignInContinue: { path: '/sign-in/continue', note: 'One more step after a provider, the first time' },
  RegisterConfirm: { path: '/register/confirm', note: 'The link in the sign-up email: ?attempt=&code=' },
  PasswordReset: { path: '/password/reset', note: 'The link in the password email: ?attempt=&code=' },
  AccountEmail: { path: '/account/email', note: 'The link that confirms a new address: ?attempt=&code=' },
  Account: { path: '/account', note: 'The account page; ?linked= or ?link_error= after linking a provider' },
  Profiles: { path: '/profiles', note: 'The profile picker; ?auto=true goes straight on with one profile' },
  ConsoleSetup: { path: '/admin/setup', note: 'Where a new deployment’s first owner claims the console' },
} as const satisfies Record<string, { path: string; note: string }>;
