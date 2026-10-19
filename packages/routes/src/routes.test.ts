import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { caddyMatchers, hubCaddySnippet, hubPathsCs, robotsTxt } from './generate.ts';
import { hosts, hubLinks, hubNamespaces } from './map.ts';
import { matchHubPath, navigationAllowlist, overlap } from './match.ts';

/** The hub's pages as they are today (apps/hub/src/router.tsx); the hub's own test reads its router. */
const todaysPages = [
  '/',
  '/welcome',
  '/sign-in/continue',
  '/register',
  '/register/confirm',
  '/password/forgot',
  '/password/reset',
  '/profiles',
  '/account',
  '/account/email',
  '/legal/terms',
  '/legal/privacy',
  '/data',
  '/play/merge-block',
  '/rooms/tien-len',
  '/r/ABCD',
  '/room/0b7c',
  '/replay/0b7c/3',
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

  it.each(todaysPages)('gives %s to an app page', (path) => {
    expect(matchHubPath(path)).toMatchObject({ component: 'app', served: 'page' });
  });

  it.each([
    ['/api/health', 'api'],
    ['/admin/', 'console'],
    ['/admin/setup', 'console'],
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
    '/rooms2',
    '/administrator',
    '/apis',
    '/index.htm',
    '/wp-login.php',
    '/.env',
  ])('gives %s to nobody: a 404', (path) => {
    expect(matchHubPath(path)).toBeUndefined();
  });

  it('links the API only to pages of the app or the console', () => {
    for (const [name, link] of Object.entries(hubLinks)) {
      expect(matchHubPath(link.path)?.served, name).toBe('page');
    }
  });
});

describe('the service worker', () => {
  const allowed = (url: string) => navigationAllowlist().some((pattern) => pattern.test(url));

  it.each([...todaysPages, '/?invite=X', '/register?invite=X', '/profiles?auto=true'])(
    'answers %s offline',
    (url) => {
      expect(allowed(url)).toBe(true);
    },
  );

  it.each(['/api/auth/me', '/admin/', '/admin', '/nope', '/robots.txt', '/playground', '/assets/x.js'])(
    'leaves %s to the network',
    (url) => {
      expect(allowed(url)).toBe(false);
    },
  );
});

describe('what the map generates', () => {
  it('names a Caddy matcher for each way of serving', () => {
    expect([...caddyMatchers().keys()]).toEqual([
      'apiProxy',
      'consolePage',
      'appPage',
      'appStaticImmutable',
      'appStaticRevalidate',
      'platformGenerated',
    ]);
    expect(hubCaddySnippet()).toContain('@apiProxy path /api /api/*\n');
    expect(hubCaddySnippet()).toContain('@appPage path / /welcome /welcome/* ');
    expect(hubCaddySnippet()).toContain(' /workbox-* ');
  });

  it('is served by Caddyfile.hub: a handler for every matcher, and no other', () => {
    const caddyfile = readFileSync(new URL('../../../deploy/docker/Caddyfile.hub', import.meta.url), 'utf8');
    expect(caddyfile).toContain('import /etc/caddy/hub-routes.caddy');
    const handled = [...caddyfile.matchAll(/^\s*handle @(\w+) \{/gm)].map((match) => match[1]);
    expect(handled.sort()).toEqual([...caddyMatchers().keys()].sort());
  });

  it('keeps crawlers out of the API and the console, and nothing else', () => {
    expect(robotsTxt()).toMatch(/\nUser-agent: \*\nDisallow: \/api\/\nDisallow: \/admin\/\n$/);
    expect(robotsTxt()).not.toContain('Sitemap');
  });

  it('gives the API the paths it used to write by hand', () => {
    const cs = hubPathsCs();
    expect(cs).toContain('public const string Welcome = "/welcome";');
    expect(cs).toContain('public const string RegisterConfirm = "/register/confirm";');
    expect(cs).toContain('public const string ConsoleSetup = "/admin/setup";');
  });
});
