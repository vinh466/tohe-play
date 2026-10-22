// What a game's link-preview picture is drawn from, as one sha256 per language (ADR 0047). The pictures are drawn by
// `pnpm --filter @tohe/web generate:og` (render-og.ts) and committed beside the page — games/<id>/page/og.vi.png and
// og.en.png — with games/<id>/page/og.json holding the stamp of each. The build (check-build.ts) recomputes the stamps
// from the sources and fails when one differs: the picture is out of date. No browser at build time.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameName } from '@tohe/contract';
import { siteWords } from '../src/content/site.ts';
import type { Lang } from '../src/i18n.ts';
import type { GameSource } from './game-sources.ts';

/**
 * The drawing's version: bump it when render-og.ts changes how a game's picture looks, or when the brand it is drawn
 * with changes (the design tokens, Tò He's logo), so every game's picture is redrawn and the build asks for it.
 */
export const GAME_PICTURE_VERSION = 1;

/** The committed picture of a game in `lang`, and the file of its stamps, inside the game's folder. */
export const picturePath = (lang: Lang) => join('page', `og.${lang}.png`);
export const stampPath = join('page', 'og.json');

/** The game's icon file (Tò He's own when the manifest names none). */
export const iconFile = (game: GameSource, logo: string): string =>
  game.manifest.icon ? join(game.folder, 'public', game.manifest.icon) : logo;

/** What a game's picture in `lang` shows: its name in that language, its kind, Tò He's tagline and its icon. */
export function pictureInputs(game: GameSource, lang: Lang, logo: string) {
  return {
    name: gameName(game.manifest, lang),
    kind: game.pages[lang].kind,
    tagline: siteWords[lang].tagline,
    icon: iconFile(game, logo),
  };
}

/** The stamp of a game's picture in `lang`: a sha256 of the drawing's version and of everything it is drawn from. */
export function pictureStamp(game: GameSource, lang: Lang, logo: string): string {
  const { name, kind, tagline, icon } = pictureInputs(game, lang, logo);
  const iconHash = createHash('sha256').update(readFileSync(icon)).digest('hex');
  return createHash('sha256')
    .update(JSON.stringify({ version: GAME_PICTURE_VERSION, name, kind, tagline, icon: iconHash }))
    .digest('hex');
}
