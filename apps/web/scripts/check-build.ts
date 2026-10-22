// Fails the build when the pages would break the rules of the root's namespaces (ADR 0042, Caddyfile.hub):
//  - the page's CSP allows no inline script and no inline style, so every script and stylesheet must be a file (a
//    JSON-LD block is data, not a script that runs: it is allowed, and must parse);
//  - everything the build adds lives under /_web/ (the `public-assets` namespace), and every other file lies in a
//    public namespace of the map in @tohe/routes: the pages the sitemap lists, /og.png and /llms.txt;
//  - every page a search engine or an AI reader may take has what they read: its own title and description, Open
//    Graph and Twitter tags with its picture (a game's page its own, the others the shared one), one <h1>, the
//    structured data its kind of page deserves (WebSite, Organization and ItemList on the home pages, VideoGame and
//    BreadcrumbList on a game's page, WebPage on the promise, FAQPage on the FAQ with as many questions as the page
//    shows);
//  - one source per game (ADR 0047): every game with a game.json has games/<id>/page/vi.md, en.md and facts.json, each
//    as src/content/game-page.ts wants it, and a preview picture per language, 1200×630 — drawn by generate:og,
//    committed as page/og.vi.png and og.en.png with their stamps in page/og.json (og-stamp.ts), which must match what
//    the sources give now, and copied to /games/<id>/og.png and /en/games/<id>/og.png by copy-og.ts; the home pages,
//    the games' pages and the promise show the day their words were last revised;
//  - the languages (ADR 0047, language-rules.ts, which has the tests): every page of the sitemap has its pair in the
//    other language but the declared Vietnamese-only ones, and the sitemap's hreflang alternates name each other both
//    ways; each page's <html lang>, og:locale and its alternate,
//    canonical link to itself, JSON-LD in its language, links that stay in its language, and an English page's links
//    into the app with ?lang=en;
//  - the pages written are exactly the pages the sitemap lists, and every link on a page leads where the map knows.
// Runs on the built HTML, so it checks exactly what readers get.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchHubPath, pathInLanguage, sitemapEntries, sitemapPaths } from '@tohe/routes';
import { IsoDate } from '../src/content/game-page.ts';
import { languages, localPath } from '../src/i18n.ts';
import { readGameSources } from './game-sources.ts';
import { languageProblems, pairProblems } from './language-rules.ts';
import { picturePath, pictureStamp, stampPath } from './og-stamp.ts';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(web, 'dist');
const games = join(web, '..', '..', 'games');
/** Tò He's logo, which a game's picture shows beside the tagline. */
const logoFile = join(web, '..', 'hub', 'public', 'favicon.svg');
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
/** Each game's page sources (games/<id>/page/): a game without them, or with a broken one, is a problem. */
const sources = readGameSources(games);
problems.push(...sources.problems);

/** A game's page, in either language: /games/<id>/ or /en/games/<id>/. */
const isGamePage = (page: string) => /^\/games\/[^/]+\/$/.test(pathInLanguage(page, 'vi'));
/** The pages that show the day their words were last revised: the home pages, the games' pages and the promise. */
const datedPage = (page: string) =>
  ['/', '/promise/'].includes(pathInLanguage(page, 'vi')) || isGamePage(page);

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

problems.push(...pairProblems(expected));
// hreflang in the sitemap: a page's alternates name the same pages as each of its alternates' do, both ways.
const entries = new Map(sitemapEntries(undefined, gameIds).map((entry) => [entry.path, entry.alternates]));
for (const [path, alternates] of entries) {
  const names = JSON.stringify(alternates);
  for (const alternate of alternates) {
    if (JSON.stringify(entries.get(alternate.path)) !== names) {
      problems.push(
        `${path} names ${alternate.path} as its ${alternate.hreflang} page in the sitemap, which does not name it back`,
      );
    }
  }
}
for (const path of expected)
  if (!pages.has(path)) problems.push(`${path} is in the sitemap and was not built`);
for (const path of pages)
  if (!expected.includes(path)) problems.push(`${path} was built and is not in the sitemap`);
if (!existsSync(join(dist, 'llms.txt'))) problems.push('/llms.txt is missing');
// The link-preview pictures: the shared one, and each game's in each language, drawn by generate:og and committed
// beside the game's page with the stamp of what each was drawn from; the stamps are recomputed here from the sources.
const redraw = 'run pnpm --filter @tohe/web generate:og';
for (const game of sources.games) {
  const stampFile = join(game.folder, stampPath);
  const kept = existsSync(stampFile)
    ? (JSON.parse(readFileSync(stampFile, 'utf8')) as Record<string, string>)
    : {};
  for (const lang of languages) {
    const picture = `games/${relative(games, game.folder)}/${picturePath(lang)}`;
    if (!existsSync(join(game.folder, picturePath(lang)))) problems.push(`${picture} is missing: ${redraw}`);
    else if (kept[lang] !== pictureStamp(game, lang, logoFile))
      problems.push(
        `${picture} is out of date (its name, kind, tagline, icon or drawing changed): ${redraw}`,
      );
  }
}
for (const path of [
  '/og.png',
  ...gameIds.flatMap((id) => languages.map((lang) => `${localPath(lang, `/games/${id}/`)}og.png`)),
]) {
  const file = join(dist, path);
  if (!existsSync(file)) {
    problems.push(`${path} is missing${path === '/og.png' ? '' : `: ${redraw}`}`);
    continue;
  }
  // A PNG's header names its size: width and height after the 8-byte signature and the IHDR chunk's name.
  const png = readFileSync(file);
  const size = `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`;
  if (size !== '1200×630') problems.push(`${path} is ${size}, not 1200×630`);
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
  problems.push(...languageProblems(page, html, hubUrl));
}

if (problems.length > 0) {
  console.error(`check-build: ${problems.length} problem(s)\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-build: ${pages.size} pages, as the sitemap lists them, each with its pair in the other language but the Vietnamese-only ones; ${sources.games.length} games, each with its page sources and a picture per language; no inline script or style, every asset under /_web/; each page has its language, title, description, canonical, link preview and one h1`,
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
  // The language and the canonical link are language-rules.ts'.
  if (title === '') problems.push(`${page}: no <title>`);
  if (description === '') problems.push(`${page}: no meta description`);
  for (const name of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (meta('property', name) === '') problems.push(`${page}: no ${name}`);
  }
  if (meta('property', 'og:url') !== `${hubUrl}${page}`)
    problems.push(`${page}: og:url is not the canonical URL`);
  const picture = `${hubUrl}${isGamePage(page) ? `${page}og.png` : '/og.png'}`;
  if (meta('property', 'og:image') !== picture) problems.push(`${page}: og:image is not ${picture}`);
  if (datedPage(page)) {
    const day = /<p class="updated">[^<]*<time datetime="([^"]*)">/.exec(html)?.[1];
    if (day === undefined) problems.push(`${page}: no day its words were last revised (<p class="updated">)`);
    else if (!IsoDate.safeParse(day).success)
      problems.push(`${page}: the day it was revised, "${day}", is no day`);
  }
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
  // The same kind of page in either language: /en/faq/ is a FAQ as /faq/ is.
  const kind = pathInLanguage(page, 'vi');
  if (kind === '/') need('WebSite', 'Organization', 'ItemList');
  if (isGamePage(page)) need('VideoGame', 'BreadcrumbList');
  if (kind === '/promise/') need('WebPage');
  if (kind === '/faq/') {
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
