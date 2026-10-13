// Fails the site build when a page links to an internal path (or #anchor) that was not generated.
// Runs on the built HTML, so it checks exactly what readers get, whatever produced the link.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const pages = new Map<string, string>();
for (const file of walk(dist)) {
  if (!file.endsWith('.html')) continue;
  const route = `/${relative(dist, file)
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '')}`;
  pages.set(route, readFileSync(file, 'utf8'));
}

const anchorsOf = (html: string) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const problems: string[] = [];
for (const [route, html] of pages) {
  for (const [, href = ''] of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const [path = '', hash] = href.split('#');
    if (/\.[a-z0-9]+$/i.test(path)) {
      if (!existsSync(join(dist, path))) problems.push(`${route} -> ${href} (missing file)`);
      continue;
    }
    const target = path.endsWith('/') ? path : `${path}/`;
    const page = pages.get(target);
    if (page === undefined) problems.push(`${route} -> ${href} (no such page)`);
    else if (hash && !anchorsOf(page).has(decodeURIComponent(hash)))
      problems.push(`${route} -> ${href} (no such anchor)`);
  }
}

if (problems.length > 0) {
  console.error(`check-links: ${problems.length} broken link(s)\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(`check-links: ${pages.size} pages, all internal links resolve`);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
