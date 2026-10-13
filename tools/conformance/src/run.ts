// Conformance kit: decides whether a built game honours the Game Contract, whatever it is written in.
// It serves the build on its own origin with the production CSP, embeds it in a fake hub on a second
// origin, drives the protocol from Node through @tohe/game-sdk/host, and throws random input at it.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  type GameManifest,
  GameManifest as GameManifestSchema,
  gameContentSecurityPolicy,
} from '@tohe/contract';
import { createHost, type Transport } from '@tohe/game-sdk/host';
import { type Browser, chromium, type Frame, type Page } from 'playwright';
import { serveStatic } from './static-server.ts';

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ConformanceResult {
  gameId: string | null;
  checks: Check[];
  ok: boolean;
  screenshot?: string;
}

export interface ConformanceOptions {
  /** Milliseconds of random input. Default 4000. */
  monkeyMs?: number;
  /** Where to write the screenshot. Default ./test-results/conformance. */
  outDir?: string;
}

export async function runConformance(
  distDir: string,
  options: ConformanceOptions = {},
): Promise<ConformanceResult> {
  const dist = resolve(distDir);
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });
  const done = (gameId: string | null, screenshot?: string): ConformanceResult => ({
    gameId,
    checks,
    ok: checks.every((c) => c.ok),
    screenshot,
  });

  // ---------------------------------------------------------------- static checks
  const manifestPath = join(dist, 'game.json');
  if (!existsSync(manifestPath)) {
    check('game.json present in build output', false, `missing ${manifestPath} (put it in public/)`);
    return done(null);
  }
  const parsed = GameManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  check('game.json is valid', parsed.success, parsed.success ? undefined : parsed.error.message);
  if (!parsed.success) return done(null);
  const manifest: GameManifest = parsed.data;

  check('entry file exists', existsSync(join(dist, manifest.entry)), manifest.entry);
  if (manifest.icon) check('icon exists', existsSync(join(dist, manifest.icon)), manifest.icon);
  const sizeKb = Math.ceil(dirSize(dist) / 1024);
  check(
    'build fits the size budget',
    sizeKb <= manifest.sizeBudgetKb,
    `${sizeKb} KB of ${manifest.sizeBudgetKb} KB`,
  );

  // ---------------------------------------------------------------- runtime checks
  const hostDir = mkdtempSync(join(tmpdir(), 'tohe-conformance-'));
  const hostServer = await serveStatic({ root: hostDir });
  const gameServer = await serveStatic({
    root: dist,
    headers: () => ({ 'content-security-policy': gameContentSecurityPolicy([hostServer.url]) }),
  });
  writeFileSync(
    join(hostDir, 'index.html'),
    hostPage(new URL(manifest.entry, `${gameServer.url}/`).href, gameServer.url),
  );

  const allowedOrigins = new Set([hostServer.url, gameServer.url]);
  const foreignRequests: string[] = [];
  const errors: string[] = [];
  const protocolErrors: string[] = [];
  const traffic = { saves: 0, scores: 0, logs: 0 };
  let browser: Browser | undefined;
  let screenshot: string | undefined;

  try {
    browser = await launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'vi-VN',
    });
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('blob:') || allowedOrigins.has(new URL(url).origin))
        return route.continue();
      foreignRequests.push(url);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));

    const listeners = new Set<(message: unknown) => void>();
    await page.exposeFunction('__toNode', (message: unknown) => {
      for (const listener of listeners) listener(message);
    });
    const transport: Transport = {
      post: (message) =>
        void page.evaluate((m) => (window as unknown as Bridge).__toGame(m), message).catch(() => {}),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const host = createHost({
      transport,
      manifest,
      readyTimeoutMs: 10_000,
      init: () => ({
        profile: { id: 'conformance', name: 'Tester' },
        locale: 'vi',
        settings: { muted: true },
        save: null,
        seed: 20261013,
      }),
      onSave: () => void traffic.saves++,
      onScore: () => void traffic.scores++,
      onLog: () => void traffic.logs++,
      onProtocolError: (error) => protocolErrors.push(error),
    });

    await page.goto(hostServer.url);
    const handshake = await host.ready.then(
      () => null,
      (error: Error) => error.message,
    );
    check('handshake: ready -> init within 10 s', handshake === null, handshake ?? undefined);

    if (handshake === null) {
      const frame = await gameFrame(page, gameServer.url);
      await monkey(page, frame, options.monkeyMs ?? 4000, host);
      const alive = await frame
        .evaluate(() => document.readyState)
        .then(
          () => true,
          () => false,
        );
      check('survives random input, pause/resume and settings', alive);
      const outDir = resolve(options.outDir ?? 'test-results/conformance');
      mkdirSync(outDir, { recursive: true });
      screenshot = join(outDir, `${manifest.id}.png`);
      await page.screenshot({ path: screenshot });
    }
    host.dispose();

    check('no console errors or uncaught exceptions', errors.length === 0, errors.slice(0, 5).join('\n'));
    check(
      'no requests outside the game origin',
      foreignRequests.length === 0,
      foreignRequests.slice(0, 5).join('\n'),
    );
    check('no protocol errors', protocolErrors.length === 0, protocolErrors.slice(0, 5).join('\n'));
    checks.push({
      name: 'traffic (informational)',
      ok: true,
      detail: `${traffic.saves} saves, ${traffic.scores} scores, ${traffic.logs} logs`,
    });
  } finally {
    await browser?.close();
    await gameServer.close();
    await hostServer.close();
  }
  return done(manifest.id, screenshot);
}

interface Bridge {
  __toGame(message: unknown): void;
}

function hostPage(gameUrl: string, gameOrigin: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh;display:block}</style></head>
<body><iframe id="game" src="${gameUrl}" sandbox="allow-scripts allow-same-origin" allow="autoplay; fullscreen"></iframe>
<script>
const iframe = document.getElementById('game');
window.addEventListener('message', (e) => {
  if (e.source === iframe.contentWindow && e.origin === ${JSON.stringify(gameOrigin)}) window.__toNode(e.data);
});
window.__toGame = (m) => iframe.contentWindow.postMessage(m, ${JSON.stringify(gameOrigin)});
</script></body></html>`;
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (error) {
    // Playwright's own Chromium cannot be installed on every OS (e.g. Ubuntu 26.04); fall back to Chrome.
    if (!String(error).includes("Executable doesn't exist")) throw error;
    return chromium.launch({ channel: 'chrome' });
  }
}

async function gameFrame(page: Page, origin: string): Promise<Frame> {
  for (let i = 0; i < 50; i++) {
    const frame = page.frames().find((f) => f.url().startsWith(origin));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error('game frame not found');
}

/** Random taps, with a bias towards visible buttons so menus get exercised too. */
async function monkey(page: Page, frame: Frame, durationMs: number, host: ReturnType<typeof createHost>) {
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  const end = Date.now() + durationMs;
  let step = 0;
  while (Date.now() < end) {
    step++;
    const buttons = await frame.locator('button:visible').all();
    const target =
      buttons.length > 0 && Math.random() < 0.25 ? buttons[Math.floor(Math.random() * buttons.length)] : null;
    const box = target ? await target.boundingBox().catch(() => null) : null;
    if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.touchscreen.tap(Math.random() * viewport.width, Math.random() * viewport.height);
    if (step === 20) host.pause();
    if (step === 25) host.resume();
    if (step === 30) host.setSettings({ muted: false });
    await page.waitForTimeout(40);
  }
}

function dirSize(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return total + dirSize(path);
    // Source maps are not downloaded by players.
    return entry.name.endsWith('.map') ? total : total + statSync(path).size;
  }, 0);
}
