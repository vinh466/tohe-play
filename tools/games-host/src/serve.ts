// Local games origin (http://localhost:4730). Serves .out/games with the same headers as production:
// game CSP (embeddable only by the hub), CORS for catalog.json, no indexing, and `/` leading to the hub (ADR 0039).
// Caching is off locally because a rebuild reuses the same /<id>/<version>/ path; production marks versioned builds
// immutable.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@tohe/conformance/static-server';
import { gameContentSecurityPolicy } from '@tohe/contract';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = resolve(process.env.TOHE_GAMES_OUT ?? join(repoRoot, '.out/games'));
const port = Number(process.env.TOHE_GAMES_PORT ?? 4730);
const hubOrigins = (process.env.TOHE_HUB_ORIGINS ?? 'http://localhost:4720').split(',').map((o) => o.trim());
const csp = gameContentSecurityPolicy(hubOrigins);

const server = await serveStatic({
  root,
  port,
  host: '0.0.0.0',
  // Nothing to see at the origin's own front page: it leads to the hub (the first origin allowed to embed games).
  redirects: { '/': hubOrigins[0] ?? 'http://localhost:4720' },
  headers: (path): Record<string, string> => ({
    'x-robots-tag': 'noindex, nofollow',
    ...(path === '/catalog.json'
      ? { 'cache-control': 'no-cache', 'access-control-allow-origin': '*' }
      : { 'cache-control': 'no-cache', 'content-security-policy': csp }),
  }),
});
console.log(`games origin: ${server.url} (serving ${root}, embeddable by ${hubOrigins.join(', ')})`);
