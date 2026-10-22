#!/usr/bin/env node
// The hub's image serves the map in @tohe/routes (ADR 0042): the root and the other public pages (the games, the guides,
// the FAQ, about, the terms and the privacy notice) are static HTML, indexed, each with the CSP of the public pages and a
// link preview, assets under /_web/; every app namespace gets the app's page, not indexed, with its own link preview; a
// path in no namespace gets a real 404; robots.txt, sitemap.xml and llms.txt list what the map generates; HSTS covers
// subdomains; a link-preview crawler gets the API's card for /s/<code> and /r/<code>, a person the app (ADR 0044). Its
// second site serves the console's host: the console's page in the console's namespaces, never
// indexed, the API's console routes behind the console's own session, and nothing else.
// Runs against the hub's Caddy (docker compose up, CI's stack job), not `pnpm dev`, whose Vite answers every path
// with the app. Usage: HUB_URL=http://localhost:4720 CONSOLE_URL=http://localhost:4721 pnpm --filter @tohe/e2e routes
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import {
  consoleNamespaces,
  hubNamespaces,
  hubRedirects,
  redirectTarget,
  robotsTxt,
  sitemapPaths,
} from '@tohe/routes';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
// The hub's own public URL as its container knows it (TOHE_HUB_URL: robots.txt and the sitemap write it).
const publicHubUrl = (process.env.TOHE_HUB_URL ?? hubUrl).replace(/\/$/, '');
const consoleUrl = process.env.CONSOLE_URL ?? hubUrl.replace(/:4720\/?$/, ':4721');
// The games with a game.json: each has a page, and the sitemap lists it (the pages' build checks the same).
const gamesDir = new URL('../../../games/', import.meta.url);
const gameIds = readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/public/game.json`, gamesDir)))
  .map(
    (entry) =>
      (
        JSON.parse(readFileSync(new URL(`${entry.name}/public/game.json`, gamesDir), 'utf8')) as {
          id: string;
        }
      ).id,
  )
  .sort();
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

const get = async (path: string, base = hubUrl) => {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  return { response, body: await response.text() };
};

const appPages = hubNamespaces
  .filter((namespace) => namespace.component === 'app' && namespace.served === 'page')
  .flatMap((namespace) =>
    namespace.match === 'tree' ? [namespace.path, `${namespace.path}/x`] : [namespace.path],
  );
for (const path of appPages) {
  const { response, body } = await get(path);
  check(
    response.status === 200 &&
      body.includes('<div id="root">') &&
      (response.headers.get('x-robots-tag') ?? '').includes('noindex'),
    `${path}: the app's page, noindex (${response.status})`,
  );
  // The app's page carries its link preview with the hub's own URL and the address asked for; no placeholder is left.
  check(
    body.includes(`<meta property="og:url" content="${publicHubUrl}${path}"`) &&
      body.includes(`<meta property="og:image" content="${publicHubUrl}/og.png"`) &&
      !body.includes('.invalid') &&
      !body.includes('[[[') &&
      !body.includes('__request_path__'),
    `${path}: its link preview names the hub's URL — og:url ${publicHubUrl}${path}, og:image /og.png`,
  );
}

// The root is the public home page (apps/web): HTML that search engines may index, with a CSP that allows no inline
// script or style, a link to the app and its assets under /_web/. The query changes nothing there (a returning device
// is sent on by a script, in the browser: the smoke test); the app's old paths answer 301 to the new ones, the query
// kept, for the links in emails already sent.
{
  const { response, body } = await get('/?stay');
  const csp = response.headers.get('content-security-policy') ?? '';
  check(
    response.status === 200 &&
      (response.headers.get('content-type') ?? '').startsWith('text/html') &&
      !body.includes('<div id="root">') &&
      body.includes('href="/play"') &&
      body.includes('Chơi ngay'),
    `/: the public home page, with "Chơi ngay" to /play (${response.status})`,
  );
  check(
    response.headers.get('x-robots-tag') === null && !/name="robots"/.test(body),
    '/: indexed — no noindex in the header or the page',
  );
  check(
    csp.includes("script-src 'self';") &&
      csp.includes("style-src 'self';") &&
      csp.includes("frame-ancestors 'none'") &&
      !/unsafe-|\*/.test(csp),
    `/: its own CSP, no inline script or style (${csp})`,
  );
  const canonical = /<link rel="canonical" href="([^"]*)"/.exec(body)?.[1] ?? '';
  check(
    canonical === `${publicHubUrl}/` && !body.includes('.invalid') && !body.includes('[[['),
    `/: the canonical link is the hub's own URL, no placeholder left (${canonical})`,
  );
  const assets = [...body.matchAll(/(?:src|href)="(\/_web\/[^"]+)"/g)].map((match) => match[1] ?? '');
  check(assets.length >= 3, `/: its scripts and styles are files under /_web/ (${assets.length})`);
  for (const path of assets) {
    const asset = await get(path);
    check(
      asset.response.status === 200 &&
        (asset.response.headers.get('cache-control') ?? '').includes('immutable') &&
        (asset.response.headers.get('x-robots-tag') ?? '').includes('noindex'),
      `${path}: served, cached for good, not indexed (${asset.response.status})`,
    );
  }
  // A JSON-LD block is data, which the CSP leaves alone; any other script without a src runs, and is refused.
  const inline = /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>|<style[\s>]/.test(body);
  check(!inline, '/: no inline script or style in the page (JSON-LD data aside)');
}

// Every public page the map lists — the sitemap's own list, the games' pages from their game.json: HTML that is no
// page of the app, indexed, with the pages' CSP, its own title and description, the canonical link, a link preview with
// the shared picture, one h1 and no placeholder left. A path without its closing slash leads to the one with it.
const pageTitles = new Set<string>();
for (const path of sitemapPaths(undefined, gameIds)) {
  const { response, body } = await get(path);
  const csp = response.headers.get('content-security-policy') ?? '';
  const title = /<title>([^<]+)<\/title>/.exec(body)?.[1] ?? '';
  const meta = (name: string) =>
    new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`).exec(body)?.[1];
  const canonical = /<link rel="canonical" href="([^"]*)"/.exec(body)?.[1] ?? '';
  check(
    response.status === 200 &&
      (response.headers.get('content-type') ?? '').startsWith('text/html') &&
      !body.includes('<div id="root">') &&
      response.headers.get('x-robots-tag') === null &&
      !/name="robots"/.test(body) &&
      csp.includes("script-src 'self';") &&
      csp.includes("style-src 'self';") &&
      !/unsafe-|\*/.test(csp),
    `${path}: a public page, indexed, with the pages' own CSP (${response.status})`,
  );
  check(
    title !== '' &&
      !pageTitles.has(title) &&
      (meta('description') ?? '') !== '' &&
      canonical === `${publicHubUrl}${path}` &&
      meta('og:url') === `${publicHubUrl}${path}` &&
      meta('og:image') === `${publicHubUrl}/og.png` &&
      meta('twitter:card') === 'summary_large_image' &&
      (body.match(/<h1[\s>]/g) ?? []).length === 1 &&
      !body.includes('.invalid') &&
      !body.includes('[[['),
    `${path}: its own title and description, the canonical link, the link preview with the hub's URL, one h1 (${title})`,
  );
  pageTitles.add(title);
  if (path !== '/') {
    const bare = await get(path.slice(0, -1));
    check(
      bare.response.status === 308 && bare.response.headers.get('location') === path,
      `${path.slice(0, -1)}: leads to ${path} (${bare.response.status})`,
    );
  }
}
{
  // The terms and the privacy notice are static pages of the public pages, from the app's own text; the app has no
  // page of them; the old /legal/ paths lead there (below). The picture and llms.txt are files of the public pages.
  const terms = await get('/terms/');
  const privacy = await get('/privacy/');
  check(
    terms.body.includes('Điều khoản sử dụng') &&
      terms.body.includes('Tò He là gì') &&
      !terms.body.includes('<div id="root">'),
    '/terms/: the terms of use, static',
  );
  check(
    privacy.body.includes('Chính sách quyền riêng tư') &&
      privacy.body.includes('Tò He lưu những gì') &&
      !privacy.body.includes('<div id="root">'),
    '/privacy/: the privacy notice, static',
  );
  const play = await get('/play');
  check(play.body.includes('<div id="root">'), '/play: still the app');
  const image = await get('/og.png');
  check(
    image.response.status === 200 &&
      (image.response.headers.get('content-type') ?? '').startsWith('image/png'),
    `/og.png: the shared link-preview picture (${image.response.status})`,
  );
  const llms = await get('/llms.txt');
  check(
    llms.response.status === 200 &&
      (llms.response.headers.get('content-type') ?? '').startsWith('text/plain') &&
      sitemapPaths(undefined, gameIds).every(
        (path) => path === '/' || llms.body.includes(`${publicHubUrl}${path}`),
      ) &&
      !llms.body.includes('.invalid'),
    `/llms.txt: text, lists every public page with absolute URLs (${llms.response.status})`,
  );
}
for (const redirect of hubRedirects) {
  const from = redirect.from.replace(/:\w+/g, 'tien-len');
  const to = redirectTarget(from);
  const { response } = await get(`${from}?attempt=A&code=123456`);
  check(
    response.status === 301 && response.headers.get('location') === `${to}?attempt=A&code=123456`,
    `${from}: 301 to ${to}, the query kept (${response.status} ${response.headers.get('location')})`,
  );
}
{
  const { response } = await get('/register/confirm?attempt=A&code=123456');
  check(
    response.status === 301 &&
      response.headers.get('location') === '/account/register/confirm?attempt=A&code=123456',
    `/register/confirm: 301 to /account/register/confirm, the query kept (${response.status})`,
  );
}

for (const path of [
  '/room/0b7c',
  '/replay/0b7c/3',
  '/nope',
  '/games/nope/',
  '/en/games/nope/',
  // The terms and the privacy notice have no English page yet (vietnameseOnlyPages in @tohe/routes).
  '/en/terms/',
  '/guides/nope/',
  '/faq/x/',
  '/terms/x',
  '/_web/nope.js',
  '/web/index.html',
  '/sitemap.xml/x',
  '/playground',
  // The console has a host of its own (ADR 0042).
  '/admin',
  '/admin/',
  '/admin/setup',
  '/.well-known/nope',
  '/assets/nope.js',
]) {
  const { response, body } = await get(path);
  check(
    response.status === 404 &&
      !body.includes('<div id="root">') &&
      (response.headers.get('x-robots-tag') ?? '').includes('noindex'),
    `${path}: 404 with the not-found page, noindex (${response.status})`,
  );
}

const robots = await get('/robots.txt');
check(
  robots.response.status === 200 &&
    (robots.response.headers.get('content-type') ?? '').startsWith('text/plain') &&
    robots.body === robotsTxt().replace('{{ env "TOHE_HUB_URL" }}', publicHubUrl),
  `/robots.txt: text, as the map generates it, the sitemap's URL filled in (${robots.response.status})`,
);

const sitemap = await get('/sitemap.xml');
check(
  sitemap.response.status === 200 &&
    (sitemap.response.headers.get('content-type') ?? '').includes('xml') &&
    sitemap.body.includes('<urlset') &&
    sitemap.body.includes(`<loc>${publicHubUrl}/</loc>`) &&
    sitemapPaths(undefined, gameIds).every((path) =>
      sitemap.body.includes(`<loc>${publicHubUrl}${path}</loc>`),
    ),
  `/sitemap.xml: XML, the indexed pages with absolute URLs (${sitemap.response.status})`,
);
// Each page of a language pair names its alternates there, the one place hreflang is declared (ADR 0047).
check(
  sitemap.body.includes(`<xhtml:link rel="alternate" hreflang="en" href="${publicHubUrl}/en/"/>`) &&
    sitemap.body.includes(`<xhtml:link rel="alternate" hreflang="x-default" href="${publicHubUrl}/en/"/>`),
  '/sitemap.xml: the pages’ language alternates, x-default the English page',
);

const contact = process.env.TOHE_SECURITY_CONTACT;
const security = await get('/.well-known/security.txt');
check(
  contact
    ? security.response.status === 200 && security.body.includes(`Contact: mailto:${contact}\n`)
    : security.response.status === 404,
  `/.well-known/security.txt: ${contact ? `names ${contact}` : '404 without TOHE_SECURITY_CONTACT'} (${security.response.status})`,
);
if (contact) {
  // RFC 9116: plain text, an Expires in RFC 3339 that lies ahead, and less than a year ahead.
  const expires = /^Expires: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)$/m.exec(security.body)?.[1];
  const ahead = expires ? Date.parse(expires) - Date.now() : Number.NaN;
  check(
    (security.response.headers.get('content-type') ?? '').startsWith('text/plain') &&
      ahead > 0 &&
      ahead <= 365 * 24 * 60 * 60 * 1000,
    `/.well-known/security.txt: plain text, Expires ${expires ?? 'missing'} within a year`,
  );
}

const health = await get('/api/health');
check(health.response.status === 200, `/api/health: proxied to the API (${health.response.status})`);
check(
  (health.response.headers.get('strict-transport-security') ?? '').includes('includeSubDomains'),
  'HSTS includes subdomains',
);

// The console's host: its page in every one of its namespaces, never indexed, framed by nobody.
const consolePages = consoleNamespaces
  .filter((namespace) => namespace.component === 'console' && namespace.served === 'page')
  .flatMap((namespace) =>
    namespace.match === 'tree' ? [namespace.path, `${namespace.path}/x`] : [namespace.path],
  );
for (const path of consolePages) {
  const { response, body } = await get(path, consoleUrl);
  check(
    response.status === 200 &&
      body.includes('<div id="root">') &&
      body.includes('Quản trị') &&
      (response.headers.get('x-robots-tag') ?? '').includes('noindex') &&
      (response.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"),
    `console ${path}: the console's page, noindex, its own CSP (${response.status})`,
  );
}
{
  const { response } = await get('/api/admin/overview', consoleUrl);
  check(
    response.status === 401,
    `console /api/admin/overview: 401 without the console's session (${response.status})`,
  );
  const me = await get('/api/admin/me', consoleUrl);
  check(me.response.status === 204, `console /api/admin/me: 204, nobody signed in (${me.response.status})`);
}
for (const path of [
  '/play',
  '/account/sign-in',
  '/api/health',
  '/api/auth/me',
  '/robots.txt',
  '/sw.js',
  '/admin/',
  '/nope',
]) {
  const { response, body } = await get(path, consoleUrl);
  check(
    response.status === 404 &&
      !body.includes('<div id="root">') &&
      (response.headers.get('x-robots-tag') ?? '').includes('noindex'),
    `console ${path}: 404, noindex (${response.status})`,
  );
}
{
  // The hub's host does not answer the console's routes either: the API keeps them to the console's host.
  const { response } = await get('/api/admin/me');
  check(
    response.status === 404,
    `hub /api/admin/me: 404, the console's routes are on its own host (${response.status})`,
  );
  const { response: consoleRoot } = await get('/', consoleUrl);
  check(
    (consoleRoot.headers.get('strict-transport-security') ?? '').includes('includeSubDomains'),
    'console: HSTS includes subdomains',
  );
}

// Link previews (ADR 0044): a known crawler asking for /s/<code> or /r/<code> gets the API's card — og: and twitter:
// tags, escaped, naming no one at a table — while a person, in a browser or in Zalo's in-app browser, gets the app's
// page. A share link is made the way the hub does: a device key, a device profile with the terms, then the link.
{
  const crawler = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
  const people = {
    android:
      'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    zalo: 'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Zalo/24.09.01',
  };
  const as = (path: string, userAgent: string) =>
    fetch(new URL(path, hubUrl), { headers: { 'User-Agent': userAgent }, redirect: 'manual' });
  const meta = (body: string, name: string) =>
    new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`).exec(body)?.[1];

  const started = await fetch(new URL('/api/devices', hubUrl), { method: 'POST' });
  const cookie = (started.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const profile = crypto.randomUUID();
  const terms = '2026-10-20';
  const registered = await fetch(new URL('/api/devices/profiles', hubUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ id: profile, name: 'Mèo E2E', avatar: '🦊', termsVersion: terms }),
  });
  const game = gameIds.includes('merge-block') ? 'merge-block' : (gameIds[0] ?? '');
  const made = await fetch(new URL('/api/links', hubUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-Tohe-Device-Profile': profile,
      'X-Tohe-Terms': terms,
    },
    body: JSON.stringify({ kind: 'game', gameId: game }),
  });
  const code = made.ok ? ((await made.json()) as { code: string }).code : '';
  check(
    registered.ok && made.ok && /^[0-9A-Z]{8}$/.test(code),
    `a share link made as a device profile (${registered.status}, ${made.status} ${code})`,
  );

  const card = await as(`/s/${code}`, crawler);
  const cardBody = await card.text();
  check(
    card.status === 200 &&
      !cardBody.includes('<div id="root">') &&
      meta(cardBody, 'og:title')?.startsWith('Mèo E2E mời bạn chơi ') === true &&
      meta(cardBody, 'twitter:title') === meta(cardBody, 'og:title') &&
      meta(cardBody, 'og:url') === `${publicHubUrl}/s/${code}` &&
      meta(cardBody, 'og:image') === `${publicHubUrl}/og.png` &&
      (card.headers.get('x-robots-tag') ?? '').includes('noindex'),
    `/s/${code} for a crawler: the API's card, the maker and the game (${card.status} ${meta(cardBody, 'og:title')})`,
  );
  const table = await as('/r/123456', crawler);
  const tableBody = await table.text();
  check(
    table.status === 200 &&
      !tableBody.includes('<div id="root">') &&
      meta(tableBody, 'og:title') === 'Lời mời vào bàn chơi Tò He',
    `/r/123456 for a crawler: the table's card, naming no one (${table.status})`,
  );
  const unknown = await as('/s/ZZZZZZZZ', crawler);
  check(
    unknown.status === 200 && meta(await unknown.text(), 'og:title') === 'Tò He',
    `/s/ZZZZZZZZ for a crawler: 200 and the generic card (${unknown.status})`,
  );
  // The card keeps its own CSP — its one script, by hash — and says it varies with the User-Agent.
  const cardCsp = card.headers.get('content-security-policy') ?? '';
  check(
    /^default-src 'none'; script-src 'sha256-[A-Za-z0-9+/=]+';/.test(cardCsp) &&
      !cardCsp.includes("script-src 'self'") &&
      (card.headers.get('vary') ?? '').includes('User-Agent') &&
      cardBody.includes(`href="${publicHubUrl}/s/${code}?app=1">Mở Tò He</a>`) &&
      cardBody.includes('<script>'),
    `/s/${code} for a crawler: its own CSP, Vary: User-Agent, the script and the link that send a person on (${cardCsp})`,
  );
  // Sent on from a card (?app=1), a crawler's User-Agent too gets the app — a person in an in-app browser is never stuck.
  for (const path of [`/s/${code}?app=1`, '/r/123456?app=1']) {
    const page = await as(path, crawler);
    const body = await page.text();
    check(
      page.status === 200 &&
        body.includes('<div id="root">') &&
        (page.headers.get('content-security-policy') ?? '').includes("script-src 'self'") &&
        (page.headers.get('vary') ?? '').includes('User-Agent'),
      `${path} for a crawler's User-Agent: the app's page, with the hub's CSP and Vary (${page.status})`,
    );
  }
  for (const [who, userAgent] of Object.entries(people)) {
    for (const path of [`/s/${code}`, '/r/123456']) {
      const page = await as(path, userAgent);
      const body = await page.text();
      check(
        page.status === 200 &&
          body.includes('<div id="root">') &&
          meta(body, 'og:url') === `${publicHubUrl}${path}` &&
          (page.headers.get('content-security-policy') ?? '').includes("script-src 'self'"),
        `${path} for a person (${who}): the app's page, unchanged (${page.status})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nthe hub and the console serve the map');
