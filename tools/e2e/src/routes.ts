#!/usr/bin/env node
// The hub's image serves the map in @tohe/routes (ADR 0042): every app namespace gets the app's page, not indexed;
// a path in no namespace gets a real 404; robots.txt is the one the map generates; HSTS covers subdomains.
// Runs against the hub's Caddy (docker compose up, CI's stack job), not `pnpm dev`, whose Vite answers every path
// with the app. Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e routes
import { hubNamespaces, robotsTxt } from '@tohe/routes';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

const get = async (path: string) => {
  const response = await fetch(new URL(path, hubUrl), { redirect: 'manual' });
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

for (const path of [
  '/nope',
  '/sitemap.xml',
  '/playground',
  '/admin-old',
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
    robots.body === robotsTxt(),
  `/robots.txt: text, as the map generates it (${robots.response.status})`,
);

const contact = process.env.TOHE_SECURITY_CONTACT;
const security = await get('/.well-known/security.txt');
check(
  contact
    ? security.response.status === 200 && security.body.includes(`Contact: mailto:${contact}\n`)
    : security.response.status === 404,
  `/.well-known/security.txt: ${contact ? `names ${contact}` : '404 without TOHE_SECURITY_CONTACT'} (${security.response.status})`,
);

const health = await get('/api/health');
check(health.response.status === 200, `/api/health: proxied to the API (${health.response.status})`);
check(
  (health.response.headers.get('strict-transport-security') ?? '').includes('includeSubDomains'),
  'HSTS includes subdomains',
);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nthe hub serves the map');
