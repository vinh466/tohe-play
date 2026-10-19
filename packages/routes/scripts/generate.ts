// Writes what the map generates (src/generate.ts). The output is committed; CI fails when it drifts from the map.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  consoleCaddySnippet,
  hubCaddySnippet,
  hubPathsCs,
  hubSitemapCaddySnippet,
  robotsTxt,
} from '../src/generate.ts';

const root = new URL('../../../', import.meta.url);
const files = {
  'deploy/docker/hub-routes.caddy': hubCaddySnippet(),
  'deploy/docker/console-routes.caddy': consoleCaddySnippet(),
  'deploy/docker/hub-sitemap.caddy': hubSitemapCaddySnippet(),
  'apps/hub/public/robots.txt': robotsTxt(),
  'services/api/src/Tohe.Api/Infrastructure/HubPaths.g.cs': hubPathsCs(),
};

for (const [path, content] of Object.entries(files)) {
  writeFileSync(fileURLToPath(new URL(path, root)), content);
}
console.log(`wrote ${Object.keys(files).join(', ')}`);
