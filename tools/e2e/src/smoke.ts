#!/usr/bin/env node
// End-to-end smoke test against a running stack (pnpm dev, or docker compose up).
// Opens the hub on a phone-sized viewport, launches the sample game, plays one round and checks that the
// hub stored the score and the save locally.  Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e smoke
import { chromium, type Frame, type Page } from 'playwright';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const step = (message: string) => console.log(`• ${message}`);

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'vi-VN',
});
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  step(`open ${hubUrl}`);
  await page.goto(hubUrl);

  step('wait for the catalog to list the sample game (the API syncs it from the games origin)');
  const card = page.getByRole('link', { name: /Chạm Chấm/ });
  for (let attempt = 0; ; attempt++) {
    const visible = await card.waitFor({ timeout: 3000 }).then(
      () => true,
      () => false,
    );
    if (visible) break;
    if (attempt === 20) throw new Error('sample game never appeared in the catalog');
    await page.reload();
  }
  await page.screenshot({ path: 'test-results/e2e-catalog.png' });

  step('launch it');
  await card.tap();
  await page.waitForURL(/\/play\/hello$/);
  const frame = await gameFrame(page);
  const box = await page.locator('iframe').boundingBox();
  if (!box) throw new Error('game iframe has no layout box');

  step('play one 20 s round');
  // Random taps must never reach the game-over overlay: its "Thoát" (exit) button would close the game.
  // So the deadline is taken *before* the round starts (slow CI must not stretch it past 20 s), and tapping
  // also stops as soon as any overlay button is visible again.
  const end = Date.now() + 17_000;
  await frame.getByRole('button', { name: 'Chơi', exact: true }).tap();
  const exitButton = frame.getByRole('button', { name: 'Thoát', exact: true });
  while (Date.now() < end && !(await exitButton.isVisible())) {
    await page.touchscreen.tap(box.x + Math.random() * box.width, box.y + Math.random() * box.height);
    await page.waitForTimeout(150);
  }
  await frame.getByRole('button', { name: 'Chơi lại' }).waitFor({ timeout: 10_000 });
  await page.screenshot({ path: 'test-results/e2e-game-over.png' });

  step('check the hub stored the score and the save');
  await page.waitForTimeout(500);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tohe');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = (store: string) =>
      new Promise<number>((resolve) => {
        const request = db.transaction(store).objectStore(store).count();
        request.onsuccess = () => resolve(request.result);
      });
    return { scores: await count('scores'), saves: await count('saves') };
  });
  if (stored.scores < 1 || stored.saves < 1) throw new Error(`nothing stored: ${JSON.stringify(stored)}`);

  step('exit back to the catalog');
  await page.getByRole('link', { name: /Thoát/ }).tap();
  await page.waitForURL(hubUrl.endsWith('/') ? hubUrl : `${hubUrl}/`);

  if (errors.length > 0) throw new Error(`console errors:\n${errors.join('\n')}`);
  console.log(`\nPASS (${stored.scores} score, ${stored.saves} save stored)`);
} catch (error) {
  await page.screenshot({ path: 'test-results/e2e-failure.png' }).catch(() => {});
  console.error(`\nFAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

async function gameFrame(target: Page): Promise<Frame> {
  for (let i = 0; i < 100; i++) {
    const frame = target.frames().find((f) => f.url().includes('/hello/'));
    if (frame) return frame;
    await target.waitForTimeout(100);
  }
  throw new Error('game iframe did not load');
}
