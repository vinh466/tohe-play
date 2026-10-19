#!/usr/bin/env node
// End-to-end test of online rooms (ADR 0016, 0017) against a running stack, on three phones. A parent opens a Tiến
// Lên room from the lobby, a friend joins with the room's link, and the parent invites their child, who gets the
// invitation on the parent's second phone and watches the start of the hand. Both play it to the end with the game's
// 💡 hints next to bots, and the results reach both. Back in the lobby the hand is in the friend's results, and its
// replay plays to the end. The hub's screens are checked in light and dark. Five sign-in requests in all (signing up
// plays the new profile at once): the API allows ten a minute from one address, and the smoke test before this one
// may share the minute.
// Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e rooms
import { AxeBuilder } from '@axe-core/playwright';
import { type Browser, chromium, type Frame, type Page } from 'playwright';
import { codeSentTo } from './mailpit.ts';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const step = (message: string) => console.log(`• ${message}`);
const password = 'mat-khau-e2e-123';
const errors: string[] = [];

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
/** Every phone by name, to photograph them all when something fails. */
const phones = new Map<string, Page>();

async function phone(name: string, target: Browser): Promise<Page> {
  const context = await target.newContext({
    viewport: { width: 390, height: 844 },
    // CI machines draw the games in software: at a phone's density of 2, two or three tables at once (and other CI
    // runs on the same machine) slowed every tap to seconds and the hand past its deadline. Layout and contrast do
    // not depend on density; the smoke test keeps 2.
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'vi-VN',
  });
  const page = await context.newPage();
  phones.set(name, page);
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    // A WebSocket that reconnects logs a warning, not an error; anything logged as an error is one.
    if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
  });
  return page;
}

/** Signs up with a new email and the code it receives; the only profile plays at once. Returns the email. */
async function register(page: Page, displayName: string): Promise<string> {
  const email = `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}@e2e.test`;
  await page.goto(`${hubUrl}/account/register`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Tên khi chơi').fill(displayName);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('checkbox', { name: /16 tuổi/ }).check();
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).tap();
  await page.getByLabel('Mã xác nhận').fill(await codeSentTo(email));
  await page.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  await page.waitForURL((url) => url.pathname === '/play' || url.pathname.startsWith('/r/'));
  return email;
}

/** A second phone of the same account: signs in and plays as `profile`. */
async function signIn(page: Page, email: string, profile: string) {
  await page.goto(`${hubUrl}/account/sign-in`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).tap();
  await page.waitForURL((url) => url.pathname === '/account/profiles');
  await page.getByRole('button', { name: new RegExp(profile) }).tap();
  await page.waitForURL((url) => url.pathname === '/play');
}

/** A child profile of the signed-in account, allowed to play with others (after stepping up with the password). */
async function addChild(page: Page, name: string) {
  const problem = await page.evaluate(
    async ({ password, name }) => {
      const json = { 'content-type': 'application/json' };
      const gate = await fetch('/api/session/step-up', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ password }),
      });
      if (!gate.ok) return `step-up: ${gate.status}`;
      const created = await fetch('/api/profiles', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ name, avatar: '🐼', ageBand: '9-12' }),
      });
      if (!created.ok) return `new profile: ${created.status}`;
      const me = (await created.json()) as { profiles: { id: string; name: string }[] };
      const child = me.profiles.find((profile) => profile.name === name);
      const allowed = await fetch(`/api/profiles/${child?.id}`, {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify({ playWithOthers: true }),
      });
      return allowed.ok ? null : `parent switch: ${allowed.status}`;
    },
    { password, name },
  );
  if (problem) throw new Error(`could not add a child profile (${problem})`);
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

/** The hub's place in the browser history (TanStack Router numbers its entries). */
function historyIndex(page: Page): Promise<number> {
  return page.evaluate(() => (history.state as { __TSR_index: number }).__TSR_index);
}

/** The game's frame once it shows something: its title screen (the menu stage) or a table (the play stage, ADR 0020). */
async function gameFrame(page: Page): Promise<Frame> {
  for (let i = 0; i < 100; i++) {
    // Not the hub's own page: its address (/play/tien-len/rooms/…) names the game too.
    const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes('/tien-len/'));
    if (frame && (await frame.locator('[data-tohe-play], #play').count()) > 0) return frame;
    await page.waitForTimeout(200);
  }
  throw new Error('the game never appeared');
}

/**
 * One move if it is this phone's turn: 💡 then Đánh (or Bỏ lượt when the hint says pass). The buttons stay off while
 * the plays before arrive and animate, and the turn can move on between a check and a tap (the timer), so a tap
 * waits a little and is dropped if it cannot happen; the next round tries again.
 */
async function move(frame: Frame): Promise<void> {
  const tap = (selector: string) =>
    frame
      .locator(selector)
      .click({ timeout: 5000 })
      .then(
        () => true,
        () => false,
      );
  const enabled = (selector: string) =>
    frame
      .locator(selector)
      .isEnabled()
      .catch(() => false);
  if (!(await enabled('#hint')) || !(await tap('#hint'))) return;
  await frame.waitForTimeout(150);
  if (await enabled('#play')) await tap('#play');
  else if (await enabled('#pass')) await tap('#pass');
}

const resultsShown = (frame: Frame) =>
  frame
    .getByText('Kết quả ván')
    .isVisible()
    .catch(() => false);

try {
  const host = await phone('host', browser);
  const guest = await phone('guest', browser);
  const kid = await phone('kid', browser);

  step('two people register, each on their own phone');
  const parentAccount = await register(host, 'Bố Phòng');
  await register(guest, 'Chú Khách');

  step(
    'the parent adds a child profile allowed to play with others; the child uses the parent’s second phone',
  );
  await addChild(host, 'Bé Na');
  await host.reload();
  await signIn(kid, parentAccount, 'Bé Na');

  step("the host opens Tiến Lên: the game's title screen leads to the lobby (ADR 0020)");
  const card = host.getByRole('link', { name: /Tiến Lên/ });
  for (let attempt = 0; !(await card.isVisible()); attempt++) {
    if (attempt === 20) throw new Error('Tiến Lên never appeared in the catalog');
    await host.waitForTimeout(3000);
    await host.reload();
  }
  await card.tap();
  await host.waitForURL(/\/play\/tien-len$/);
  const gameEntry = await historyIndex(host);
  let menu = await gameFrame(host);
  await menu.getByRole('button', { name: '🌐 Chơi online' }).tap();
  await host.waitForURL(/\/play\/tien-len\/rooms$/);
  await shot(host, 'lobby');

  step("the lobby's ← goes back to the game the way the host came, and Chơi online leads there again");
  await host.getByRole('link', { name: 'Về menu Tiến Lên' }).tap();
  await host.waitForURL(/\/play\/tien-len$/);
  const backAt = await historyIndex(host);
  if (backAt !== gameEntry)
    throw new Error(`the lobby's ← stacked the game again (entry ${backAt}, not ${gameEntry})`);
  menu = await gameFrame(host);
  await menu.getByRole('button', { name: '🌐 Chơi online' }).tap();
  await host.waitForURL(/\/play\/tien-len\/rooms$/);

  step('the host creates a room: easy bots, 15 s a turn, spectators welcome');
  await host
    .getByRole('button', { name: /Tạo phòng/ })
    .first()
    .tap();
  const form = host.getByRole('dialog', { name: 'Tạo phòng' });
  await form.getByRole('button', { name: 'Dễ' }).tap();
  await form.getByRole('button', { name: '15 giây' }).tap();
  await form.getByRole('switch', { name: /Cho người khác vào xem/ }).tap();
  await form.getByRole('button', { name: 'Tạo phòng' }).last().tap();
  await host.waitForURL(/\/play\/tien-len\/rooms\/[^/]+$/);
  const code = ((await host.locator('p.tracking-widest').textContent()) ?? '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) throw new Error(`no room code on the waiting room (${code})`);
  step(`room ${code}: the guest opens its link`);
  await shot(host, 'waiting-room');

  await guest.goto(`${hubUrl}/r/${code}`);
  await guest.getByRole('button', { name: 'Vào ngồi' }).tap();
  await guest.waitForURL(/\/play\/tien-len\/rooms\/[^/]+$/);
  await host.getByText('Chú Khách').waitFor();

  step('the host invites the child from the waiting room');
  await host.getByRole('button', { name: 'Mời người chơi' }).tap();
  const invite = host.getByRole('dialog', { name: 'Mời người chơi' });
  await invite.getByRole('button', { name: /Bé Na/ }).tap();
  await invite.getByText('✓ Đã mời').waitFor();
  await shot(host, 'invite');
  await invite.getByRole('button', { name: '✕' }).tap();

  step('the invitation shows on the child’s catalog and leads to the room, which the child watches');
  const banner = kid.getByText('Bố Phòng mời bạn chơi Tiến Lên');
  // The catalog checks every 20 s; a reload asks at once.
  for (let attempt = 0; ; attempt++) {
    if (
      await banner.waitFor({ timeout: 5000 }).then(
        () => true,
        () => false,
      )
    )
      break;
    if (attempt === 5) throw new Error('the invitation never showed on the child’s catalog');
    await kid.reload();
  }
  await shot(kid, 'invitation');
  await kid.getByRole('link', { name: 'Vào phòng' }).tap();
  await kid.getByRole('button', { name: '👁 Xem' }).tap();
  await kid.waitForURL(/\/play\/tien-len\/rooms\/[^/]+$/);
  await kid.getByText('Bạn đang xem phòng này').waitFor();
  await shot(kid, 'watching');

  step('the host starts; the two players and the child see the table, the child never a hand nor a button');
  await host.getByRole('button', { name: 'Bắt đầu' }).tap();
  const hostGame = await gameFrame(host);
  const guestGame = await gameFrame(guest);
  const kidGame = await gameFrame(kid);
  await kidGame.getByText('Đang xem').waitFor();
  if (await kidGame.locator('#play').isVisible()) throw new Error('a spectator sees the play button');
  await kid.screenshot({ path: 'test-results/rooms-spectator.png' });

  // Three games drawing at once on a CI machine's CPU slow every tap to seconds: the child stops watching.
  step("the child stops watching from the game's menu, without being asked anything, and lands in the lobby");
  await kidGame.locator('[data-tohe-menu]').tap();
  await kidGame.getByRole('button', { name: 'Thôi xem' }).tap();
  await kid.waitForURL(/\/play\/tien-len\/rooms$/);

  step('both play a whole hand with the hints, next to two bots');
  // Each phone plays on its own, as people do: one waiting for its buttons never holds up the other's turn.
  const deadline = Date.now() + 240_000;
  const playHand = async (game: Frame) => {
    while (!(await resultsShown(game))) {
      if (Date.now() > deadline) throw new Error('the hand did not end in 4 minutes');
      await move(game);
      await game.waitForTimeout(250);
    }
  };
  await Promise.all([playHand(hostGame), playHand(guestGame)]);
  await host.screenshot({ path: 'test-results/rooms-results-host.png' });
  await guest.screenshot({ path: 'test-results/rooms-results-guest.png' });

  step("the guest leaves from the game's menu (the hub asks first) and lands in the lobby");
  await guestGame.locator('[data-tohe-menu]').tap();
  await guestGame.getByRole('button', { name: 'Rời bàn' }).tap();
  await guest.getByRole('dialog').getByRole('button', { name: 'Rời phòng' }).tap();
  await guest.waitForURL(/\/play\/tien-len\/rooms$/);

  step('the hand is in the guest’s results, and its replay plays to the end');
  const replay = guest.getByRole('link', { name: 'Xem lại' }).first();
  await replay.waitFor();
  await shot(guest, 'lobby-results');
  await replay.tap();
  await guest.waitForURL(/\/replay\//);
  const replayGame = await gameFrame(guest);
  await replayGame.getByText(/Xem lại ván · bước/).waitFor();
  await replayGame.getByRole('button', { name: 'Xem lại từ đầu' }).waitFor({ timeout: 240_000 });
  await guest.screenshot({ path: 'test-results/rooms-replay-end.png' });

  if (errors.length > 0) throw new Error(`errors in the pages:\n${errors.join('\n')}`);
  console.log('✔ rooms e2e passed');
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
  for (const [name, page] of phones) {
    await page.screenshot({ path: `test-results/rooms-failure-${name}.png` }).catch(() => {});
  }
  if (errors.length > 0) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
