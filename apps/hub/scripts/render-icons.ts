// Renders public/favicon.svg into the PNG icons a PWA needs (iOS ignores SVG icons).
// Run after changing the logo: pnpm --filter @tohe/hub generate:icons
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(join(publicDir, 'favicon.svg'), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
for (const { file, size } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: join(publicDir, file), omitBackground: true });
  await page.close();
  console.log(`wrote public/${file}`);
}
await browser.close();
