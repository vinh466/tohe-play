// Renders public/favicon.svg into the PNG icons a PWA needs (iOS ignores SVG icons).
// Run after changing the logo: pnpm --filter @tohe/hub generate:icons
//
// The PNGs are opaque: the brand colour fills the corners, because iOS paints transparency black and Android's masks
// crop a rounded tile's art. The favicon's rounded corners (`rx`) go; the launcher rounds the icon itself.
// `icon-maskable-512.png` is the same picture for `purpose: "maskable"`: Android may crop it to a circle of 80% of
// its width (the safe zone), and the face and the stand lie within 71% of it (the farthest point of the art, the
// bottom of the stand at (256, 438) of 512, is 182 px from the centre; the zone's radius is 205), so a mask never
// cuts the face. `src/icons.test.ts` checks the files are opaque and the sizes right.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const source = readFileSync(join(publicDir, 'favicon.svg'), 'utf8');
if (!source.includes(' rx="112"'))
  throw new Error('favicon.svg no longer has the rounded tile this script squares off');
const svg = source.replace(' rx="112"', ' rx="0"');
const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
for (const { file, size } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:#c8402a}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: join(publicDir, file) });
  await page.close();
  console.log(`wrote public/${file}`);
}
await browser.close();
