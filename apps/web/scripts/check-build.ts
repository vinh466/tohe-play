// Fails the build when the pages would break the rules of the root's namespaces (ADR 0042, Caddyfile.hub):
//  - the page's CSP allows no inline script and no inline style, so every script and stylesheet must be a file (a
//    JSON-LD block is data, not a script that runs: it is allowed, and must parse);
//  - everything the build adds lives under /_web/ (the `public-assets` namespace), and every other file lies in a
//    public namespace of the map in @tohe/routes: the pages the sitemap lists, /og.png and /llms.txt;
//  - every page a search engine or an AI reader may take has what they read: language, its own title and description,
//    a canonical link with the hub's URL, Open Graph and Twitter tags with the shared picture, one <h1>, the
//    structured data its kind of page deserves (WebSite and Organization on the home page, VideoGame on a game's page,
//    FAQPage on the FAQ with as many questions as the page shows);
//  - the pages written are exactly the pages the sitemap lists, and every link on a page leads where the map knows.
// Runs on the built HTML, so it checks exactly what readers get.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchHubPath, sitemapPaths } from '@tohe/routes';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(web, 'dist');
const games = join(web, '..', '..', 'games');
const hubUrl = (process.env.TOHE_HUB_URL ?? 'http://localhost:4720').replace(/\/$/, '');
const problems: string[] = [];

/** The games with a game.json: each has a page (the same rule as the routes' generator). */
const gameIds = readdirSync(games, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(games, entry.name, 'public', 'game.json')))
  .map(
    (entry) =>
      (JSON.parse(readFileSync(join(games, entry.name, 'public', 'game.json'), 'utf8')) as { id: string }).id,
  )
  .sort();
const expected = sitemapPaths(undefined, gameIds);

/** The address a file of dist is served at: a page's index.html is its folder. */
const addressOf = (file: string) => {
  const path = `/${relative(dist, file).split('\\').join('/')}`;
  return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
};

const built = [...walk(dist)];
const pages = new Set<string>();
for (const file of built) {
  const address = addressOf(file);
  if (address.startsWith('/_web/')) continue;
  const namespace = matchHubPath(address);
  if (namespace?.component !== 'public' || namespace.served !== 'static') {
    problems.push(`${address} is written outside the public namespaces of @tohe/routes`);
  }
  if (file.endsWith('.html')) pages.add(address);
}

for (const path of expected)
  if (!pages.has(path)) problems.push(`${path} is in the sitemap and was not built`);
for (const path of pages)
  if (!expected.includes(path)) problems.push(`${path} was built and is not in the sitemap`);
for (const path of ['/og.png', '/llms.txt']) {
  if (!existsSync(join(dist, path))) problems.push(`${path} is missing`);
}
if (existsSync(join(dist, 'og.png'))) {
  // A PNG's header names its size: width and height after the 8-byte signature and the IHDR chunk's name.
  const png = readFileSync(join(dist, 'og.png'));
  const size = `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`;
  if (size !== '1200×630') problems.push(`/og.png is ${size}, not 1200×630`);
}
const llms = existsSync(join(dist, 'llms.txt')) ? readFileSync(join(dist, 'llms.txt'), 'utf8') : '';
for (const path of expected) {
  if (path !== '/' && !llms.includes(`${hubUrl}${path}`)) problems.push(`/llms.txt does not list ${path}`);
}

const titles = new Map<string, string>();
const descriptions = new Map<string, string>();
for (const file of built) {
  if (!file.endsWith('.html')) continue;
  const page = addressOf(file);
  const html = readFileSync(file, 'utf8');
  checkCsp(page, html);
  checkHead(page, html);
  checkLinks(page, html);
}

if (problems.length > 0) {
  console.error(`check-build: ${problems.length} problem(s)\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-build: ${pages.size} pages, as the sitemap lists them; no inline script or style, every asset under /_web/; each page has its title, description, canonical, link preview and one h1`,
);

/** What the page's CSP allows: scripts and styles are files, and what they load lies under /_web/. */
function checkCsp(page: string, html: string) {
  for (const [, attributes = '', body = ''] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\stype="application\/ld\+json"/.test(` ${attributes}`)) continue;
    if (!/\ssrc="/.test(` ${attributes}`) || body.trim() !== '') problems.push(`${page}: an inline script`);
  }
  if (/<style\b/.test(html)) problems.push(`${page}: an inline <style>`);
  if (/\sstyle="/.test(html)) problems.push(`${page}: a style attribute`);
  if (/\son[a-z]+="/.test(html)) problems.push(`${page}: an event handler attribute`);
  for (const [, url = ''] of html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)="(\/[^"]*)"/g)) {
    if (url.startsWith('/_web/')) {
      if (!existsSync(join(dist, url))) problems.push(`${page}: ${url} is missing`);
    } else if (url !== '/favicon.svg') {
      problems.push(`${page}: ${url} is outside /_web/`);
    }
  }
}

/** What search engines and AI readers take from a page. */
function checkHead(page: string, html: string) {
  const meta = (attribute: string, name: string) =>
    new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="([^"]*)"`).exec(html)?.[1]?.trim() ?? '';
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '';
  const description = meta('name', 'description');
  const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? '';
  if (!/<html lang="vi"/.test(html)) problems.push(`${page}: no lang="vi"`);
  if (title === '') problems.push(`${page}: no <title>`);
  if (description === '') problems.push(`${page}: no meta description`);
  if (canonical !== `${hubUrl}${page}`) {
    problems.push(`${page}: the canonical link is "${canonical}", not "${hubUrl}${page}"`);
  }
  for (const name of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (meta('property', name) === '') problems.push(`${page}: no ${name}`);
  }
  if (meta('property', 'og:url') !== `${hubUrl}${page}`)
    problems.push(`${page}: og:url is not the canonical URL`);
  if (meta('property', 'og:image') !== `${hubUrl}/og.png`)
    problems.push(`${page}: og:image is not ${hubUrl}/og.png`);
  if (meta('name', 'twitter:card') === '') problems.push(`${page}: no twitter:card`);
  const headings = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (headings !== 1) problems.push(`${page}: ${headings} <h1>, not one`);
  if (title !== '' && titles.has(title)) problems.push(`${page}: the title is also ${titles.get(title)}'s`);
  if (description !== '' && descriptions.has(description)) {
    problems.push(`${page}: the description is also ${descriptions.get(description)}'s`);
  }
  titles.set(title, page);
  descriptions.set(description, page);
  checkStructuredData(page, html);
}

/** JSON-LD: every block parses, and each kind of page has its types. */
function checkStructuredData(page: string, html: string) {
  const types: string[] = [];
  const nodes: Record<string, unknown>[] = [];
  for (const [, body = ''] of html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      if (data['@context'] !== 'https://schema.org')
        problems.push(`${page}: JSON-LD without schema.org's context`);
      types.push(String(data['@type']));
      nodes.push(data);
    } catch {
      problems.push(`${page}: a JSON-LD block that is not JSON`);
    }
  }
  const need = (...wanted: string[]) => {
    for (const type of wanted)
      if (!types.includes(type)) problems.push(`${page}: no ${type} structured data`);
  };
  if (page === '/') need('WebSite', 'Organization');
  if (page.startsWith('/games/') && page !== '/games/') need('VideoGame');
  if (page === '/faq/') {
    need('FAQPage');
    const shown = html.match(/<summary[\s>]/g)?.length ?? 0;
    const entity = nodes.find((node) => node['@type'] === 'FAQPage')?.mainEntity;
    const asked = Array.isArray(entity) ? entity.length : 0;
    if (shown === 0 || shown !== asked)
      problems.push(`${page}: the page shows ${shown} questions, its data ${asked}`);
    if (shown < 8 || shown > 12) problems.push(`${page}: ${shown} questions; 8 to 12 are expected`);
  }
}

/** A link on the page that starts with a slash leads to a page that exists, the app, or a file of the map. */
function checkLinks(page: string, html: string) {
  for (const [, href = ''] of html.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)/g)) {
    const namespace = matchHubPath(href);
    if (namespace === undefined) {
      problems.push(`${page}: a link to ${href}, which no namespace of @tohe/routes owns`);
    } else if (namespace.component === 'public' && namespace.indexed && !pages.has(href)) {
      problems.push(`${page}: a link to ${href}, which was not built`);
    }
  }
  for (const [, id = ''] of html.matchAll(/<a\b[^>]*\shref="#([^"]+)"/g)) {
    if (!html.includes(`id="${id}"`)) problems.push(`${page}: a link to #${id}, which is not on the page`);
  }
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (statSync(path).isFile()) yield path;
  }
}
