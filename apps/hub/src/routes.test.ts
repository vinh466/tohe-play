// Every page of the hub's router and every file it ships must sit in a namespace of the map in @tohe/routes
// (ADR 0042): the hub's Caddy answers 404 to anything else, and the service worker leaves it to the network.
import { readdirSync, readFileSync } from 'node:fs';
import { matchHubPath } from '@tohe/routes';
import { describe, expect, it } from 'vitest';
import router from './router.tsx?raw';

it('routes only paths inside an app page namespace of @tohe/routes', () => {
  const paths = [...router.matchAll(/\bpath: '([^']+)'/g)].map((match) => match[1] as string);
  expect(paths.length).toBeGreaterThan(10);
  const outside = paths.filter((path) => {
    // $gameId, $code…: any one segment.
    const namespace = matchHubPath(path.replace(/\$\w+/g, 'x'));
    return namespace?.component !== 'app' || namespace.served !== 'page';
  });
  expect(outside, 'add a namespace to packages/routes/src/map.ts').toEqual([]);
});

describe('the console’s links back to the hub', () => {
  // The console (apps/console) has a host of its own (ADR 0042): a root-relative link there is a 404 of its own host,
  // so it links to the hub absolutely — hubLink(hubUrl, path), to the hub's public URL the API tells it.
  const consoleSrc = new URL('../../console/src/', import.meta.url);
  const sources = readdirSync(consoleSrc, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx') || file.endsWith('.ts'))
    .map((file) => [file, readFileSync(new URL(file, consoleSrc), 'utf8')] as const);

  it('are never root-relative', () => {
    expect(sources.length).toBeGreaterThan(10);
    const relative = sources.flatMap(([file, source]) =>
      [...source.matchAll(/\bhref=(?:"|\{\s*['"`])(\/[^"'`]*)/g)].map((match) => `${file}: ${match[1]}`),
    );
    expect(relative, 'link to the hub with hubLink(hubUrl, path) (apps/console/src/hub.ts)').toEqual([]);
  });

  it('lead to the app’s pages', () => {
    const paths = sources.flatMap(([, source]) =>
      [...source.matchAll(/\b(?:hubLink\(hubUrl, |path=)['"](\/[^'"?#]*)/g)].map(
        (match) => match[1] as string,
      ),
    );
    expect(paths.length).toBeGreaterThan(2);
    const outside = paths.filter((path) => {
      const namespace = matchHubPath(path);
      return namespace?.component !== 'app' || namespace.served !== 'page';
    });
    expect(outside, 'link the console to a page of packages/routes/src/map.ts').toEqual([]);
  });
});

it('ships only files of a namespace of @tohe/routes', () => {
  const files = readdirSync(new URL('../public', import.meta.url)).map((file) => `/${file}`);
  expect(files).toContain('/theme-init.js');
  const outside = files.filter((file) => {
    const namespace = matchHubPath(file);
    return namespace?.served !== 'static' && namespace?.served !== 'generated';
  });
  expect(outside, 'add the file to packages/routes/src/map.ts').toEqual([]);
});
