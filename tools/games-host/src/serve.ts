// Local games origin (http://localhost:4730). Serves .out/games with the same headers as production:
// game CSP (embeddable only by the hub) and CORS for catalog.json. Caching is off locally because a rebuild
// reuses the same /<id>/<version>/ path; production marks versioned builds immutable.
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
  headers: (path): Record<string, string> =>
    path === '/catalog.json'
      ? { 'cache-control': 'no-cache', 'access-control-allow-origin': '*' }
      : { 'cache-control': 'no-cache', 'content-security-policy': csp },
});
console.log(`games origin: ${server.url} (serving ${root}, embeddable by ${hubOrigins.join(', ')})`);
