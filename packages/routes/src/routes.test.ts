import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { caddyMatchers, consoleCaddySnippet, hubCaddySnippet, hubPathsCs, robotsTxt } from './generate.ts';
import { consoleLinks, consoleNamespaces, hosts, hubLinks, hubNamespaces, hubRedirects } from './map.ts';
import { matchConsolePath, matchHubPath, navigationAllowlist, overlap, redirectTarget } from './match.ts';

/** The hub's pages (apps/hub/src/router.tsx); the hub's own test reads its router. */
const appPages = [
  '/play',
  '/play/merge-block',
  '/play/tien-len/rooms',
  '/play/tien-len/rooms/0b7c',
  '/play/tien-len/rooms/0b7c/replay/3',
  '/r/ABCD',
  '/account',
  '/account/email',
  '/account/sign-in',
  '/account/sign-in/continue',
  '/account/register',
  '/account/register/confirm',
  '/account/password/forgot',
  '/account/password/reset',
  '/account/profiles',
  '/account/data',
  '/terms',
  '/privacy',
];

describe('the map', () => {
  it('gives every path to one namespace at most', () => {
    const clashes = hubNamespaces.flatMap((a, i) =>
      hubNamespaces.slice(i + 1).flatMap((b) => (overlap(a, b) ? [`${a.id} and ${b.id}`] : [])),
    );
    expect(clashes).toEqual([]);
  });

  it('has unique ids, absolute paths without a trailing slash, and a cache policy on static files only', () => {
    expect(new Set(hubNamespaces.map((n) => n.id)).size).toBe(hubNamespaces.length);
    for (const namespace of hubNamespaces) {
      expect(namespace.path, namespace.id).toMatch(/^\//);
      if (namespace.path !== '/') expect(namespace.path, namespace.id).not.toMatch(/\/$/);
      expect(namespace.cache !== undefined, namespace.id).toBe(namespace.served === 'static');
    }
    expect(new Set(hosts.map((h) => h.role)).size).toBe(hosts.length);
  });

  it('serves only app pages from the service worker, and keeps them crawlable but out of the index', () => {
    for (const namespace of hubNamespaces) {
      const appPage = namespace.component === 'app' && namespace.served === 'page';
      expect(namespace.navigation === 'app-shell', namespace.id).toBe(appPage);
      if (appPage) expect([namespace.indexed, namespace.crawl], namespace.id).toEqual([false, true]);
    }
  });

  it.each(appPages)('gives %s to an app page', (path) => {
    expect(matchHubPath(path)).toMatchObject({ component: 'app', served: 'page' });
  });

  it.each([
    ['/', 'root'],
    ['/api/health', 'api'],
    ['/assets/index-1CKCw-Ph.js', 'assets'],
    ['/workbox-ee9d8b34.js', 'workbox'],
    ['/sw.js', 'service-worker'],
    ['/robots.txt', 'robots'],
    ['/.well-known/security.txt', 'well-known'],
  ])('gives %s to %s', (path, id) => {
    expect(matchHubPath(path)?.id).toBe(id);
  });

  it.each([
    '/nope',
    '/sitemap.xml',
    '/playground',
    '/welcome',
    '/rooms/tien-len',
    '/room/0b7c',
    '/replay/0b7c/3',
    '/legal/terms',
    '/terms/x',
    '/privacy/x',
    '/admin',
    '/admin/',
    '/admin/setup',
    '/administrator',
    '/apis',
    '/index.htm',
    '/wp-login.php',
    '/.env',
  ])('gives %s to nobody: a 404', (path) => {
    expect(matchHubPath(path)).toBeUndefined();
  });

  it('answers the root with a redirect to a page of the app, in no way an app page itself', () => {
    const root = hubNamespaces.filter((namespace) => namespace.served === 'redirect');
    expect(root.map((namespace) => namespace.path)).toEqual(['/']);
    for (const namespace of root) {
      expect(namespace.redirectTo, namespace.id).toBeDefined();
      expect(matchHubPath(namespace.redirectTo ?? '')).toMatchObject({ component: 'app', served: 'page' });
      expect(namespace.navigation, namespace.id).toBe('network');
    }
    for (const namespace of hubNamespaces) {
      expect(namespace.redirectTo !== undefined, namespace.id).toBe(namespace.served === 'redirect');
    }
  });

  it('links the API only to pages of the app', () => {
    for (const [name, link] of Object.entries(hubLinks)) {
      expect(matchHubPath(link.path), name).toMatchObject({ component: 'app', served: 'page' });
    }
  });

  it('has no namespace of the console: the console has a host of its own', () => {
    expect(hubNamespaces.filter((namespace) => namespace.component === 'console')).toEqual([]);
    expect(hosts.find((host) => host.role === 'console')?.state).toBe('serving');
  });
});

describe('the console’s host', () => {
  /** The console's pages (apps/console/src/router.tsx); the console's own test reads its router. */
  const consolePages = [
    '/',
    '/games',
    '/health',
    '/system',
    '/users',
    '/users/0b7c',
    '/review',
    '/review/12',
    '/communities',
    '/settings',
    '/audit',
    '/security',
    '/setup',
  ];

  it('gives every path to one namespace at most', () => {
    const clashes = consoleNamespaces.flatMap((a, i) =>
      consoleNamespaces.slice(i + 1).flatMap((b) => (overlap(a, b) ? [`${a.id} and ${b.id}`] : [])),
    );
    expect(clashes).toEqual([]);
  });

  it('has unique ids, never indexed, no service worker, a cache policy on static files only', () => {
    const ids = [...hubNamespaces, ...consoleNamespaces].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const namespace of consoleNamespaces) {
      expect(namespace.path, namespace.id).toMatch(/^\//);
      if (namespace.path !== '/') expect(namespace.path, namespace.id).not.toMatch(/\/$/);
      expect(namespace.indexed, namespace.id).toBe(false);
      expect(namespace.navigation, namespace.id).toBe('network');
      expect(namespace.cache !== undefined, namespace.id).toBe(namespace.served === 'static');
      expect(['page', 'static', 'proxy'], namespace.id).toContain(namespace.served);
    }
  });

  it.each(consolePages)('gives %s to a page of the console', (path) => {
    expect(matchConsolePath(path)).toMatchObject({ component: 'console', served: 'page' });
  });

  it('proxies the API’s console routes only', () => {
    expect(matchConsolePath('/api/admin')?.served).toBe('proxy');
    expect(matchConsolePath('/api/admin/session')?.served).toBe('proxy');
    expect(matchConsolePath('/api/admin/users/x')?.served).toBe('proxy');
    expect(consoleNamespaces.filter((namespace) => namespace.served === 'proxy').map((n) => n.path)).toEqual([
      consoleLinks.Api.path,
    ]);
  });

  it.each([
    '/admin',
    '/admin/',
    '/play',
    '/account/sign-in',
    '/api',
    '/api/health',
    '/api/auth/me',
    '/api/administrator',
    '/robots.txt',
    '/sw.js',
    '/manifest.webmanifest',
    '/.well-known/security.txt',
    '/nope',
    '/games/x',
  ])('gives %s to nobody: a 404', (path) => {
    expect(matchConsolePath(path)).toBeUndefined();
  });

  it('names the setup page the API logs', () => {
    expect(matchConsolePath(consoleLinks.Setup.path)).toMatchObject({ component: 'console', served: 'page' });
  });
});

describe('the old paths', () => {
  it('lead to a page of the app, and none lies in a namespace', () => {
    const ids = hubRedirects.map((redirect) => redirect.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const redirect of hubRedirects) {
      const sample = redirect.from.replace(/:\w+/g, 'x');
      expect(matchHubPath(sample), `${redirect.id}: ${sample} is in a namespace`).toBeUndefined();
      const target = redirectTarget(sample);
      expect(matchHubPath(target ?? ''), `${redirect.id}: ${target}`).toMatchObject({
        component: 'app',
        served: 'page',
      });
    }
  });

  it.each([
    ['/welcome', '/account/sign-in'],
    ['/sign-in/continue', '/account/sign-in/continue'],
    ['/register', '/account/register'],
    ['/register/confirm', '/account/register/confirm'],
    ['/password/forgot', '/account/password/forgot'],
    ['/password/reset', '/account/password/reset'],
    ['/profiles', '/account/profiles'],
    ['/data', '/account/data'],
    ['/legal/terms', '/terms'],
    ['/legal/privacy', '/privacy'],
    ['/rooms/tien-len', '/play/tien-len/rooms'],
  ])('sends %s to %s', (from, to) => {
    expect(redirectTarget(from)).toBe(to);
  });

  it.each([
    '/room/0b7c',
    '/replay/0b7c/3',
    '/rooms',
    '/rooms/tien-len/x',
    '/registerx',
    '/welcome/x',
    '/account',
    '/play',
    '/',
  ])('leaves %s alone: no redirect', (path) => {
    expect(redirectTarget(path)).toBeUndefined();
  });

  it('covers every page the API used to link to', () => {
    // hubLinks holds the new paths; these are the ones the API wrote before the move (emails already sent carry them).
    const oldLinks = [
      '/welcome',
      '/sign-in/continue',
      '/register/confirm',
      '/password/reset',
      '/profiles',
      '/account/email',
      '/account',
    ];
    for (const path of oldLinks) {
      expect(redirectTarget(path) ?? matchHubPath(path)?.path, path).toBeDefined();
    }
  });
});

describe('the service worker', () => {
  const allowed = (url: string) => navigationAllowlist().some((pattern) => pattern.test(url));

  it.each([...appPages, '/play?x=1', '/account/register?invite=X', '/account/profiles?auto=true'])(
    'answers %s offline',
    (url) => {
      expect(allowed(url)).toBe(true);
    },
  );

  it.each([
    '/',
    '/?invite=X',
    '/api/auth/me',
    '/admin/',
    '/admin',
    '/nope',
    '/robots.txt',
    '/playground',
    '/assets/x.js',
    '/welcome',
  ])('leaves %s to the network', (url) => {
    expect(allowed(url)).toBe(false);
  });
});

describe('what the map generates', () => {
  it('names a Caddy matcher for each way of serving', () => {
    expect([...caddyMatchers().keys()]).toEqual([
      'apiProxy',
      'appPage',
      'appStaticImmutable',
      'appStaticRevalidate',
      'platformGenerated',
    ]);
    expect(hubCaddySnippet()).toContain('@apiProxy path /api /api/*\n');
    expect(hubCaddySnippet()).toContain('@appPage path /play /play/* /account /account/* ');
    expect(hubCaddySnippet()).toContain(' /workbox-* ');
  });

  it('writes the redirects as directives, the query kept', () => {
    const snippet = hubCaddySnippet();
    expect(snippet).toContain('@rootRedirect path /\nredir @rootRedirect /play?{query} 302\n');
    expect(snippet).toContain('@legacyWelcome path_regexp legacyWelcome ^/welcome$\n');
    expect(snippet).toContain('redir @legacyWelcome /account/sign-in?{query} 301\n');
    expect(snippet).toContain('redir @legacyRegister /account/register{re.legacyRegister.1}?{query} 301\n');
    expect(snippet).toContain('redir @legacyRooms /play/{re.legacyRooms.1}/rooms?{query} 301\n');
    // One matcher and one redir for each, and no handler of the app's page answers a redirect.
    expect(snippet.match(/^redir @/gm)).toHaveLength(hubRedirects.length + 1);
    expect(caddyMatchers().has('platformRedirect')).toBe(false);
  });

  it('writes the console’s matchers', () => {
    expect([...caddyMatchers(consoleNamespaces).keys()]).toEqual([
      'apiProxy',
      'consolePage',
      'consoleStaticImmutable',
      'consoleStaticRevalidate',
    ]);
    expect(consoleCaddySnippet()).toContain('@apiProxy path /api/admin /api/admin/*\n');
    expect(consoleCaddySnippet()).toContain('@consolePage path / /games /health ');
    expect(consoleCaddySnippet()).not.toContain('redir');
  });

  describe('Caddyfile.hub', () => {
    const caddyfile = readFileSync(new URL('../../../deploy/docker/Caddyfile.hub', import.meta.url), 'utf8');
    // A site block runs from its address at the start of a line to the next one.
    const site = (address: string) => {
      const start = caddyfile.indexOf(`\n${address} {\n`);
      expect(start, address).toBeGreaterThan(0);
      const next = caddyfile.slice(start + 1).search(/\n:\d+ \{\n/);
      return next < 0 ? caddyfile.slice(start) : caddyfile.slice(start, start + 1 + next);
    };
    const handled = (block: string) => [...block.matchAll(/^\s*handle @(\w+) \{/gm)].map((match) => match[1]);

    it('serves the hub’s matchers on :8080: a handler for each, and no other', () => {
      const hub = site(':8080');
      expect(hub).toContain('import /etc/caddy/hub-routes.caddy');
      expect(handled(hub).sort()).toEqual([...caddyMatchers().keys()].sort());
    });

    it('serves the console’s matchers on :8081: a handler for each, and no other', () => {
      const console = site(':8081');
      expect(console).toContain('import /etc/caddy/console-routes.caddy');
      expect(console).not.toContain('hub-routes.caddy');
      expect(handled(console).sort()).toEqual([...caddyMatchers(consoleNamespaces).keys()].sort());
    });
  });

  it('keeps crawlers out of the API, and nothing else', () => {
    expect(robotsTxt()).toMatch(/\nUser-agent: \*\nDisallow: \/api\/\n$/);
    expect(robotsTxt()).not.toContain('Sitemap');
  });

  it('gives the API the paths it used to write by hand', () => {
    const cs = hubPathsCs();
    expect(cs).toContain('public const string Welcome = "/account/sign-in";');
    expect(cs).toContain('public const string RegisterConfirm = "/account/register/confirm";');
    expect(cs).not.toContain('/admin/');
    expect(cs).toContain('public static class ConsolePaths');
    expect(cs).toContain('public const string Setup = "/setup";');
    expect(cs).toContain('public const string Api = "/api/admin";');
  });
});
