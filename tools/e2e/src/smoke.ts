#!/usr/bin/env node
// End-to-end smoke test against a running stack (pnpm dev, or docker compose up).
// Opens the hub on a phone-sized viewport, launches the sample game, plays one round and checks that the
// hub stored the score and the save locally. Every screen — hub, landing page, docs — is checked in the light and
// the dark theme. Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e smoke (SITE_URL defaults to :4710)
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Frame, type Page } from 'playwright';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const siteUrl = process.env.SITE_URL ?? hubUrl.replace(/:4720\/?$/, ':4710');
const step = (message: string) => console.log(`• ${message}`);

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'vi-VN',
});
// A trace (screenshots, DOM snapshots, console, network) is kept only when the test fails:
// open it with `pnpm --filter @tohe/e2e exec playwright show-trace test-results/trace.zip`.
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();

const started = Date.now();
const timeline: string[] = [];
const mark = (event: string) => timeline.push(`${((Date.now() - started) / 1000).toFixed(2)}s ${event}`);
const errors: string[] = [];
page.on('pageerror', (error) => {
  errors.push(error.message);
  mark(`uncaught: ${error.message}`);
});
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
  mark(`console.${message.type()}: ${message.text()}`);
});
page.on('framenavigated', (frame) =>
  mark(`${frame === page.mainFrame() ? 'hub' : 'iframe'} -> ${frame.url()}`),
);
page.on('framedetached', (frame) => mark(`detached: ${frame.url()}`));

/**
 * Screenshot a step in the light and the dark theme, and check each:
 * - nothing overflows sideways: on phones, one element wider than the screen makes the browser zoom the whole
 *   page out, and buttons end up outside the visible area;
 * - all hub text meets WCAG AA contrast (axe-core; the game's own frame is not part of the hub).
 * The theme is switched on <html> directly, so the player's saved choice is left alone.
 */
const shot = async (name: string) => {
  const saved = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((next) => {
      const root = document.documentElement;
      root.dataset.theme = next;
      root.style.colorScheme = next;
      // Settle entrance animations, so screenshots and contrast see final colours.
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY) animation.finish();
      }
    }, theme);
    await page.screenshot({ path: `test-results/e2e-${name}-${theme}.png` });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    if (width > 390) throw new Error(`"${name}" is ${width}px wide on a 390px screen (horizontal overflow)`);
    const { violations } = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .exclude('iframe')
      .analyze();
    const low = violations.flatMap((v) => v.nodes.map((n) => `  ${n.target.join(' ')}: ${n.failureSummary}`));
    if (low.length > 0)
      throw new Error(`"${name}" (${theme}) has text below WCAG AA contrast:\n${low.join('\n')}`);
  }
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, saved);
};
const expectTheme = (theme: 'light' | 'dark') =>
  page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme, { timeout: 5000 });
const password = 'mat-khau-e2e-123';
const username = `e2e${Date.now().toString(36)}`;

try {
  step(`open ${hubUrl} — a new device lands on the welcome screen`);
  await page.goto(hubUrl);
  await page.waitForURL(/\/welcome$/);
  await shot('welcome');

  step(`register a family account (${username})`);
  await page.getByRole('link', { name: 'Tạo tài khoản gia đình' }).tap();
  await page.getByLabel('Tên của bạn').fill('Bố E2E');
  await page.getByLabel('Tên đăng nhập').fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await shot('register');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  await page.waitForURL(/\/profiles$/);

  step('choose the dark theme in "Giao diện": it applies at once and survives a reload');
  await page.getByRole('button', { name: /^Giao diện/ }).tap();
  const themes = page.getByRole('dialog', { name: 'Giao diện' });
  await themes.getByRole('button', { name: /^Tối/ }).tap();
  await expectTheme('dark');
  await shot('theme-sheet');
  await themes.getByRole('button', { name: '✕' }).tap();
  await page.reload();
  await expectTheme('dark');

  step('"Theo máy" follows the device, live');
  await page.getByRole('button', { name: /^Giao diện/ }).tap();
  await themes.getByRole('button', { name: /^Theo máy/ }).tap();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme('light');
  await themes.getByRole('button', { name: '✕' }).tap();

  step('add a child profile with a PIN (behind the parent gate)');
  await page.getByRole('button', { name: /Thêm hồ sơ/ }).tap();
  await page.waitForURL(/\/family/);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Mở khoá' }).tap();
  const form = page.getByRole('dialog', { name: 'Hồ sơ mới cho bé' });
  await form.getByLabel('Tên').fill('Bé Na');
  await form.getByRole('button', { name: '🐼' }).tap();
  await form.getByRole('button', { name: '3-5 tuổi' }).tap();
  await form.getByLabel('Mã PIN (không bắt buộc)').fill('1234');
  await shot('new-child');
  await form.getByRole('button', { name: 'Lưu' }).tap();
  await page.getByRole('button', { name: /Bé Na/ }).waitFor();
  await shot('family');

  step('pick the child and enter the PIN');
  await page.getByRole('link', { name: 'Quay lại' }).tap();
  await page.waitForURL(/\/profiles$/);
  await shot('profiles');
  await page.getByRole('button', { name: /Bé Na/ }).tap();
  const pinPad = page.getByRole('dialog', { name: /Nhập mã PIN/ });
  for (const digit of '1234') await pinPad.getByRole('button', { name: digit, exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/');
  const kidId = await page.evaluate(
    async () => (await (await fetch('/api/auth/me')).json()).activeProfileId as string,
  );

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
  await shot('catalog');

  step('launch it');
  await card.tap();
  await page.waitForURL(/\/play\/hello$/);
  const frame = await gameFrame(page);
  const box = await page.locator('iframe').boundingBox();
  if (!box) throw new Error('game iframe has no layout box');
  mark(`iframe box ${JSON.stringify(box)}`);

  step('play one 20 s round');
  // Random taps must never reach the game-over overlay: its "Thoát" (exit) button would close the game.
  // So the deadline is taken *before* the round starts (slow CI must not stretch it past 20 s), and tapping
  // also stops as soon as any overlay button is visible again. Taps also keep a margin from the iframe's edges:
  // Chromium's touch adjustment snaps a tap near the hub's top bar onto its buttons.
  const end = Date.now() + 17_000;
  const margin = 24;
  await frame.getByRole('button', { name: 'Chơi', exact: true }).tap();
  const exitButton = frame.getByRole('button', { name: 'Thoát', exact: true });
  while (Date.now() < end && !(await exitButton.isVisible())) {
    const x = Math.round(box.x + margin + Math.random() * (box.width - 2 * margin));
    const y = Math.round(box.y + margin + Math.random() * (box.height - 2 * margin));
    mark(`tap ${x},${y}`);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
  }
  await frame.getByRole('button', { name: 'Chơi lại' }).waitFor({ timeout: 10_000 });
  await shot('game-over');

  step('the game follows the hub live: the device turns dark, "Theo máy" passes it on as settings.theme');
  const gameTheme = (theme: string) =>
    frame.waitForFunction((t) => document.documentElement.dataset.theme === t, theme, { timeout: 5000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await gameTheme('dark');
  await page.screenshot({ path: 'test-results/e2e-game-dark.png' });
  await page.emulateMedia({ colorScheme: 'light' });
  await gameTheme('light');

  step("check the hub stored the score and the save under the child's profile");
  await page.waitForTimeout(500);
  const stored = await page.evaluate(async (profileId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tohe');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = (store: string) =>
      new Promise<{ profileId: string }[]>((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
      });
    const mine = (list: { profileId: string }[]) => list.filter((row) => row.profileId === profileId).length;
    return { scores: mine(await rows('scores')), saves: mine(await rows('saves')) };
  }, kidId);
  if (stored.scores < 1 || stored.saves < 1)
    throw new Error(`nothing stored for ${kidId}: ${JSON.stringify(stored)}`);

  step('exit back to the catalog (the hub asks first)');
  await page.getByRole('button', { name: /Thoát/ }).first().tap();
  const confirm = page.getByRole('dialog');
  await confirm.getByRole('button', { name: 'Thoát', exact: true }).tap();
  await page.waitForURL(hubUrl.endsWith('/') ? hubUrl : `${hubUrl}/`);

  step(`the landing page (${siteUrl}) and the docs share the hub's light/dark choice`);
  await page.goto(siteUrl);
  await shot('landing');
  await page.getByRole('button', { name: 'Tối' }).tap();
  await expectTheme('dark');
  await page.goto(`${siteUrl}/docs/`);
  await expectTheme('dark');
  await shot('docs');
  await page.goto(hubUrl);
  await expectTheme('dark');

  if (errors.length > 0) throw new Error(`console errors:\n${errors.join('\n')}`);
  await context.tracing.stop();
  console.log(`\nPASS (${stored.scores} score, ${stored.saves} save stored)`);
} catch (error) {
  await page.screenshot({ path: 'test-results/e2e-failure.png' }).catch(() => {});
  await context.tracing.stop({ path: 'test-results/trace.zip' }).catch(() => {});
  console.error(`\nFAIL: ${error instanceof Error ? error.message : String(error)}`);
  console.error(`\nLast events:\n  ${timeline.slice(-40).join('\n  ')}`);
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
