// Renders public/og.png: the 1200×630 picture that link previews (Zalo, Messenger, Facebook, X, search results) show
// for every public page and for the app's own page. One shared image, made from the design tokens and the app's logo,
// so it follows the brand when they change. Run it after changing either, or the tagline, and commit the PNG:
//   pnpm --filter @tohe/web generate:og
// The PNG is committed, not built, so a build needs no browser; fonts are the machine's own, so a render on another
// machine differs in the pixels but not in the picture. Not checked for drift for that reason: check-build only
// checks that the file is there and is 1200×630.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..', '..');
const tokens = readFileSync(join(repo, 'packages', 'design-tokens', 'tokens.css'), 'utf8');
const logo = readFileSync(join(repo, 'apps', 'hub', 'public', 'favicon.svg'));

const html = `<!doctype html>
<html lang="vi">
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
        font-family: system-ui, "Noto Sans", "DejaVu Sans", sans-serif;
        color: var(--tohe-ink);
        background: linear-gradient(135deg, var(--tohe-soft-strong) 0%, var(--tohe-page) 70%);
      }
      .logo { flex: none; width: 250px; height: 250px; border-radius: 56px; box-shadow: 0 18px 48px var(--tohe-glow); }
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
      .t4 { background: var(--tohe-brand-ink); }
    </style>
  </head>
  <body>
    <img class="logo" alt="" src="data:image/svg+xml;base64,${logo.toString('base64')}" />
    <div class="words">
      <h1>Tò He</h1>
      <p class="tagline">Game nhỏ, mở ra là chơi</p>
      <p class="points">Không quảng cáo · Không cần tài khoản<br />Rủ bạn vào cùng bàn bằng một link</p>
    </div>
    <div class="tiles" aria-hidden="true">
      <div class="tile t1">2</div><div class="tile t2">4</div>
      <div class="tile t3">8</div><div class="tile t4">16</div>
    </div>
  </body>
</html>`;

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: join(web, 'public', 'og.png') });
await browser.close();
console.log('wrote apps/web/public/og.png (1200×630)');
