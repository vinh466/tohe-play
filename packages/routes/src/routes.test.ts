import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  caddyMatcherName,
  caddyMatchers,
  consoleCaddySnippet,
  hubCaddySnippet,
  hubPathsCs,
  hubRedirectDirectives,
  hubSitemapCaddySnippet,
  robotsTxt,
  sitemapPaths,
} from './generate.ts';
import {
  consoleLinks,
  consoleNamespaces,
  hosts,
  hubLinks,
  hubNamespaces,
  hubRedirects,
  type Namespace,
} from './map.ts';
import {
  isLinkPreview,
  linkPreviewPattern,
  matchConsolePath,
  matchHubPath,
  navigationAllowlist,
  overlap,
  redirectTarget,
} from './match.ts';

/** The hub's pages (apps/hub/src/router.tsx); the hub's own test reads its router. */
const appPages = [
  '/play',
  '/play/merge-block',
  '/play/tien-len/rooms',
  '/play/tien-len/rooms/0b7c',
  '/play/tien-len/rooms/0b7c/replay/3',
  '/r/ABCD',
  '/s/7KQ2M9XA',
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
];

/** The public pages (apps/web); its build checks that it writes exactly these, and the sitemap lists them. */
const publicPaths = [
  '/',
  '/games/',
  '/games/merge-block/',
  '/guides/',
  '/guides/install/',
  '/faq/',
  '/about/',
  '/terms/',
  '/privacy/',
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
    ['/', 'home'],
    ['/games/', 'game-pages'],
    ['/games', 'game-pages'],
    ['/games/merge-block/', 'game-pages'],
    ['/guides/install/', 'guides'],
    ['/faq/', 'faq'],
    ['/about/', 'about'],
    ['/terms/', 'terms'],
    ['/privacy', 'privacy'],
    ['/og.png', 'og-image'],
    ['/llms.txt', 'llms'],
    ['/_web/index.CkXW_mHm.css', 'public-assets'],
    ['/_web/returning.Dj8LZPoH.js', 'public-assets'],
    ['/api/health', 'api'],
    ['/assets/index-1CKCw-Ph.js', 'assets'],
    ['/workbox-ee9d8b34.js', 'workbox'],
    ['/sw.js', 'service-worker'],
    ['/robots.txt', 'robots'],
    ['/sitemap.xml', 'sitemap'],
    ['/.well-known/security.txt', 'well-known'],
  ])('gives %s to %s', (path, id) => {
    expect(matchHubPath(path)?.id).toBe(id);
  });

  it.each([
    '/nope',
    '/_webx',
    '/_astro/x.js',
    '/sitemap.xml/x',
    '/playground',
    '/welcome',
    '/rooms/tien-len',
    '/room/0b7c',
    '/replay/0b7c/3',
    '/legal/terms',
    '/termsx',
    '/gamesx',
    '/og.png/x',
    '/llms.txt/x',
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

  it('gives the root to the public home page: static, indexed, and in no way an app page', () => {
    expect(matchHubPath('/')).toMatchObject({
      component: 'public',
      served: 'static',
      indexed: true,
      navigation: 'network',
    });
    for (const namespace of hubNamespaces) {
      expect(namespace.redirectTo !== undefined, namespace.id).toBe(namespace.served === 'redirect');
    }
  });

  it('indexes public pages only — not the files of the public pages', () => {
    const files = ['public-assets', 'og-image', 'llms'];
    for (const namespace of hubNamespaces) {
      expect(namespace.indexed, namespace.id).toBe(
        namespace.component === 'public' && !files.includes(namespace.id),
      );
    }
    expect(hubNamespaces.find((n) => n.id === 'sitemap')).toMatchObject({
      component: 'platform',
      served: 'generated',
    });
  });

  it('lists every public page in the sitemap, the games’ pages from their ids', () => {
    expect(sitemapPaths(hubNamespaces, ['hello', 'merge-block'])).toEqual([
      '/',
      '/games/',
      '/games/hello/',
      '/games/merge-block/',
      '/guides/',
      '/guides/install/',
      '/faq/',
      '/about/',
      '/terms/',
      '/privacy/',
    ]);
    for (const path of publicPaths) {
      expect(sitemapPaths(hubNamespaces, ['merge-block']), path).toContain(path);
      expect(matchHubPath(path), path).toMatchObject({
        component: 'public',
        served: 'static',
        indexed: true,
      });
    }
  });

  it('refuses an indexed tree in the sitemap until the public pages list its children', () => {
    const tree: Namespace = {
      id: 'tips',
      path: '/tips',
      match: 'tree',
      component: 'public',
      served: 'static',
      indexed: true,
      crawl: true,
      navigation: 'network',
      cache: 'revalidate',
      note: 'test',
    };
    expect(() => sitemapPaths([...hubNamespaces, tree])).toThrow(/not listed in the sitemap/);
    expect(() => sitemapPaths([tree], [], { tips: ['/other/'] })).toThrow(/outside the namespace/);
    expect(sitemapPaths([tree], [], { tips: ['/tips/', '/tips/one/'] })).toEqual(['/tips/', '/tips/one/']);
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
    '/links',
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
  it('lead to a page of the app or a public page, and none lies in a namespace', () => {
    const ids = hubRedirects.map((redirect) => redirect.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const redirect of hubRedirects) {
      const sample = redirect.from.replace(/:\w+/g, 'x');
      expect(matchHubPath(sample), `${redirect.id}: ${sample} is in a namespace`).toBeUndefined();
      const target = redirectTarget(sample);
      const found = matchHubPath(target ?? '');
      expect(
        found?.component === 'app' || (found?.component === 'public' && found.indexed),
        `${redirect.id}: ${target}`,
      ).toBe(true);
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
    ['/legal/terms', '/terms/'],
    ['/legal/privacy', '/privacy/'],
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
    '/_web/x.js',
    '/sitemap.xml',
    '/api/auth/me',
    '/admin/',
    '/admin',
    '/nope',
    '/robots.txt',
    '/playground',
    '/assets/x.js',
    '/welcome',
    '/terms/',
    '/privacy/',
    '/games/merge-block/',
    '/faq/',
    '/og.png',
  ])('leaves %s to the network', (url) => {
    expect(allowed(url)).toBe(false);
  });
});

describe('what the map generates', () => {
  it('names a Caddy matcher for each way of serving', () => {
    expect([...caddyMatchers().keys()]).toEqual([
      'apiProxy',
      'publicStaticRevalidate',
      'publicStaticImmutable',
      'appPage',
      'appStaticImmutable',
      'appStaticRevalidate',
      'platformGenerated',
    ]);
    expect(hubCaddySnippet()).toContain('@apiProxy path /api /api/*\n');
    expect(hubCaddySnippet()).toContain(
      '@publicStaticRevalidate path / /games /games/* /guides /guides/* /faq /faq/* /about /about/* /terms /terms/* /privacy /privacy/* /og.png /llms.txt\n',
    );
    expect(hubCaddySnippet()).toContain('@publicStaticImmutable path /_web /_web/*\n');
    expect(hubCaddySnippet()).toContain(' /robots.txt /sitemap.xml /.well-known /.well-known/*\n');
    expect(hubCaddySnippet()).toContain('@appPage path /play /play/* /account /account/* ');
    expect(hubCaddySnippet()).toContain(' /workbox-* ');
  });

  it('rewrites a crawler’s /r/<code> and /s/<code> to the API’s card, and nothing else', () => {
    const snippet = hubCaddySnippet();
    expect(linkPreviewPattern()).toBe('^/(r|s)/([0-9A-Za-z-]{1,20})$');
    expect(snippet).toContain('@linkPreview {\n\tpath_regexp linkPreview ^/(r|s)/([0-9A-Za-z-]{1,20})$\n');
    expect(snippet).toContain(
      '\theader_regexp linkPreviewCrawler User-Agent (?i)(facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Discordbot|WhatsApp/|LinkedInBot|Zalo)\n',
    );
    expect(snippet).toContain(
      '\tnot header_regexp linkPreviewBrowser User-Agent (?i)(Mobile|FBAN|FBAV|FB_IAB|Instagram)\n',
    );
    // A person sent on from a card (?app=1) always gets the app, whatever its User-Agent says.
    expect(snippet).toContain('\tnot query app=*\n}\nrewrite @linkPreview');
    expect(snippet).toContain('rewrite @linkPreview /api/previews/{re.linkPreview.1}/{re.linkPreview.2}\n');
    // Everything else, and only that, gets the hub's CSP; the previewed links vary with the User-Agent.
    expect(snippet).toContain('@notLinkPreview {\n\tnot {\n\t\tpath_regexp ^/(r|s)/([0-9A-Za-z-]{1,20})$\n');
    expect(snippet).toContain('\t\tnot query app=*\n\t}\n}\n');
    expect(snippet).toContain('@linkPreviewPaths path /r/* /s/*\n');
    // The rewritten path is the API's, which @apiProxy serves: Caddy never puts the answer into a template.
    expect(matchHubPath('/api/previews/s/7KQ2M9XA')?.id).toBe('api');
  });

  const crawlers = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Facebot',
    'Twitterbot/1.0',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'WhatsApp/2.23.20.0 A',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Zalo',
  ];
  it.each(crawlers)('gives the card to %s', (userAgent) => {
    expect(isLinkPreview('/s/7KQ2M9XA', userAgent)).toBe(true);
    expect(isLinkPreview('/r/482913', userAgent)).toBe(true);
    expect(isLinkPreview('/play/merge-block', userAgent)).toBe(false);
    expect(isLinkPreview('/s/7KQ2M9XA/x', userAgent)).toBe(false);
    expect(isLinkPreview('/s/%3Cb%3E', userAgent)).toBe(false);
    expect(isLinkPreview('/s/', userAgent)).toBe(false);
    expect(isLinkPreview('/s/7KQ2M9XA', userAgent, '?app=1')).toBe(false);
    expect(isLinkPreview('/r/482913', userAgent, '?x=1&app=')).toBe(false);
    expect(isLinkPreview('/r/482913', userAgent, '?apps=1')).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Zalo/24.09.01',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/585 ZaloTheme/light ZaloLanguage/vi',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0;FBBV/1;FBDV/iPhone15,2]',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/470.0.0.0;]',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  ])('gives the app to a person: %s', (userAgent) => {
    expect(isLinkPreview('/s/7KQ2M9XA', userAgent)).toBe(false);
    expect(isLinkPreview('/r/482913', userAgent)).toBe(false);
  });

  it('writes the redirects as directives, the query kept', () => {
    const snippet = hubCaddySnippet();
    expect(snippet).toContain('@legacyWelcome path_regexp legacyWelcome ^/welcome$\n');
    expect(snippet).toContain('redir @legacyWelcome /account/sign-in?{query} 301\n');
    expect(snippet).toContain('redir @legacyRegister /account/register{re.legacyRegister.1}?{query} 301\n');
    expect(snippet).toContain('redir @legacyRooms /play/{re.legacyRooms.1}/rooms?{query} 301\n');
    // One matcher and one redir for each, and no handler of the app's page answers a redirect.
    expect(snippet.match(/^redir @/gm)).toHaveLength(hubRedirects.length);
    expect(caddyMatchers().has('platformRedirect')).toBe(false);
  });

  it('can still answer a placeholder namespace with a temporary redirect', () => {
    const placeholder: Namespace = {
      id: 'soon',
      path: '/soon',
      match: 'exact',
      component: 'platform',
      served: 'redirect',
      indexed: false,
      crawl: true,
      navigation: 'network',
      redirectTo: '/play',
      note: 'A page that is not there yet',
    };
    expect(hubRedirectDirectives([placeholder], []).join('\n')).toContain(
      '@soonRedirect path /soon\nredir @soonRedirect /play?{query} 302',
    );
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

    it('imports the sitemap snippet at its top level, and answers /sitemap.xml with it', () => {
      expect(caddyfile).toMatch(/^import \/etc\/caddy\/hub-sitemap\.caddy$/m);
      expect(site(':8080')).toMatch(/handle \/sitemap\.xml \{\n\s*import hubSitemap\n/);
    });

    // The body of `handle @<matcher> { … }`: up to the closing brace at the block's own indentation.
    const block = (hub: string, matcher: string) =>
      hub.split(`handle @${matcher} {`)[1]?.split(/\n\t\}\n/)[0] ?? '';

    it('lets search engines index the public pages and nothing else of the hub', () => {
      const hub = site(':8080');
      for (const name of caddyMatchers().keys()) {
        if (name === 'apiProxy' || name === 'platformGenerated') continue;
        const indexed = hubNamespaces.some((n) => caddyMatcherName(n) === name && n.indexed);
        expect(block(hub, name), name).toContain('root *');
        expect(block(hub, name).includes('X-Robots-Tag "noindex"'), name).toBe(!indexed);
      }
    });

    it('gives the public pages a CSP of their own: no inline script, no inline style, no other origin', () => {
      const home = block(site(':8080'), 'publicStaticRevalidate');
      const csp = /Content-Security-Policy "([^"]*)"/.exec(home)?.[1] ?? '';
      expect(csp).toContain("script-src 'self';");
      expect(csp).toContain("style-src 'self';");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toMatch(/unsafe-|\*|https?:|\{\$/);
      expect(home).toContain('root * /srv/web');
      // A folder's index.html, not one file for every path: the pages are real files (check-build lists them).
      expect(home).not.toContain('rewrite');
      expect(home).toContain('between [[[ ]]]');
    });

    it('fills the hub’s URL and the path asked for into the app’s link preview', () => {
      const app = block(site(':8080'), 'appPage');
      expect(app).toContain('between [[[ ]]]');
      expect(app).toContain('rewrite * /index.html');
      // The same links answer a crawler the API's card: a cache in front keeps the two apart.
      expect(app).toContain('header @linkPreviewPaths Vary "User-Agent"');
    });

    it('gives the hub’s CSP to everything but a link preview’s card, which keeps the API’s own', () => {
      const hub = site(':8080');
      const csp =
        hub.match(
          /^\s*(?:header\s+@\w+\s+)?Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'/gm,
        ) ?? [];
      expect(csp).toHaveLength(1);
      expect(csp[0]?.trim().startsWith('header @notLinkPreview Content-Security-Policy')).toBe(true);
    });

    it('serves the console’s matchers on :8081: a handler for each, and no other', () => {
      const console = site(':8081');
      expect(console).toContain('import /etc/caddy/console-routes.caddy');
      expect(console).not.toContain('hub-routes.caddy');
      expect(handled(console).sort()).toEqual([...caddyMatchers(consoleNamespaces).keys()].sort());
    });
  });

  it('keeps crawlers out of the API, allows the rest, says what AI may do, and names the sitemap', () => {
    expect(robotsTxt()).toMatch(
      /\nUser-agent: \*\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nAllow: \/\nDisallow: \/api\/\n\nSitemap: \{\{ env "TOHE_HUB_URL" \}\}\/sitemap\.xml\n$/,
    );
  });

  it('writes the sitemap from the indexed pages, with the hub’s URL read at run time', () => {
    const snippet = hubSitemapCaddySnippet(hubNamespaces, ['merge-block']);
    expect(snippet).toContain('(hubSitemap) {');
    expect(snippet).toContain('@noHubUrl expression `{env.TOHE_HUB_URL} == ""`');
    expect(snippet).toContain('<url><loc>{{ env "TOHE_HUB_URL" }}/</loc></url>');
    expect(snippet).toContain('<url><loc>{{ env "TOHE_HUB_URL" }}/games/merge-block/</loc></url>');
    expect(snippet.match(/<url>/g)).toHaveLength(9);
  });

  it('gives the API the paths it used to write by hand', () => {
    const cs = hubPathsCs();
    expect(cs).toContain('public const string Welcome = "/account/sign-in";');
    expect(cs).toContain('public const string RegisterConfirm = "/account/register/confirm";');
    expect(cs).not.toContain('/admin/');
    expect(cs).toContain('public static class ConsolePaths');
    expect(cs).toContain('public const string Setup = "/setup";');
    expect(cs).toContain('public const string Api = "/api/admin";');
    expect(cs).toContain('public const string ShareLink = "/s";');
    expect(cs).toContain('public const string RoomLink = "/r";');
  });
});
