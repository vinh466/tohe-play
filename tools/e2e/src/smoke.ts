#!/usr/bin/env node
// End-to-end smoke test against a running stack (pnpm dev, or docker compose up).
// Opens the hub on a phone-sized viewport, launches the sample game, plays one round and checks that the
// hub stored the score and the save locally. Every screen — the public page at the hub's root, the app, the docs — is
// checked in the light and the dark theme. Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e smoke
// (DOCS_URL, the docs host, defaults to :4710)
// With ADMIN_LOGS_COMMAND (CI: the API container's log) a new deployment is claimed on the console's /setup with the
// setup token the API logged; else, with ADMIN_GRANT_COMMAND (the API container's `admin grant`), a role is granted
// (ADR 0027). Either way the authenticator is added in the hub, and the console — on its own host, CONSOLE_URL (default
// the hub's port + 1: 4721) — signed in to with its code and its pages walked (ADR 0042).
import { execFileSync } from 'node:child_process';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Frame, type Page } from 'playwright';
import { codeSentTo } from './mailpit.ts';
import { totp } from './totp.ts';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const catalogUrl = new URL('/play', hubUrl).href;
const docsUrl = (process.env.DOCS_URL ?? hubUrl.replace(/:4720\/?$/, ':4710')).replace(/\/$/, '');
const consoleUrl = (process.env.CONSOLE_URL ?? hubUrl.replace(/:4720\/?$/, ':4721')).replace(/\/$/, '');
const grantCommand = process.env.ADMIN_GRANT_COMMAND?.split(' ').filter(Boolean);
const logsCommand = process.env.ADMIN_LOGS_COMMAND?.split(' ').filter(Boolean);
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
  // "Failed to load resource" names only the status: its location is the request's URL.
  const where = message.location().url;
  const text = where ? `${message.text()} (${where})` : message.text();
  if (message.type() === 'error') errors.push(text);
  mark(`console.${message.type()}: ${text}`);
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
const email = `e2e${Date.now().toString(36)}@e2e.test`;

try {
  step(
    `open ${hubUrl} — a new device sees the public page; "Chơi ngay" plays as a device profile, and signing in is a choice`,
  );
  await page.goto(hubUrl);
  // The header's button, on a phone, to the app in the page's language; "Chơi tiếp" waits for a device that has opened a game.
  const play = page.getByRole('link', { name: 'Chơi ngay', exact: true });
  await play.waitFor();
  if (!(await play.getAttribute('href'))?.endsWith('/play?lang=vi'))
    throw new Error(
      `the header's "Chơi ngay" does not carry the page's language: ${await play.getAttribute('href')}`,
    );
  if (await page.getByRole('link', { name: 'Chơi tiếp', exact: true }).isVisible())
    throw new Error('a new device is offered "Chơi tiếp"');
  // A plain visit shows the links out of Tò He, in the footer.
  await page.getByRole('link', { name: 'Tài liệu kỹ thuật (tiếng Anh)' }).waitFor();
  await shot('landing');
  await play.tap();
  await page.waitForURL((url) => url.pathname === '/play');
  // Opening the app is not opening a game: the public pages still take this device for a newcomer's.
  if ((await page.evaluate(() => localStorage.getItem('tohe:returning'))) !== null)
    throw new Error('the app wrote tohe:returning before any game was opened');
  // A device profile signs in from Tôi, where the account's section says so (the catalog has no strip for it).
  await page
    .getByRole('navigation', { name: 'Mục chính' })
    .getByRole('link', { name: 'Tôi', exact: true })
    .tap();
  await page.getByRole('link', { name: 'Đăng nhập' }).tap();
  await page.waitForURL(/\/account\/sign-in$/);
  await shot('welcome');

  step(
    `sign up with ${email}: the code from the email creates the account, whose only profile plays at once`,
  );
  await page.getByRole('link', { name: 'Tạo tài khoản' }).tap();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Tên khi chơi').fill('Bố E2E');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('checkbox', { name: /16 tuổi/ }).check();
  await shot('register');
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).tap();
  await page.getByLabel('Mã xác nhận').fill(await codeSentTo(email));
  await shot('register-code');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  await page.waitForURL((url) => url.pathname === '/play');

  step('the frame: three tabs at the bottom; Chơi cùng has the box for a code (ADR 0046)');
  const tabs = page.getByRole('navigation', { name: 'Mục chính' });
  const current = await tabs.locator('[aria-current="page"]').innerText();
  if (!current.includes('Trò chơi'))
    throw new Error(`the catalog's tab is not the current one: "${current}"`);
  await tabs.getByRole('link', { name: 'Chơi cùng', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/together');
  await page.getByLabel('Có mã? Gõ mã hoặc dán link.').waitFor();
  await page.getByRole('heading', { name: 'Bàn đang ngồi' }).waitFor();
  await shot('together');

  step('Tôi: choose the dark theme — it applies at once and survives a reload');
  await tabs.getByRole('link', { name: 'Tôi', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/account');
  const themes = page.getByRole('group', { name: 'Giao diện' });
  await themes.getByRole('button', { name: 'Tối', exact: true }).tap();
  await expectTheme('dark');
  await shot('me');
  await page.reload();
  await expectTheme('dark');

  step('"Theo máy" follows the device, live');
  await themes.getByRole('button', { name: 'Theo máy' }).tap();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme('light');

  step('Tôi → Ngôn ngữ: English at once, without a reload, kept under the key the public pages share');
  const languages = page.getByRole('group', { name: 'Ngôn ngữ' });
  await languages.getByRole('button', { name: 'English' }).tap();
  await page
    .getByRole('navigation', { name: 'Main sections' })
    .getByRole('link', { name: 'Me', exact: true })
    .waitFor();
  const kept = await page.evaluate(() => localStorage.getItem('tohe:language'));
  if (kept !== 'en') throw new Error(`the language setting kept "${kept}", not "en", under tohe:language`);
  if ((await page.evaluate(() => document.documentElement.lang)) !== 'en') {
    throw new Error('the page does not say it is in English');
  }
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Tiếng Việt' }).tap();
  await tabs.getByRole('link', { name: 'Tôi', exact: true }).waitFor();

  step(
    'Tôi → Hỏi đáp: a public page the app opens shows no link out of Tò He, and the visit remembers it (ADR 0046)',
  );
  await page.getByRole('link', { name: /Hỏi đáp/ }).tap();
  await page.waitForURL((url) => url.pathname === '/faq/' && url.searchParams.get('from') === 'app');
  await page.getByRole('link', { name: 'Hỏi đáp', exact: true }).first().waitFor();
  const linksOut = async () => {
    let shown = 0;
    for (const link of await page.locator('a[data-out]').all()) if (await link.isVisible()) shown++;
    return { shown, total: await page.locator('a[data-out]').count() };
  };
  const onFaq = await linksOut();
  if (onFaq.total === 0 || onFaq.shown !== 0)
    throw new Error(`a page the app opened shows ${onFaq.shown} of ${onFaq.total} links out of Tò He`);
  // The next page the child reads carries no ?from=app, and still has none.
  await page
    .getByRole('navigation', { name: 'Các trang chính' })
    .getByRole('link', { name: 'Giới thiệu' })
    .tap();
  await page.waitForURL((url) => url.pathname === '/about/');
  const onAbout = await linksOut();
  if (onAbout.total === 0 || onAbout.shown !== 0)
    throw new Error(`the next page shows ${onAbout.shown} of ${onAbout.total} links out of Tò He`);
  // The header's button is the way back into the app (this device has not opened a game: "Chơi ngay").
  await page.getByRole('link', { name: 'Chơi ngay', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/play');

  step(
    'a tab already behind in the history steps back to it: /play → avatar → Trò chơi leaves no extra entry, so Back leaves the app (ADR 0046)',
  );
  const playEntry = await historyIndex(page);
  await page.getByRole('link', { name: 'Đổi người chơi' }).tap();
  await page.waitForURL((url) => url.pathname === '/account/profiles');
  await shot('profiles-from-games');
  if (!(await page.getByRole('link', { name: 'Quay lại' }).isVisible()))
    throw new Error('the profile picker has no ← of its own');
  await tabs.getByRole('link', { name: 'Trò chơi', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/play');
  if ((await historyIndex(page)) !== playEntry)
    throw new Error(
      `the Trò chơi tab stacked a new entry on top (${await historyIndex(page)}, not ${playEntry})`,
    );
  await tabs.getByRole('link', { name: 'Tôi', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/account');

  step(
    '"Đổi người chơi" opens the picker, where a child profile with a PIN is added (the owner confirms with the password)',
  );
  await page.getByRole('link', { name: 'Đổi người chơi' }).tap();
  await page.waitForURL((url) => url.pathname === '/account/profiles');
  await page.getByRole('button', { name: /Thêm hồ sơ/ }).tap();
  await page.waitForURL((url) => url.pathname === '/account');
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Xác nhận' }).tap();
  const form = page.getByRole('dialog', { name: 'Hồ sơ mới' });
  await form.getByLabel('Tên').fill('Bé Na');
  await form.getByRole('button', { name: '🐼' }).tap();
  await form.getByRole('button', { name: '3-5 tuổi' }).tap();
  await form.getByLabel('Mã PIN (không bắt buộc)').fill('1234');
  await shot('new-child');
  await form.getByRole('button', { name: 'Lưu' }).tap();
  await page.getByRole('button', { name: /Bé Na/ }).waitFor();
  const publicIds = await page.getByText(/ID hồ sơ \d{4} \d{4} \d{4}/).count();
  if (publicIds !== 2) throw new Error(`expected a public ID on both profiles, saw ${publicIds}`);
  await shot('account');

  step('pick the child and enter the PIN');
  await page.getByRole('link', { name: 'Quay lại' }).tap();
  await page.waitForURL((url) => url.pathname === '/account/profiles');
  await shot('profiles');
  await page.getByRole('button', { name: /Bé Na/ }).tap();
  const pinPad = page.getByRole('dialog', { name: /Nhập mã PIN/ });
  for (const digit of '1234') await pinPad.getByRole('button', { name: digit, exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/play');
  const kidId = await page.evaluate(
    async () => (await (await fetch('/api/auth/me')).json()).activeProfileId as string,
  );

  step("on a child's profile, a link out of Tò He (feedback's mail) asks a parent first (ADR 0046)");
  await tabs.getByRole('link', { name: 'Tôi', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/account');
  await page.getByRole('link', { name: /Góp ý \/ báo lỗi/ }).tap();
  const parent = page.getByRole('dialog', { name: 'Mở trang ngoài Tò He' });
  await parent.getByRole('heading', { name: 'Nhờ bố mẹ nhé' }).waitFor();
  await shot('outbound-gate');
  await parent.getByRole('button', { name: 'Đóng' }).tap();
  if (new URL(page.url()).pathname !== '/account')
    throw new Error(`the link out was followed: ${page.url()}`);
  await tabs.getByRole('link', { name: 'Trò chơi', exact: true }).tap();
  await page.waitForURL((url) => url.pathname === '/play');

  step('wait for the catalog to list the sample game (the API syncs it from the games origin)');
  // Its tile among every game: once opened, "Chơi tiếp" holds it too (ADR 0046).
  const card = page.getByRole('region', { name: 'Tất cả trò chơi' }).getByRole('link', { name: /Chạm Chấm/ });
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

  step(
    "the games origin's own front page leads to the hub's catalog, and search engines stay out of it (ADR 0039)",
  );
  const { gamesOrigin } = (await (await fetch(new URL('/api/config', hubUrl))).json()) as {
    gamesOrigin: string;
  };
  const front = await fetch(new URL('/', gamesOrigin), { redirect: 'manual' });
  const leadsTo = new URL(front.headers.get('location') ?? '/', gamesOrigin).href;
  if (front.status !== 302 || leadsTo !== catalogUrl) {
    throw new Error(
      `${gamesOrigin}/ answered ${front.status} towards ${leadsTo}, not a redirect to the hub's catalog`,
    );
  }
  if (!front.headers.get('x-robots-tag')?.includes('noindex')) {
    throw new Error(`${gamesOrigin}/ does not keep search engines out (X-Robots-Tag)`);
  }

  step(
    "launch it: the loading screen gives way to the game's own title screen, full screen, with no hub bar (ADR 0020)",
  );
  const catalogEntry = await historyIndex(page);
  await card.tap();
  await page.waitForURL(/\/play\/hello$/);
  const frame = await gameFrame(page);
  const box = await page.locator('iframe').boundingBox();
  if (!box) throw new Error('game iframe has no layout box');
  mark(`iframe box ${JSON.stringify(box)}`);
  if (box.y > 0) throw new Error(`the game does not fill the screen: iframe at y=${box.y}`);
  await frame.getByRole('button', { name: 'Bảng xếp hạng' }).waitFor();
  await frame.getByRole('button', { name: 'Về Tò He' }).waitFor();
  await page.waitForTimeout(600); // the title screen rises in
  await shot('main-menu');

  step('play one 20 s round');
  // Random taps must never reach the menu (☰, top left), whose 🏠 would leave the round: they stay in the
  // playfield, below the HUD. The deadline is taken *before* the round starts (slow CI must not stretch it past
  // 20 s), and tapping stops as soon as the round's end card shows.
  const end = Date.now() + 17_000;
  const margin = 24;
  const top = 96;
  await frame.getByRole('button', { name: '▶ Chơi', exact: true }).tap();
  // The first round starts from the how-to.
  await frame.getByRole('button', { name: '▶ Bắt đầu' }).tap();
  const again = frame.getByRole('button', { name: '▶ Chơi lại', exact: true });
  while (Date.now() < end && !(await again.isVisible())) {
    const x = Math.round(box.x + margin + Math.random() * (box.width - 2 * margin));
    const y = Math.round(box.y + top + Math.random() * (box.height - top - margin));
    mark(`tap ${x},${y}`);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
  }
  await frame.getByRole('button', { name: '▶ Chơi lại' }).waitFor({ timeout: 10_000 });
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

  step('sync (M2): the save and the score reach the server');
  const onServer = async () =>
    page.evaluate(async () => {
      const saves = (await (await fetch('/api/progress/saves')).json()) as { gameId: string }[];
      // The account's board of the week (ADR 0029): the run counts once the integrity engine took it in.
      const board = (await (await fetch('/api/boards/hello?period=week')).json()) as {
        rows: { profileId: string }[];
      };
      return { saves: saves.map((s) => s.gameId), board: board.rows.map((e) => e.profileId) };
    });
  for (let attempt = 0; ; attempt++) {
    const server = await onServer();
    if (server.saves.includes('hello') && server.board.includes(kidId)) break;
    if (attempt === 20) throw new Error(`not synced to the server: ${JSON.stringify(server)}`);
    await page.waitForTimeout(500);
  }

  step("the game's title screen opens the hub's leaderboard over the game");
  await frame.getByRole('button', { name: '🏠 Menu chính' }).tap();
  await frame.getByRole('button', { name: 'Bảng xếp hạng' }).tap();
  const board = page.getByRole('dialog', { name: /Chạm Chấm/ });
  await board.getByText('Bé Na (bạn)').waitFor();
  await board.getByRole('button', { name: 'Đóng' }).tap();

  step('phone Back opens the menu (the round waits), Back again goes on playing');
  await frame.getByRole('button', { name: '▶ Chơi', exact: true }).tap();
  // The play stage is up once its loading view is gone (Back while it loads goes back to the title, ADR 0020).
  await frame.locator('[data-tohe-menu]').waitFor();
  await frame.locator('.tohe-overlay-loading').waitFor({ state: 'hidden' });
  await page.evaluate(() => history.back());
  await frame.getByRole('button', { name: '▶ Tiếp tục' }).waitFor();
  if (!/\/play\/hello$/.test(page.url())) throw new Error(`Back left the game: ${page.url()}`);
  await shot('in-game-menu');
  await page.evaluate(() => history.back());
  await frame.getByRole('button', { name: '▶ Tiếp tục' }).waitFor({ state: 'hidden' });

  step('the hub hiding the game (another app, a locked phone) opens its menu, and play waits there');
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  // Going on counts 3, 2, 1 first (a game against the clock): wait until play is back before hiding it.
  await frame.locator('.tohe-overlay:not(.tohe-menu-stage)').waitFor({ state: 'hidden' });
  await setHidden(true);
  await frame.getByRole('button', { name: '▶ Tiếp tục' }).waitFor();
  await setHidden(false);
  await page.waitForTimeout(500);
  if (!(await frame.getByRole('button', { name: '▶ Tiếp tục' }).isVisible())) {
    throw new Error('the menu closed by itself when the game came back');
  }
  await frame.getByRole('button', { name: '▶ Tiếp tục' }).tap();
  await frame.locator('.tohe-overlay:not(.tohe-menu-stage)').waitFor({ state: 'hidden' });

  step(
    'leave: ☰ → 🏠 Menu chính → ← Về Tò He, back to the catalog the way the player came (phone Back then leaves Tò He)',
  );
  await frame.locator('[data-tohe-menu]').tap();
  // Over play there is no way out to Tò He (ADR 0020): it is one level up, on the title screen.
  if (await frame.getByRole('button', { name: /Về Tò He/ }).isVisible()) {
    throw new Error('the in-game menu offers a way out to Tò He');
  }
  await frame.getByRole('button', { name: 'Menu chính' }).tap();
  await frame.getByRole('button', { name: '▶ Chơi', exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Về Tò He' }).tap();
  await page.waitForURL(catalogUrl);
  const leftTo = await historyIndex(page);
  if (leftTo !== catalogEntry) {
    throw new Error(
      `leaving stacked the catalog on top of the game (history entry ${leftTo}, not ${catalogEntry})`,
    );
  }

  step(
    'phone Back on the title screen leaves the game too, to the same history entry (no race with the router)',
  );
  await card.tap();
  await page.waitForURL(/\/play\/hello$/);
  const reopened = await gameFrame(page);
  await reopened.locator('[data-tohe-play]').first().waitFor();
  await page.evaluate(() => history.back());
  await page.waitForURL(catalogUrl, { timeout: 5000 });
  await page.waitForTimeout(400);
  const backTo = await historyIndex(page);
  if (backTo !== catalogEntry) {
    throw new Error(
      `Back on the title screen left history entry ${backTo}, not the catalog's ${catalogEntry}`,
    );
  }

  step("the account's leaderboard lists the child");
  await page.getByRole('button', { name: 'Bảng điểm Chạm Chấm' }).tap();
  const leaderboard = page.getByRole('dialog', { name: /Chạm Chấm/ });
  await leaderboard.getByText('Bé Na (bạn)').waitFor();
  await shot('leaderboard');
  await leaderboard.getByRole('button', { name: 'Đóng' }).tap();

  step('coming back: Trò chơi starts with "Chơi tiếp", the game this profile opened last (ADR 0046)');
  await page
    .getByRole('region', { name: 'Chơi tiếp' })
    .getByRole('link', { name: /Chạm Chấm/ })
    .waitFor();
  await shot('continue');

  step(
    '"Ai đang chơi?" at a cold start after 30 minutes unused; the child moving up to the adult asks a parent first',
  );
  // The app last used 31 minutes ago, once, before the app starts on the next load of this tab.
  await context.addInitScript(() => {
    if (sessionStorage.getItem('e2e:idle')) return;
    sessionStorage.setItem('e2e:idle', '1');
    localStorage.setItem('tohe:last-used', String(Date.now() - 31 * 60 * 1000));
  });
  await page.reload();
  await page.waitForURL((url) => url.pathname === '/account/profiles');
  await page.getByRole('heading', { name: 'Ai đang chơi?' }).waitFor();
  await shot('who-is-playing');
  await page.getByRole('button', { name: /Bố E2E/ }).tap();
  const up = page.getByRole('dialog', { name: 'Đổi sang hồ sơ người lớn' });
  // The account has no manage PIN yet: its password.
  await up.getByLabel('Mật khẩu').fill(password);
  await up.getByRole('button', { name: 'Xác nhận' }).tap();
  await page.waitForURL(catalogUrl);
  const adult = await page.evaluate(
    async () => (await (await fetch('/api/auth/me')).json()).activeProfileId as string,
  );
  if (adult === kidId) throw new Error('the adult’s profile was not chosen after the parent’s password');
  await page.reload();
  await page.waitForTimeout(300);
  if (new URL(page.url()).pathname !== '/play')
    throw new Error(`a reload asked who is playing again: ${page.url()}`);

  step(
    `the public page (${hubUrl}/) and the docs (${docsUrl}) share the app's light/dark choice; a device that has played here stays on the root, which offers "Chơi tiếp" to the app (ADR 0046)`,
  );
  await page.goto(hubUrl);
  await page.getByRole('button', { name: 'Tối' }).tap();
  await expectTheme('dark');
  await page.goto(docsUrl);
  await expectTheme('dark');
  await shot('docs');
  // This device has played (the app wrote its keys above): / never redirects, it shows Chơi tiếp at the top.
  await page.goto(hubUrl);
  await expectTheme('dark');
  // The header's button: "Chơi tiếp" in place of "Chơi ngay" on a device that has opened a game (the hero's has an arrow).
  if (await page.getByRole('link', { name: 'Chơi ngay', exact: true }).isVisible())
    throw new Error('a device that has opened a game is still offered "Chơi ngay" in the header');
  const continueLink = page.getByRole('link', { name: 'Chơi tiếp', exact: true });
  await continueLink.waitFor();
  if (new URL(page.url()).pathname !== '/') throw new Error(`/ was redirected to ${page.url()}`);
  await shot('landing-returning');
  await continueLink.tap();
  // A public page's links into the app carry its language (?lang=vi, ADR 0047).
  await page.waitForURL((url) => url.pathname === '/play');
  await expectTheme('dark');

  step(
    `the console (${consoleUrl}, a host of its own): its own sign-in; a new deployment offers the claim of its first owner`,
  );
  await page.goto(`${consoleUrl}/`);
  const claimLink = page.getByRole('link', { name: 'Nhận quyền chủ' });
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  // Whether setup is open comes with a request of its own.
  await page.waitForLoadState('networkidle');
  await shot('console-sign-in');

  let admin = false;
  if (logsCommand && (await claimLink.isVisible())) {
    const [command = '', ...args] = logsCommand;
    step(
      `a new deployment: the setup token in the API's log, with this account's email and password, makes it the owner`,
    );
    // The last one: each start of the API makes up a new token.
    const logs = execFileSync(command, args, { encoding: 'utf8' });
    const token = [...logs.matchAll(/setup token ([0-9A-Z]{4}-[0-9A-Z]{4})/g)].at(-1)?.[1];
    if (!token) throw new Error("no setup token in the API's log");
    await claimLink.click();
    await page.waitForURL((url) => url.pathname === '/setup');
    await page.getByLabel('Mã cài đặt').fill(token);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Nhận quyền chủ' }).click();
    await page.getByText('đã là chủ của Tò He').waitFor();
    await shot('console-setup');
    admin = true;
  } else if (grantCommand) {
    const [command = '', ...args] = grantCommand;
    step(`granted a role in the API's container`);
    execFileSync(command, [...args, email, '--role', 'viewer'], { stdio: 'inherit' });
    admin = true;
  }

  if (admin) {
    step(
      'the authenticator is added in the hub, on the account page: step-up, then a new key and its first code',
    );
    await page.goto(`${hubUrl}/account?manage=true`);
    await page.getByLabel('Mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Xác nhận' }).tap();
    await page.getByRole('button', { name: 'Thêm ứng dụng xác thực' }).tap();
    const enrol = page.getByRole('dialog', { name: 'Thêm ứng dụng xác thực' });
    await enrol.getByRole('button', { name: 'Tạo khoá cho ứng dụng xác thực' }).tap();
    const key = await enrol.getByLabel('Khoá xác thực', { exact: true }).inputValue();
    await shot('account-two-factor');
    await enrol.getByLabel('Mã 6 số ứng dụng đang hiện').fill(totp(key));
    await enrol.getByRole('button', { name: 'Bật xác thực hai lớp' }).tap();
    await enrol.getByRole('list', { name: 'Mã dự phòng' }).waitFor();
    await shot('account-recovery-codes');
    await enrol.getByRole('button', { name: 'Tôi đã cất các mã này' }).tap();
    await page.getByText('(Đang bật)').waitFor();

    step('the console signs in with the email, the password and a code — the next one: a code works once');
    await page.getByRole('link', { name: 'Mở bảng quản trị Tò He' }).tap();
    await page.waitForURL((url) => url.origin === new URL(consoleUrl).origin);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(password);
    await page.getByLabel('Mã 6 số từ ứng dụng xác thực').fill(totp(key, Date.now() + 30_000));
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    await shot('admin-overview');
    for (const [link, heading] of [
      ['Game', 'Game'],
      ['Sức khoẻ thiết bị', 'Sức khoẻ thiết bị'],
      ['Hệ thống', 'Hệ thống'],
      ['Bảo mật', 'Bảo mật'],
    ] as const) {
      await page.getByRole('link', { name: link, exact: true }).click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await shot(`admin-${link}`);
    }
    // The owner reads the audit log: the claim and the console's opening are in it.
    const auditLink = page.getByRole('link', { name: 'Nhật ký', exact: true });
    if (await auditLink.isVisible()) {
      await auditLink.click();
      await page.getByText('Bật xác thực hai lớp').first().waitFor();
      await shot('admin-audit');
    }

    step("signing out of the console ends its session only: the hub's stays");
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  }
  await page.goto(`${hubUrl}/account?manage=true`);
  await page.getByRole('heading', { name: 'Quản lý tài khoản' }).waitFor();

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

/** The hub's place in the browser history (TanStack Router numbers its entries). */
function historyIndex(page: Page): Promise<number> {
  return page.evaluate(() => (history.state as { __TSR_index: number }).__TSR_index);
}

async function gameFrame(target: Page): Promise<Frame> {
  for (let i = 0; i < 100; i++) {
    // Not the hub's own page: its address (/play/hello/…) names the game too.
    const frame = target.frames().find((f) => f !== target.mainFrame() && f.url().includes('/hello/'));
    if (frame) return frame;
    await target.waitForTimeout(100);
  }
  throw new Error('game iframe did not load');
}
