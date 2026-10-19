#!/usr/bin/env node
// End-to-end test of a newcomer's first touches (E-03) against a running stack, like smoke.ts. A fresh visitor opens
// /play and plays the sample game without signing in; after the first round a faked `beforeinstallprompt` leads to the
// "Cài Tò He" card; an iPhone sees the steps of iOS; the in-app browsers of Zalo and Messenger see "Mở bằng trình
// duyệt" on arrival; the installed app (standalone) never sees any of it; a room link still asks to sign in. Needs the
// sample game in the catalog (the smoke test waits for it the same way) and no account: nothing signs in.
// Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e journey
import { AxeBuilder } from '@axe-core/playwright';
import { type Browser, type BrowserContext, chromium, type Frame, type Page } from 'playwright';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const catalogUrl = new URL('/play', hubUrl).href;
const step = (message: string) => console.log(`• ${message}`);
const errors: string[] = [];

const userAgents = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  zaloAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Zalo/24.09.01',
  messengerIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0;FBBV/1;FBDV/iPhone15,2]',
};

/** Chrome's `beforeinstallprompt`, faked: fired once the hub has loaded, counting how often `prompt()` is called. */
const fakeInstallPrompt = () => {
  const w = window as unknown as { __prompted: number };
  w.__prompted = 0;
  window.addEventListener('load', () => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        w.__prompted++;
      },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
};

/** The page running as the installed app: `display-mode: standalone` matches, and iOS's `navigator.standalone`. */
const asInstalledApp = () => {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const list = original(query);
    if (!query.includes('display-mode: standalone')) return list;
    return new Proxy(list, {
      get: (target, key) => {
        if (key === 'matches') return true;
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
  Object.defineProperty(navigator, 'standalone', { value: true });
};

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const contexts: { name: string; context: BrowserContext; page: Page }[] = [];

/** A new phone with nothing on it, as the visitor's own: its User-Agent and what to run before the hub starts. */
async function visitor(
  name: string,
  userAgent: string,
  target: Browser,
  init: (() => void)[] = [],
): Promise<Page> {
  const context = await target.newContext({
    userAgent,
    viewport: { width: 390, height: 844 },
    // Layout and contrast do not depend on density, and CI draws games in software (see rooms.ts).
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'vi-VN',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  for (const script of init) await context.addInitScript(script);
  const page = await context.newPage();
  contexts.push({ name, context, page });
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${name}: ${message.text()} (${message.location().url})`);
  });
  return page;
}

/** Both themes: nothing overflows sideways and the text meets WCAG AA contrast (as smoke.ts does for its steps). */
async function check(page: Page, name: string) {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((next) => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY) animation.finish();
      }
    }, theme);
    await page.screenshot({ path: `test-results/journey-${name}-${theme}.png` });
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
}

async function gameFrame(target: Page): Promise<Frame> {
  for (let i = 0; i < 100; i++) {
    const frame = target.frames().find((f) => f !== target.mainFrame() && f.url().includes('/hello/'));
    if (frame) return frame;
    await target.waitForTimeout(100);
  }
  throw new Error('game iframe did not load');
}

/** From the catalog: opens the sample game, plays one 20 s round to its end card and leaves to the catalog. */
async function playOneRound(page: Page) {
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
  await card.tap();
  await page.waitForURL(/\/play\/hello$/);
  const frame = await gameFrame(page);
  const box = await page.locator('iframe').boundingBox();
  if (!box) throw new Error('game iframe has no layout box');
  await frame.getByRole('button', { name: '▶ Chơi', exact: true }).tap();
  await frame.getByRole('button', { name: '▶ Bắt đầu' }).tap();
  // Taps stay in the playfield, below the HUD: they must never reach the menu (☰, top left). As in smoke.ts, the
  // deadline is taken before the round starts.
  const end = Date.now() + 17_000;
  const again = frame.getByRole('button', { name: '▶ Chơi lại', exact: true });
  while (Date.now() < end && !(await again.isVisible())) {
    const x = Math.round(box.x + 24 + Math.random() * (box.width - 48));
    const y = Math.round(box.y + 96 + Math.random() * (box.height - 96 - 24));
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
  }
  await again.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500); // the hub takes the final score in
  await frame.getByRole('button', { name: '🏠 Menu chính' }).tap();
  await frame.getByRole('button', { name: 'Về Tò He' }).tap();
  await page.waitForURL(catalogUrl);
}

const installCard = (page: Page) => page.getByRole('heading', { name: 'Cài Tò He' });
const openStrip = (page: Page) => page.getByRole('region', { name: 'Mở bằng trình duyệt' });
const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu', exact: true });
const storedNo = (page: Page) => page.evaluate(() => localStorage.getItem('tohe:install-dismissed'));

try {
  step(
    'a new visitor opens the hub: the public page\'s "Chơi ngay" leads to the catalog, played as a guest, no sign-in',
  );
  const android = await visitor('android', userAgents.androidChrome, browser, [fakeInstallPrompt]);
  await android.goto(hubUrl);
  await android.getByRole('link', { name: 'Chơi ngay' }).tap();
  await android.waitForURL(catalogUrl);
  await android.getByRole('link', { name: 'Đăng nhập' }).waitFor(); // the slim strip for guests
  await android
    .getByRole('link', { name: /Ghép Khối|Chạm Chấm/ })
    .first()
    .waitFor();
  if (android.url().includes('/account/sign-in')) throw new Error('a new visitor was sent to sign in');
  if (await installCard(android).isVisible()) throw new Error('the install card showed before any game');

  step('"Góp ý / báo lỗi" in the menu writes to the operator, with the version and the browser in the mail');
  await menuButton(android).tap();
  const menu = android.getByRole('dialog', { name: 'Menu' });
  const mail = await menu.getByRole('link', { name: /Góp ý \/ báo lỗi/ }).getAttribute('href');
  const mailUrl = new URL(mail ?? 'about:blank');
  if (mailUrl.protocol !== 'mailto:' || mailUrl.pathname !== 'hello@toheplay.io.vn') {
    throw new Error(`the feedback link does not write to the operator: ${mail}`);
  }
  const body = mailUrl.searchParams.get('body') ?? '';
  if (!body.includes('Phiên bản:') || !body.includes('Trình duyệt:')) {
    throw new Error(`the feedback mail lacks the version or the browser: ${body}`);
  }
  await menu.getByRole('button', { name: 'Cài app' }).waitFor();
  await android.screenshot({ path: 'test-results/journey-menu.png' });
  await menu.getByRole('button', { name: '✕' }).tap();

  step('he plays the sample game without signing in; after the round, the catalog offers "Cài Tò He"');
  await playOneRound(android);
  await installCard(android).waitFor({ timeout: 5000 });
  await check(android, 'install-card');

  step('"Cài về máy" calls the browser\'s prompt and the card goes away');
  await android.getByRole('button', { name: 'Cài về máy' }).tap();
  await android.waitForFunction(() => (window as unknown as { __prompted: number }).__prompted === 1);
  await installCard(android).waitFor({ state: 'hidden' });

  step('"Cài app" in the menu still opens something any time, saying how by hand once the prompt is used');
  await menuButton(android).tap();
  await menu.getByRole('button', { name: 'Cài app' }).tap();
  const sheet = android.getByRole('dialog', { name: 'Cài Tò He' });
  await sheet.getByText(/Cài đặt ứng dụng/).waitFor();
  await sheet.getByRole('button', { name: '✕' }).tap();
  await android.context().close();

  step(
    'an iPhone in Safari: after the first round, the sheet with the steps of iOS 26; "Đã hiểu" keeps it quiet',
  );
  const iphone = await visitor('iphone', userAgents.iphoneSafari, browser);
  await iphone.goto(catalogUrl);
  await iphone.getByRole('link', { name: 'Đăng nhập' }).waitFor();
  await playOneRound(iphone);
  const steps = iphone.getByRole('dialog', { name: 'Cài Tò He' });
  await steps.getByText(/Thêm vào Màn hình chính/).waitFor();
  await steps.getByText(/Mở dưới dạng ứng dụng web/).waitFor();
  await check(iphone, 'install-ios');
  await steps.getByRole('button', { name: 'Đã hiểu' }).tap();
  await steps.waitFor({ state: 'hidden' });
  if ((await storedNo(iphone)) === null) throw new Error('"Đã hiểu" did not keep the hub quiet for 14 days');
  await menuButton(iphone).tap();
  await iphone.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Cài app' }).tap();
  await iphone
    .getByRole('dialog', { name: 'Cài Tò He' })
    .getByText(/Chia sẻ/)
    .waitFor();
  await iphone.context().close();

  for (const [name, userAgent, zalo] of [
    ['zalo', userAgents.zaloAndroid, true],
    ['messenger', userAgents.messengerIos, false],
  ] as const) {
    step(
      `in the browser of ${name}: on arrival, a strip "Mở bằng trình duyệt" with "Chép link" (no game needed)`,
    );
    const inApp = await visitor(name, userAgent, browser);
    await inApp.goto(catalogUrl);
    const strip = openStrip(inApp);
    await strip.waitFor();
    const hint = await strip.getByText(/Trong Zalo/).count();
    if (hint > 0 !== zalo) throw new Error(`${name}: the Zalo hint is ${hint > 0 ? 'there' : 'missing'}`);
    if (await installCard(inApp).isVisible())
      throw new Error(`${name}: the install card showed in a chat app`);
    await check(inApp, `in-app-${name}`);
    await strip.getByRole('button', { name: 'Chép link' }).tap();
    await strip.getByRole('button', { name: 'Đã chép' }).waitFor();
    const copied = await inApp.evaluate(() => navigator.clipboard.readText());
    if (copied !== catalogUrl) throw new Error(`${name}: "Chép link" copied ${copied}, not ${catalogUrl}`);
    await strip.getByRole('button', { name: 'Ẩn' }).tap();
    await strip.waitFor({ state: 'hidden' });
    await inApp.reload();
    await inApp.getByRole('link', { name: 'Đăng nhập' }).waitFor();
    if (await openStrip(inApp).isVisible()) throw new Error(`${name}: the strip came back after "Ẩn"`);
    await inApp.context().close();
  }

  step('the installed app (standalone) never shows an install offer: not after a round, not in the menu');
  const installed = await visitor('standalone', userAgents.androidChrome, browser, [
    fakeInstallPrompt,
    asInstalledApp,
  ]);
  await installed.goto(catalogUrl);
  await installed.getByRole('link', { name: 'Đăng nhập' }).waitFor();
  await playOneRound(installed);
  await installed.waitForTimeout(1500);
  if (await installCard(installed).isVisible()) throw new Error('the installed app offered to install');
  if (await openStrip(installed).isVisible())
    throw new Error('the installed app offered to open in a browser');
  await menuButton(installed).tap();
  const installedMenu = installed.getByRole('dialog', { name: 'Menu' });
  await installedMenu.getByRole('link', { name: /Góp ý \/ báo lỗi/ }).waitFor();
  if ((await installedMenu.getByRole('button', { name: 'Cài app' }).count()) > 0) {
    throw new Error('the installed app has "Cài app" in its menu');
  }
  await installed.context().close();

  step('what needs an account still asks for one: a room link sends a new device to sign in');
  const link = await visitor('room-link', userAgents.androidChrome, browser);
  await link.goto(`${hubUrl}/r/123456`);
  await link.waitForURL(/\/account\/sign-in$/);
  await link.context().close();

  if (errors.length > 0) throw new Error(`console errors:\n${errors.join('\n')}`);
  console.log('\nPASS');
} catch (error) {
  for (const { name, page } of contexts) {
    await page.screenshot({ path: `test-results/journey-failure-${name}.png` }).catch(() => {});
  }
  console.error(`\nFAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
