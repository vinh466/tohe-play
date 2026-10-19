// Renders the screenshots the app's manifest lists (public/screenshots/): what the install dialog of Android shows
// next to "Cài Tò He". Reproducible: builds the hub, serves it with `vite preview`, answers /api from here (no stack
// needed) and shoots the catalog the way a new visitor sees it — as a guest, light and dark, narrow and wide.
// Run after changing the catalog's look: pnpm --filter @tohe/hub generate:screenshots [outDir]
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const hub = join(dirname(fileURLToPath(import.meta.url)), '..');
const games = join(hub, '..', '..', 'games');
const out = process.argv[2] ?? join(hub, 'public', 'screenshots');
const port = 4729;
const origin = `http://127.0.0.1:${port}`;

// The games the catalog lists, from their own manifests and icons.
const catalog = ['merge-block', 'tap-merge', 'tien-len', 'hello'].map((id) => {
  const dir = join(games, id, 'public');
  const manifest = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')) as {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: string[];
    tags: string[];
    minAge: number;
  };
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    entryUrl: `https://games.example/${id}/index.html`,
    iconUrl: `${origin}/__icons/${id}.svg`,
    orientation: 'portrait',
    capabilities: manifest.capabilities,
    tags: manifest.tags,
    minAge: manifest.minAge,
    sizeKb: 500,
    rooms: null,
  };
});

const shots = [
  { file: 'catalog-light.png', width: 390, height: 844, scheme: 'light', mobile: true, scale: 2 },
  { file: 'catalog-dark.png', width: 390, height: 844, scheme: 'dark', mobile: true, scale: 2 },
  { file: 'catalog-wide.png', width: 1280, height: 720, scheme: 'light', mobile: false, scale: 1 },
] as const;

execFileSync('pnpm', ['exec', 'vite', 'build'], { cwd: hub, stdio: 'inherit' });
const preview = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  {
    cwd: hub,
    stdio: 'ignore',
  },
);
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
try {
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(origin).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (attempt === 100) throw new Error('vite preview did not start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  mkdirSync(out, { recursive: true });
  for (const { file, width, height, scheme, mobile, scale } of shots) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      isMobile: mobile,
      hasTouch: mobile,
      locale: 'vi-VN',
      colorScheme: scheme,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    // The device is new: nobody signed in (204), so the hub plays it as a guest at once.
    await page.route('**/api/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/api/auth/me') return route.fulfill({ status: 204 });
      if (pathname === '/api/games') return route.fulfill({ json: catalog });
      if (pathname === '/api/config') {
        return route.fulfill({
          json: {
            gamesOrigin: 'https://games.example',
            apiVersion: 'screenshots',
            telemetry: false,
            email: false,
            providers: [],
            passwordSignIn: true,
            registration: 'open',
            proofOfWork: false,
          },
        });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    await page.route('**/__icons/*.svg', (route) => {
      const id = new URL(route.request().url()).pathname.split('/').pop()?.replace('.svg', '') ?? '';
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: readFileSync(join(games, id, 'public', 'icon.svg')),
      });
    });
    await page.goto(`${origin}/play`);
    await page.getByRole('link', { name: /Ghép Khối/ }).waitFor();
    // Let the entrance animations settle, so the picture shows final colours.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    await page.screenshot({ path: join(out, file) });
    await context.close();
    console.log(`wrote ${join(out, file)}`);
  }
} finally {
  await browser.close();
  preview.kill();
}
