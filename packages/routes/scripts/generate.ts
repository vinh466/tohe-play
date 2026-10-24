// Writes what the map generates (src/generate.ts). The output is committed; CI fails when it drifts from the map.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  consoleCaddySnippet,
  hubCaddySnippet,
  hubPathsCs,
  hubSitemapCaddySnippet,
  robotsTxt,
  studioCaddySnippet,
} from '../src/generate.ts';

const root = new URL('../../../', import.meta.url);

// The games whose pages the sitemap lists: every games/<id>/public/game.json (a folder with only a SPEC.md is no game
// yet). The public pages' build reads the same files and its check compares.
const gamesDir = new URL('games/', root);
const gameIds = readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/public/game.json`, gamesDir)))
  .map((entry) => {
    const { id } = JSON.parse(readFileSync(new URL(`${entry.name}/public/game.json`, gamesDir), 'utf8')) as {
      id: string;
    };
    return id;
  })
  .sort();

const files = {
  'deploy/docker/hub-routes.caddy': hubCaddySnippet(),
  'deploy/docker/console-routes.caddy': consoleCaddySnippet(),
  'deploy/docker/studio-routes.caddy': studioCaddySnippet(),
  'deploy/docker/hub-sitemap.caddy': hubSitemapCaddySnippet(undefined, gameIds),
  'apps/hub/public/robots.txt': robotsTxt(),
  'services/api/src/Tohe.Api/Infrastructure/HubPaths.g.cs': hubPathsCs(),
};

for (const [path, content] of Object.entries(files)) {
  writeFileSync(fileURLToPath(new URL(path, root)), content);
}
console.log(`wrote ${Object.keys(files).join(', ')}`);
