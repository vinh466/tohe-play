#!/usr/bin/env node
// The hub's image serves the map in @tohe/routes (ADR 0042): the root is the public home page, indexed, with a CSP of
// its own and assets under /_web/; every app namespace gets the app's page, not indexed; a path in no namespace gets a
// real 404; robots.txt and sitemap.xml are the ones the map generates; HSTS covers subdomains. Its second
// site serves the console's host: the console's page in the console's namespaces, never indexed, the API's console
// routes behind the console's own session, and nothing else.
// Runs against the hub's Caddy (docker compose up, CI's stack job), not `pnpm dev`, whose Vite answers every path
// with the app. Usage: HUB_URL=http://localhost:4720 CONSOLE_URL=http://localhost:4721 pnpm --filter @tohe/e2e routes
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
  const inline = /<script(?![^>]*\ssrc=)[^>]*>|<style[\s>]/.test(body);
  check(!inline, '/: no inline script or style in the page');
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
    sitemapPaths().every((path) => sitemap.body.includes(`<loc>${publicHubUrl}${path}</loc>`)),
  `/sitemap.xml: XML, the indexed pages with absolute URLs (${sitemap.response.status})`,
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

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nthe hub and the console serve the map');
