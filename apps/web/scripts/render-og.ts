// Draws the link-preview pictures (1200×630) that Zalo, Messenger, Facebook, X and search results show, from the
// design tokens and the logos, so they follow the brand when those change. Run it, look at the pictures, commit them:
//
//   pnpm --filter @tohe/web generate:og            everything below
//   pnpm --filter @tohe/web generate:og --games    the games' pictures only
//   … --force                                       redraw the games' pictures even where they are up to date
//
//   public/og.png                    the shared picture of every page but a game's, and of the app's own page
//   games/<id>/page/og.vi.png, …en   a game's own picture in each language (ADR 0047): its icon, its name in that
//                                    language (game.json), its kind (page/<lang>.md) and Tò He's tagline; with
//                                    games/<id>/page/og.json, the stamp of what each was drawn from (og-stamp.ts).
//                                    A game's picture is redrawn only when its stamp no longer matches.
//
// Chromium draws them (Playwright: `pnpm --filter @tohe/web exec playwright install chromium`, or Chrome) with the
// machine's fonts — have Noto Sans, which has Vietnamese in bold. Nothing here runs at build time: the build copies the
// committed pictures under each game's page (copy-og.ts), and check-build.ts fails when one is missing, not 1200×630,
// or out of date.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { languages } from '../src/i18n.ts';
import { readGameSources } from './game-sources.ts';
import { pictureInputs, picturePath, pictureStamp, stampPath } from './og-stamp.ts';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..', '..');
const tokens = readFileSync(join(repo, 'packages', 'design-tokens', 'tokens.css'), 'utf8');
const logoFile = join(repo, 'apps', 'hub', 'public', 'favicon.svg');
const logo = dataUrl(logoFile);

function dataUrl(file: string): string {
  const type = extname(file) === '.svg' ? 'image/svg+xml' : 'image/png';
  return `data:${type};base64,${readFileSync(file).toString('base64')}`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (lang: string, style: string, body: string) => `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <style>
      ${tokens}
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
      body {
        display: flex;
        align-items: center;
        gap: 56px;
        padding: 0 88px;
        font-family: "Noto Sans", system-ui, "DejaVu Sans", sans-serif;
        color: var(--tohe-ink);
        background: linear-gradient(135deg, var(--tohe-soft-strong) 0%, var(--tohe-page) 70%);
      }
      ${style}
    </style>
  </head>
  <body>${body}</body>
</html>`;

/** The shared picture: the logo, the name, the tagline. */
const shared = page(
  'vi',
  `.logo { flex: none; width: 250px; height: 250px; border-radius: 56px; box-shadow: 0 18px 48px var(--tohe-glow); }
      .words { flex: 1; min-width: 0; }
      h1 { margin: 0; font-size: 150px; line-height: 1; font-weight: 900; color: var(--tohe-brand-ink); }
      .tagline { margin: 20px 0 0; font-size: 58px; line-height: 1.15; font-weight: 800; }
      .points { margin: 24px 0 0; font-size: 34px; line-height: 1.3; color: var(--tohe-ink-soft); }
      .tiles { position: absolute; right: 72px; top: 60px; display: grid; grid-template-columns: repeat(2, 84px); gap: 12px; }
      .tile {
        display: grid; place-items: center; height: 84px; border-radius: 20px;
        font-size: 38px; font-weight: 900; color: var(--tohe-on-brand);
      }
      .t1 { background: var(--tohe-brand); }
      .t2 { background: var(--tohe-brand-strong); }
      .t3 { background: var(--tohe-accent); }
      .t4 { background: var(--tohe-brand-ink); }`,
  `
    <img class="logo" alt="" src="${logo}" />
    <div class="words">
      <h1>Tò He</h1>
      <p class="tagline">Game nhỏ, mở ra là chơi</p>
      <p class="points">Không quảng cáo · Không cần tài khoản<br />Rủ bạn vào cùng bàn bằng một link</p>
    </div>
    <div class="tiles" aria-hidden="true">
      <div class="tile t1">2</div><div class="tile t2">4</div>
      <div class="tile t3">8</div><div class="tile t4">16</div>
    </div>
  `,
);

/** A game's picture in one language: its icon, its name, what it is, and Tò He's name and tagline. */
const gameCard = (lang: string, icon: string, name: string, kind: string, tagline: string) =>
  page(
    lang,
    `.icon { flex: none; width: 280px; height: 280px; border-radius: 64px; box-shadow: 0 18px 48px var(--tohe-glow); }
      .words { flex: 1; min-width: 0; }
      h1 { margin: 0; font-size: 104px; line-height: 1.05; font-weight: 900; color: var(--tohe-brand-ink); }
      .kind { margin: 20px 0 0; font-size: 46px; line-height: 1.2; font-weight: 700; }
      .brand { display: flex; align-items: center; gap: 18px; margin: 44px 0 0; font-size: 34px; font-weight: 700; color: var(--tohe-ink-soft); }
      .brand img { width: 64px; height: 64px; border-radius: 16px; }`,
    `
    <img class="icon" alt="" src="${icon}" />
    <div class="words">
      <h1>${escapeHtml(name)}</h1>
      <p class="kind">${escapeHtml(kind.charAt(0).toUpperCase() + kind.slice(1))}</p>
      <p class="brand"><img alt="" src="${logo}" />Tò He · ${escapeHtml(tagline)}</p>
    </div>
  `,
  );

const gamesOnly = process.argv.includes('--games');
const force = process.argv.includes('--force');
const pictures: { file: string; html: string }[] = [];
const stampFiles: { file: string; stamps: Record<string, string> }[] = [];
if (!gamesOnly) pictures.push({ file: join(web, 'public', 'og.png'), html: shared });
const sources = readGameSources(join(repo, 'games'));
if (sources.problems.length > 0) throw new Error(`render-og: ${sources.problems.join('\n  ')}`);
for (const game of sources.games) {
  const stampFile = join(game.folder, stampPath);
  const wanted = Object.fromEntries(languages.map((lang) => [lang, pictureStamp(game, lang, logoFile)]));
  const kept = existsSync(stampFile)
    ? (JSON.parse(readFileSync(stampFile, 'utf8')) as Record<string, string>)
    : {};
  const stale = languages.filter(
    (lang) => force || kept[lang] !== wanted[lang] || !existsSync(join(game.folder, picturePath(lang))),
  );
  for (const lang of stale) {
    const { name, kind, tagline, icon } = pictureInputs(game, lang, logoFile);
    pictures.push({
      file: join(game.folder, picturePath(lang)),
      html: gameCard(lang, dataUrl(icon), name, kind, tagline),
    });
  }
  if (stale.length > 0) stampFiles.push({ file: stampFile, stamps: wanted });
}

if (pictures.length > 0) {
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const { file, html } of pictures) {
    await tab.setContent(html);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await tab.screenshot());
  }
  await browser.close();
}
for (const { file, stamps } of stampFiles) writeFileSync(file, `${JSON.stringify(stamps, null, 2)}\n`);
console.log(
  pictures.length === 0
    ? 'render-og: every picture is up to date'
    : `render-og: ${pictures.length} picture(s), 1200×630: ${pictures.map(({ file }) => file.slice(repo.length + 1)).join(', ')}`,
);
