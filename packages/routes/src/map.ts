// The map of Tò He's hosts and of the namespaces on the hub's host, the console's and the Studio's (ADR 0042, 0051,
// docs/architecture/hosts-and-paths.md). It is the one place a path prefix is given to a component: the Caddy routes of
// the three hosts, the service worker's list of app pages, robots.txt and the API's links to the hub, the console and
// the Studio are generated from it (scripts/generate.ts). A new namespace is one entry here, reviewed; a new host needs an ADR.
import { englishPrefix, pathInLanguage, vietnameseOnlyPages } from './languages.ts';

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
  | 'assets'
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
  {
    role: 'studio',
    label: 'studio',
    state: 'decided',
    purpose: 'The Asset Studio: game assets made, checked and approved, with its own session (ADR 0051)',
  },
  {
    role: 'assets',
    label: 'assets',
    state: 'serving',
    purpose: 'The Studio’s published library: blobs/ and packs/ of its R2 bucket, nothing else (ADR 0054)',
  },
  { role: 'media', label: 'media', state: 'reserved', purpose: 'Files people upload' },
  { role: 'uat', label: 'uat', state: 'reserved', purpose: 'UAT’s names, once it has HTTPS' },
];

/** Who owns a namespace on the hub's host, the console's or the Studio's. */
export type Component = 'public' | 'app' | 'console' | 'studio' | 'api' | 'platform';

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
  /**
   * App pages only: `/<path>/<code>` asked by a link-preview crawler (`linkPreviewCrawlers`) is answered by the API's
   * card for it, `/api/previews/<path>/<code>`, rather than the app's page (ADR 0044).
   */
  linkPreview?: boolean;
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

/** A public page, or a tree of them, built by apps/web: HTML in /srv/web, indexed, listed in the sitemap (`publicPages`). */
const publicPage = (id: string, path: string, note: string): Namespace => ({
  id,
  path,
  match: 'tree',
  component: 'public',
  served: 'static',
  indexed: true,
  crawl: true,
  navigation: 'network',
  cache: 'revalidate',
  note,
});

/** A file of the public pages that is not a page: not in the sitemap, and the page's own CSP applies. */
const publicFile = (id: string, path: string, note: string): Namespace => ({
  id,
  path,
  match: 'exact',
  component: 'public',
  served: 'static',
  indexed: false,
  crawl: true,
  navigation: 'network',
  cache: 'revalidate',
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
 * links /r/ and /s/). The console has a host of its own (consoleNamespaces).
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
    note: 'The public home page (Vietnamese; the English one is /en/): the catalog first; it never redirects — a browser that has played here gets Chơi tiếp to /play (ADR 0046)',
  },
  publicPage(
    'game-pages',
    '/games',
    'The games (/games/) and one page for each (/games/<gameId>/) with its link-preview picture (/games/<gameId>/og.png), made from the game’s folder: game.json and page/ (ADR 0047)',
  ),
  publicPage('guides', '/guides', 'Guides: /guides/ and how to install the app, /guides/install/'),
  publicPage('faq', '/faq', 'Short answers to what people ask first'),
  publicPage('about', '/about', 'What Tò He is, who runs it, how to reach them'),
  publicPage(
    'promise',
    '/promise',
    'The promise: no ads, no tracking, nothing to buy, no coins — never (ADR 0047)',
  ),
  publicPage('terms', '/terms', 'The terms of use, rendered from apps/hub/src/legal/documents.ts'),
  publicPage('privacy', '/privacy', 'The privacy notice, rendered from apps/hub/src/legal/documents.ts'),
  publicPage(
    'en',
    englishPrefix,
    'The public pages in English (ADR 0047): /en/, /en/games/, /en/games/<gameId>/, /en/guides/… — the Vietnamese pages’ paths under /en, but for the Vietnamese-only ones (vietnameseOnlyPages)',
  ),
  publicFile(
    'og-image',
    '/og.png',
    'The 1200×630 picture every link preview shows (the pages’ and the app’s)',
  ),
  publicFile('llms', '/llms.txt', 'The public pages as a list for AI readers (llmstxt.org)'),
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
    'together',
    '/together',
    'Chơi cùng, the app frame’s second tab (ADR 0046): the code box, the tables a person sits at, the invitations to them and the links they sent',
  ),
  appPage(
    'account',
    '/account',
    'A person’s pages: /account/sign-in (and /continue), /register (and /confirm), /password/forgot, /password/reset, /profiles, /data, /transfer, the share links a profile made at /links (ADR 0044); the account itself at /account and /account/email',
  ),
  { ...appPage('room-link', '/r', 'A room’s short link: /r/<code>'), linkPreview: true },
  {
    ...appPage('share-link', '/s', 'A share link: /s/<code>, eight characters (ADR 0044)'),
    linkPreview: true,
  },

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
  appFile('workbox', '/workbox-', 'prefix', 'revalidate', 'The service worker’s runtime, /workbox-<hash>.js'),
  appFile('theme-init', '/theme-init.js', 'exact', 'revalidate', 'Light or dark before the first paint'),
  appFile('favicon', '/favicon.svg', 'exact', 'revalidate', 'The icon in browser tabs'),
  appFile('apple-touch-icon', '/apple-touch-icon.png', 'exact', 'revalidate', 'The home-screen icon on iOS'),
  appFile('icon-192', '/icon-192.png', 'exact', 'revalidate', 'The app icon'),
  appFile('icon-512', '/icon-512.png', 'exact', 'revalidate', 'The app icon, large'),
  appFile(
    'icon-maskable-512',
    '/icon-maskable-512.png',
    'exact',
    'revalidate',
    'The app icon for masks: its art inside the 80% safe zone',
  ),
  appFile(
    'screenshots',
    '/screenshots',
    'tree',
    'revalidate',
    'What the install dialog shows (the manifest’s screenshots)',
  ),

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
  consolePage('links', '/links', 'A share link found by its code, to revoke it (ADR 0044)'),
  consolePage('settings', '/settings', 'Sign-in methods and the registration mode'),
  consolePage('studio', '/studio', 'Who holds a studio role, given and taken by the owner (ADR 0051)'),
  consolePage('agents', '/agents', 'Agents, their tokens and each agent’s audit (ADR 0052)'),
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

const studioPage = (id: string, path: string, note: string, match: Match = 'exact'): Namespace => ({
  id,
  path,
  match,
  component: 'studio',
  served: 'page',
  indexed: false,
  crawl: true,
  navigation: 'network',
  note,
});

const studioFile = (
  id: string,
  path: string,
  match: Match,
  cache: 'immutable' | 'revalidate',
  note: string,
): Namespace => ({
  id,
  path,
  match,
  component: 'studio',
  served: 'static',
  indexed: false,
  crawl: true,
  navigation: 'network',
  cache,
  note,
});

/**
 * The Studio's host (ADR 0051): a third site of the hub image's Caddy, on a port of its own, the same shape as the
 * console's. Its app at the root, the API's Studio routes and nothing else — no service worker, no robots.txt, never
 * indexed; any other path is a 404. The API's player and console routes are not served here.
 */
export const studioNamespaces: readonly Namespace[] = [
  {
    id: 'studio-api',
    path: '/api/studio',
    match: 'tree',
    component: 'api',
    served: 'proxy',
    indexed: false,
    crawl: true,
    navigation: 'network',
    note: 'The API’s Studio routes: signing in to the Studio, its session and the library; agents’ tokens too',
  },

  // The Studio's pages (apps/studio/src/router.tsx).
  studioPage('studio-library', '/', 'The library: the packs, their styles, versions and status'),
  studioPage(
    'studio-packs',
    '/packs',
    'A pack (/packs/<packId>) and one of its versions with its assets (/packs/<packId>/<versionId>)',
    'tree',
  ),
  studioPage('studio-styles', '/styles', 'The styles (/styles) and one style (/styles/<styleId>)', 'tree'),
  studioPage('studio-sign-in', '/sign-in', 'The Studio’s own sign-in; ?redirect= the page to go back to'),

  // The Studio's files (apps/studio/public and what the build adds).
  studioFile('studio-assets', '/assets', 'tree', 'immutable', 'Scripts and styles with hashed names'),
  studioFile('studio-index', '/index.html', 'exact', 'revalidate', 'The Studio’s page itself'),
  studioFile(
    'studio-theme-init',
    '/theme-init.js',
    'exact',
    'revalidate',
    'Light or dark before the first paint',
  ),
  studioFile('studio-favicon', '/favicon.svg', 'exact', 'revalidate', 'The icon in browser tabs'),
];

/** The Studio's routes the API names: where it serves them. The C# class StudioPaths is generated from these. */
export const studioLinks = {
  Api: {
    path: '/api/studio',
    note: 'The API’s Studio routes, served only on the Studio’s host once it has one',
  },
} as const satisfies Record<string, { path: string; note: string }>;

/**
 * The pages of each indexed tree namespace of the hub's host, with the games' pages from the ids in
 * games/<id>/public/game.json. The sitemap lists them and apps/web's build must write exactly these (its check-build
 * compares); a tree that is indexed and has no entry here is refused by the sitemap generator. The English pages
 * (`en`, ADR 0047) are the Vietnamese ones under /en — the home page among them — but for those declared
 * Vietnamese-only (`vietnameseOnlyPages`).
 */
export function publicPages(gameIds: readonly string[]): Record<string, readonly string[]> {
  const vietnamese = {
    'game-pages': ['/games/', ...gameIds.map((id) => `/games/${id}/`)],
    guides: ['/guides/', '/guides/install/'],
    faq: ['/faq/'],
    about: ['/about/'],
    promise: ['/promise/'],
    terms: ['/terms/'],
    privacy: ['/privacy/'],
  };
  const english = ['/', ...Object.values(vietnamese).flat()]
    .filter((path) => !vietnameseOnlyPages.includes(path))
    .map((path) => pathInLanguage(path, 'en'));
  return { ...vietnamese, en: english };
}

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
    note: 'The profile picker; ?auto=true goes straight on with one profile; ?ask=true asks "Ai đang chơi?" after a cold start that follows 30 minutes unused',
  },
  RoomLink: { path: '/r', note: 'A room’s short link, /r/<code>: a link preview’s way to the app' },
  ShareLink: { path: '/s', note: 'A share link, /s/<code>: a link preview’s way to the app (ADR 0044)' },
} as const satisfies Record<string, { path: string; note: string }>;

/**
 * The link-preview crawlers (ADR 0044): a `User-Agent` with one of these, compared without case, asking for a link of a
 * namespace with `linkPreview` gets the API's card for it. Messenger's cards are fetched by `facebookexternalhit`.
 * Zalo's crawler is matched by its name alone, which its in-app browser also carries: `linkPreviewBrowsers` keeps
 * people out.
 */
export const linkPreviewCrawlers: readonly string[] = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'TelegramBot',
  'Slackbot',
  'Discordbot',
  'WhatsApp/',
  'LinkedInBot',
  'Zalo',
];

/**
 * Marks of a person's browser — a phone's, or an app's in-app browser (Zalo's and Messenger's on a phone say `Mobile`,
 * Facebook's and Messenger's `FBAN`/`FBAV`/`FB_IAB`): a `User-Agent` with one of these, compared without case, always
 * gets the app's page, whatever crawler's name it also carries. People always get the app.
 */
export const linkPreviewBrowsers: readonly string[] = ['Mobile', 'FBAN', 'FBAV', 'FB_IAB', 'Instagram'];

/**
 * The query parameter that marks a person sent on from a card to the app (`?app=1`): the card's script, or its link
 * with scripts off, adds it, and a request that carries it always gets the app's page — whatever its `User-Agent` says,
 * so a person is never stuck on the card. The hub ignores it.
 */
export const linkPreviewAppQuery = 'app';

/** The characters a code in a previewed link may have, and how many: anything else is the app's page. */
export const linkPreviewCode = '[0-9A-Za-z-]{1,20}';

/**
 * Crawlers that fetch for search and for answers that cite the page (ADR 0047): robots.txt names them in a group of
 * their own that allows what every crawler may fetch, so a later rule for one of them cannot shut search out by mistake.
 * OpenAI's, Anthropic's and Perplexity's search crawlers are distinct from their training crawlers.
 */
export const searchCrawlers: readonly string[] = [
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Applebot',
  'coccocbot-web',
];

/**
 * Crawlers that fetch only to train models (ADR 0047): robots.txt keeps them out of everything, as the content signal
 * `ai-train=no` asks of those that read it. `Google-Extended` and `Applebot-Extended` are tokens, not crawlers of their
 * own: they say whether what Googlebot and Applebot fetch may train Gemini and Apple's models, and leave search alone.
 */
export const trainingCrawlers: readonly string[] = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];
