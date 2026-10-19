// Every page of the hub's router and every file it ships must sit in a namespace of the map in @tohe/routes
// (ADR 0042): the hub's Caddy answers 404 to anything else, and the service worker leaves it to the network.
import { readdirSync } from 'node:fs';
import { matchHubPath } from '@tohe/routes';
import { expect, it } from 'vitest';
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

it('ships only files of a namespace of @tohe/routes', () => {
  const files = readdirSync(new URL('../public', import.meta.url)).map((file) => `/${file}`);
  expect(files).toContain('/theme-init.js');
  const outside = files.filter((file) => {
    const namespace = matchHubPath(file);
    return namespace?.served !== 'static' && namespace?.served !== 'generated';
  });
  expect(outside, 'add the file to packages/routes/src/map.ts').toEqual([]);
});
