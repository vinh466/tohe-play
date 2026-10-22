// A new version of the hub never interrupts a page that is open (ADR 0046 "Updates wait", PB-17). Builds the hub twice —
// A, and B whose every chunk has another name, as after any deploy — serves them like the hub's Caddy does (the app's
// page in its namespaces, the files with their cache headers, a missing file a 404) and answers /api from here, so no
// stack is needed. A page opens on A; the server then serves B, as the hub's image after a deploy; the update check
// finds B's service worker, which must wait. Then:
// - the page, still running A, goes to a game (a lazy route) and must show it with no reload at all — neither the
//   browser's nor TanStack Router's reload on a missing chunk — once with A's files still in the HTTP cache and once
//   with that cache evicted, as a phone short of space does;
// - "Có bản mới — Tải lại" shows on the frame's screen (/play) and not over the game;
// - the next cold start (every page of the app closed, the app opened again) runs B;
// - "Tải lại" moves the page to B when the player taps it.
// Usage: pnpm --filter @tohe/hub updates
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { covers, hubNamespaces } from '@tohe/routes';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import { build } from 'vite';

const hub = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(hub, 'test-results', 'updates');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const builds = { a: join(out, 'a'), b: join(out, 'b') };

for (const [name, outDir] of Object.entries(builds)) {
  await build({
    root: hub,
    configFile: join(hub, 'vite.config.ts'),
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true },
    // B differs in every chunk, so every hashed name changes, as a real change to the app's code does.
    plugins: [
      {
        name: 'tohe:build-name',
        augmentChunkHash: () => name,
        renderChunk: (code) => `${code}\n/* build ${name} */\n`,
      },
    ],
  });
}

/** The app's own script in a build's page: which version a page runs. */
const entryScript = (html: string) => /<script type="module"[^>]*src="([^"]+)"/.exec(html)?.[1] ?? '';
const scripts = {
  a: entryScript(readFileSync(join(builds.a, 'index.html'), 'utf8')),
  b: entryScript(readFileSync(join(builds.b, 'index.html'), 'utf8')),
};
if (!scripts.a || !scripts.b || scripts.a === scripts.b) {
  throw new Error(`the two builds do not differ in their script: ${scripts.a} / ${scripts.b}`);
}

let serving = builds.a;
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const appPages = hubNamespaces.filter(
  (namespace) => namespace.component === 'app' && namespace.served === 'page',
);
const json = (body: unknown) => ({ type: 'application/json', body: JSON.stringify(body) });

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const origin = `http://${request.headers.host}`;
  const api: Record<string, { type: string; body: string } | undefined> = {
    '/api/config': json({
      gamesOrigin: origin,
      apiVersion: 'updates',
      telemetry: false,
      email: false,
      providers: [],
      passwordSignIn: true,
      registration: 'open',
      proofOfWork: false,
    }),
    '/api/games': json([
      {
        id: 'hello',
        name: 'Hello',
        version: '1.0.0',
        description: 'The minimal game.',
        entryUrl: `${origin}/__games/hello/index.html`,
        iconUrl: null,
        orientation: 'portrait',
        capabilities: [],
        tags: [],
        minAge: 0,
        sizeKb: 1,
        rooms: null,
        identity: { play: 'any', rooms: null },
        entries: [],
      },
    ]),
  };
  if (pathname === '/api/auth/me') return void response.writeHead(204).end();
  if (pathname.startsWith('/api/')) {
    const answer = api[pathname];
    response.writeHead(answer ? 200 : 404, { 'Content-Type': 'application/json' });
    return void response.end(answer?.body ?? '{}');
  }
  // The game's page: never answers, which is enough — the route is what is checked, not the game.
  if (pathname.startsWith('/__games/')) {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    return void response.end('<!doctype html><title>Hello</title>');
  }
  const page = appPages.some((namespace) => covers(namespace, pathname));
  const file = page ? join(serving, 'index.html') : join(serving, normalize(pathname));
  if (!file.startsWith(serving) || !existsSync(file) || !statSync(file).isFile()) {
    return void response.writeHead(404).end();
  }
  response.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    // As the hub's Caddy: hashed files kept a year, the rest asked again each time.
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(response);
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://localhost:${(server.address() as AddressInfo).port}`;

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

/** Which build the page runs, by the app's script in its document. */
const runs = (page: Page) =>
  page.evaluate(() => document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? '');

/** The game's tile in the catalog ("Chơi tiếp" holds it too once it was opened). */
const gameTile = (page: Page) => page.getByRole('link', { name: /Hello/ }).last();

/** "Có bản mới — Tải lại" (src/update/). */
const notice = (page: Page) => page.getByRole('status').filter({ hasText: 'Có bản mới' });

/** A page on A, controlled by A's service worker: the installed app opened again. */
async function openOnA(browser: Browser): Promise<Page> {
  serving = builds.a;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'vi-VN' });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log(`  page error: ${error.message}`));
  await page.goto(`${base}/play`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await gameTile(page).waitFor();
  return page;
}

/**
 * The deploy: the server serves B, and the page's update check finds B's service worker and installs it. Returns
 * whether B waits (true) or took over at once (false).
 */
async function deployB(page: Page): Promise<boolean> {
  serving = builds.b;
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('no service worker');
    const before = registration.active;
    await registration.update();
    const until = Date.now() + 15_000;
    return new Promise<boolean>((resolve, reject) => {
      const poll = () => {
        if (registration.waiting?.state === 'installed') return resolve(true);
        if (registration.active !== before && registration.active?.state === 'activated')
          return resolve(false);
        if (Date.now() > until) {
          const state = (worker: ServiceWorker | null) => worker?.state ?? 'none';
          return reject(
            new Error(
              `B's service worker did not install: installing ${state(registration.installing)}, waiting ${state(registration.waiting)}, active ${state(registration.active)}`,
            ),
          );
        }
        setTimeout(poll, 50);
      };
      poll();
    });
  });
}

/** Counts the page's loads from now on: any reload, the browser's or the router's. */
function countLoads(page: Page) {
  const loads = { count: 0 };
  page.on('load', () => loads.count++);
  return loads;
}

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
try {
  // The typical moment: the app open when a deploy lands, a game tapped. Once with A's files still in the browser's
  // HTTP cache (the hub's Caddy keeps /assets/ a year), once with that cache evicted, as a phone short of space does.
  let context: BrowserContext | null = null;
  for (const evicted of [false, true]) {
    const page = await openOnA(browser);
    context = page.context();
    const loads = countLoads(page);
    const missing: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 404) missing.push(new URL(response.url()).pathname);
    });
    const waits = await deployB(page);
    check(waits, `HTTP cache ${evicted ? 'evicted' : 'kept'}: B's service worker waits, A's keeps the page`);
    const offered = await notice(page)
      .waitFor({ timeout: 5000 })
      .then(
        () => true,
        () => false,
      );
    check(offered, `HTTP cache ${evicted ? 'evicted' : 'kept'}: "Có bản mới — Tải lại" shows on /play`);
    if (evicted) await (await context.newCDPSession(page)).send('Network.clearBrowserCache');
    await gameTile(page).click();
    const shown = await page
      .locator('iframe[title="Hello"]')
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    // TanStack Router's lazyRouteComponent reloads once on a failed dynamic import, and marks it in sessionStorage.
    const routerReloads = await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith('tanstack_router_reload:')),
    );
    check(
      shown,
      `HTTP cache ${evicted ? 'evicted' : 'kept'}: a game opened from a page on A after B was deployed shows the game ` +
        `(${new URL(page.url()).pathname}; 404: ${missing.join(', ') || 'none'})`,
    );
    check(
      loads.count === 0 && routerReloads.length === 0,
      `HTTP cache ${evicted ? 'evicted' : 'kept'}: no automatic reload (${loads.count} load(s); router's reload marks: ${routerReloads.join(', ') || 'none'})`,
    );
    check(
      (await runs(page)) === scripts.a,
      `HTTP cache ${evicted ? 'evicted' : 'kept'}: the open page still runs A`,
    );
    check(
      shown && !(await notice(page).isVisible()),
      `HTTP cache ${evicted ? 'evicted' : 'kept'}: the notice does not show over the game`,
    );
    if (!shown) {
      const text = (await page.locator('body').innerText()).slice(0, 300).replace(/\s+/g, ' ');
      console.log(`  the page shows: ${text}`);
      await page.screenshot({ path: join(out, `lazy-route-${evicted ? 'evicted' : 'kept'}.png`) });
    }
    if (evicted) break;
    await context.close();
  }

  // The next cold start: every page of the app closed, then the app opened again — B takes over.
  if (context) {
    for (const open of context.pages()) await open.close();
    const again = await context.newPage();
    await again.goto(`${base}/play`);
    await again.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await gameTile(again).waitFor();
    check((await runs(again)) === scripts.b, 'the next cold start runs B');
    await context.close();
  }

  // A long session: the player taps "Tải lại" on the frame's screen, and the page moves to B.
  const page = await openOnA(browser);
  await deployB(page);
  await notice(page).getByRole('button', { name: 'Tải lại' }).click();
  await page
    .waitForFunction(
      (b) => document.querySelector('script[type="module"][src]')?.getAttribute('src') === b,
      scripts.b,
      {
        timeout: 10_000,
      },
    )
    .then(
      () => check(true, '"Tải lại" moves the page to B'),
      () => check(false, '"Tải lại" moves the page to B'),
    );
  await page.context().close();
} finally {
  await browser.close();
  server.close();
}

rmSync(join(out, 'a'), { recursive: true, force: true });
rmSync(join(out, 'b'), { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
