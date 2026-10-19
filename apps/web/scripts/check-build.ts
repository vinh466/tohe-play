// Fails the build when the pages would break the rules of the root's namespace (ADR 0042, Caddyfile.hub):
//  - its CSP allows no inline script and no inline style, so every script and stylesheet must be a file;
//  - everything the build adds lives under /_web/ (the `public-assets` namespace), and the only page is index.html,
//    which the image puts in /srv/web, away from the app's own index.html.
// Runs on the built HTML, so it checks exactly what readers get.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const problems: string[] = [];

const top = readdirSync(dist).sort();
if (top.join() !== '_web,index.html')
  problems.push(`dist holds ${top.join(', ')}; expected _web and index.html only`);

for (const file of walk(dist)) {
  if (!file.endsWith('.html')) continue;
  const page = relative(dist, file);
  const html = readFileSync(file, 'utf8');
  for (const [, attributes = '', body = ''] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
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

if (problems.length > 0) {
  console.error(`check-build: ${problems.length} problem(s)\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log('check-build: no inline script or style, every asset under /_web/');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
