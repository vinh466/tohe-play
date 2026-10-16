#!/usr/bin/env node
// End-to-end test of online rooms (ADR 0016) against a running stack: two people on two phones. One opens a Tiến
// Lên room from the lobby, the other joins with the room's link, the host starts, both play a whole hand with the
// game's 💡 hints next to bots, and the results reach both. The waiting room is checked in light and dark.
// Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e rooms
import { AxeBuilder } from '@axe-core/playwright';
import { type Browser, chromium, type Frame, type Page } from 'playwright';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const step = (message: string) => console.log(`• ${message}`);
const password = 'mat-khau-e2e-123';
const errors: string[] = [];

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));

async function phone(name: string, target: Browser): Promise<Page> {
  const context = await target.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'vi-VN',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    // A WebSocket that reconnects logs a warning, not an error; anything logged as an error is one.
    if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
  });
  return page;
}

async function register(page: Page, displayName: string) {
  await page.goto(`${hubUrl}/register`);
  await page.getByLabel('Tên của bạn').fill(displayName);
  await page
    .getByLabel('Tên đăng nhập')
    .fill(`e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  await page.waitForURL(/\/profiles$/);
  await page.getByRole('button', { name: new RegExp(displayName) }).tap();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname.startsWith('/r/'));
}

/** Light and dark: nothing wider than the phone, and all hub text at WCAG AA contrast. */
async function shot(page: Page, name: string) {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((next) => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      for (const animation of document.getAnimations()) animation.finish();
    }, theme);
    await page.screenshot({ path: `test-results/rooms-${name}-${theme}.png` });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    if (width > 390) throw new Error(`"${name}" is ${width}px wide on a 390px screen`);
    const { violations } = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .exclude('iframe')
      .analyze();
    const low = violations.flatMap((v) => v.nodes.map((n) => `  ${n.target.join(' ')}: ${n.failureSummary}`));
    if (low.length > 0)
      throw new Error(`"${name}" (${theme}) has text below WCAG AA contrast:\n${low.join('\n')}`);
  }
}

async function gameFrame(page: Page): Promise<Frame> {
  for (let i = 0; i < 100; i++) {
    const frame = page.frames().find((f) => f.url().includes('/tien-len/'));
    if (frame && (await frame.locator('#play').count()) > 0) return frame;
    await page.waitForTimeout(200);
  }
  throw new Error('the game never appeared at the table');
}

/** One move if it is this phone's turn: 💡 then Đánh (or Bỏ lượt when the hint says pass). */
async function move(frame: Frame): Promise<void> {
  if (
    !(await frame
      .locator('#hint')
      .isEnabled()
      .catch(() => false))
  )
    return;
  await frame.locator('#hint').click();
  await frame.waitForTimeout(150);
  if (await frame.locator('#play').isEnabled()) await frame.locator('#play').click();
  else if (await frame.locator('#pass').isEnabled()) await frame.locator('#pass').click();
}

const resultsShown = (frame: Frame) =>
  frame
    .getByText('Kết quả ván')
    .isVisible()
    .catch(() => false);

try {
  const host = await phone('host', browser);
  const guest = await phone('guest', browser);

  step('two families register, each on its own phone');
  await register(host, 'Bố Phòng');
  await register(guest, 'Chú Khách');

  step('the host opens Tiến Lên: its card leads to the lobby');
  const card = host.getByRole('link', { name: /Tiến Lên/ });
  for (let attempt = 0; !(await card.isVisible()); attempt++) {
    if (attempt === 20) throw new Error('Tiến Lên never appeared in the catalog');
    await host.waitForTimeout(3000);
    await host.reload();
  }
  await card.tap();
  await host.waitForURL(/\/rooms\/tien-len$/);
  await shot(host, 'lobby');

  step('the host creates a room: easy bots, 15 s a turn');
  await host
    .getByRole('button', { name: /Tạo phòng/ })
    .first()
    .tap();
  const form = host.getByRole('dialog', { name: 'Tạo phòng' });
  await form.getByRole('button', { name: 'Dễ' }).tap();
  await form.getByRole('button', { name: '15 giây' }).tap();
  await form.getByRole('button', { name: 'Tạo phòng' }).last().tap();
  await host.waitForURL(/\/room\//);
  const code = ((await host.locator('p.tracking-widest').textContent()) ?? '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) throw new Error(`no room code on the waiting room (${code})`);
  step(`room ${code}: the guest opens its link`);
  await shot(host, 'waiting-room');

  await guest.goto(`${hubUrl}/r/${code}`);
  await guest.getByRole('button', { name: 'Vào ngồi' }).tap();
  await guest.waitForURL(/\/room\//);
  await host.getByText('Chú Khách').waitFor();

  step('the host starts; both phones show the table');
  await host.getByRole('button', { name: 'Bắt đầu' }).tap();
  const hostGame = await gameFrame(host);
  const guestGame = await gameFrame(guest);

  step('both play a whole hand with the hints, next to two bots');
  const deadline = Date.now() + 240_000;
  while (!(await resultsShown(hostGame)) || !(await resultsShown(guestGame))) {
    if (Date.now() > deadline) throw new Error('the hand did not end in 4 minutes');
    await move(hostGame);
    await move(guestGame);
    await host.waitForTimeout(250);
  }
  await host.screenshot({ path: 'test-results/rooms-results-host.png' });
  await guest.screenshot({ path: 'test-results/rooms-results-guest.png' });

  step('the guest leaves (the hub asks first) and lands in the lobby');
  await guest
    .getByRole('button', { name: /Rời phòng/ })
    .first()
    .tap();
  await guest.getByRole('dialog').getByRole('button', { name: 'Rời phòng' }).tap();
  await guest.waitForURL(/\/rooms\/tien-len$/);

  if (errors.length > 0) throw new Error(`errors in the pages:\n${errors.join('\n')}`);
  console.log('✔ rooms e2e passed');
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
  if (errors.length > 0) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
