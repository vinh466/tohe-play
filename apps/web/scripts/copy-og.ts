// The build's step after `astro build`: copies each game's committed link-preview pictures (ADR 0047) under its pages —
// games/<id>/page/og.vi.png to dist/games/<id>/og.png, og.en.png to dist/en/games/<id>/og.png — where each page's
// og:image names them. No browser here: `pnpm --filter @tohe/web generate:og` draws them (render-og.ts), and
// check-build.ts fails when one is missing or out of date. A missing one is left for check-build to report.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { languages, localPath } from '../src/i18n.ts';
import { readGameSources } from './game-sources.ts';
import { picturePath } from './og-stamp.ts';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const { games } = readGameSources(join(web, '..', '..', 'games'));
let copied = 0;
for (const game of games) {
  for (const lang of languages) {
    const from = join(game.folder, picturePath(lang));
    if (!existsSync(from)) continue;
    const to = join(web, 'dist', ...localPath(lang, `/games/${game.id}/`).split('/'), 'og.png');
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    copied += 1;
  }
}
console.log(`copy-og: ${copied} game picture(s) copied under their pages`);
