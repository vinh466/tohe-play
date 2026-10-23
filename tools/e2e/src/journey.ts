#!/usr/bin/env node
// End-to-end test of a newcomer's first touches (E-03) against a running stack, like smoke.ts. A fresh visitor opens
// /play and plays the sample game as the device profile made for it, without signing in; after the first round a faked
// `beforeinstallprompt` leads to the "Cài Tò He" card; then the visitor signs up keeping that device profile (ADR 0043):
// its score is in the account and on no public board; another phone's device profile is brought into that account on
// signing in ("Thêm vào"). An iPhone sees the steps of iOS; the in-app browsers of Zalo and
// Messenger see "Mở bằng trình duyệt" on arrival; the installed app (standalone) never sees any of it; a room link
// still asks to sign in; a device profile moves to a new phone with its transfer code (six digits, the old phone says
// yes). Coming back (ADR 0046): "Chơi tiếp" after the first round, an ended session that says so, and on an iPhone a
// room link's line on opening it in the installed app. Needs the sample game in the catalog (the smoke test waits for it the same way), and Mailpit for the one
// sign-up's code.
// Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e journey
import { AxeBuilder } from '@axe-core/playwright';
import { type Browser, type BrowserContext, chromium, type Frame, type Page } from 'playwright';
import { ANIMALS } from '../../../apps/hub/src/session/animals.ts';
import { codeSentTo } from './mailpit.ts';

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
  await frame.getByRole('button', { name: 'Chơi', exact: true }).tap();
  await frame.getByRole('button', { name: 'Bắt đầu', exact: true }).tap();
  // Taps stay in the playfield, below the HUD: they must never reach the menu (☰, top left). As in smoke.ts, the
  // deadline is taken before the round starts.
  const end = Date.now() + 17_000;
  const again = frame.getByRole('button', { name: 'Chơi lại', exact: true });
  while (Date.now() < end && !(await again.isVisible())) {
    const x = Math.round(box.x + 24 + Math.random() * (box.width - 48));
    const y = Math.round(box.y + 96 + Math.random() * (box.height - 96 - 24));
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
  }
  await again.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500); // the hub takes the final score in
  await frame.getByRole('button', { name: 'Menu chính', exact: true }).tap();
  await frame.getByRole('button', { name: 'Về Tò He' }).tap();
  await page.waitForURL(catalogUrl);
}

const installCard = (page: Page) => page.getByRole('heading', { name: 'Cài Tò He' });
const openStrip = (page: Page) => page.getByRole('region', { name: 'Mở bằng trình duyệt' });
/** A tab of the app's frame (ADR 0046), in the bar at the bottom of a phone. */
const tab = (page: Page, name: 'Trò chơi' | 'Chơi cùng' | 'Tôi') =>
  page.getByRole('navigation', { name: 'Mục chính' }).getByRole('link', { name, exact: true });
const storedNo = (page: Page) => page.evaluate(() => localStorage.getItem('tohe:install-dismissed'));

try {
  step(
    'a new visitor opens the hub: "Chơi ngay" leads to the catalog, played as a device profile with a name, no sign-in',
  );
  const android = await visitor('android', userAgents.androidChrome, browser, [fakeInstallPrompt]);
  await android.goto(hubUrl);
  // The header's button, on a phone (a Vietnamese page's link carries ?lang=vi: a Vietnamese app on any phone).
  const play = android.getByRole('link', { name: 'Chơi ngay', exact: true });
  if (!(await play.getAttribute('href'))?.endsWith('/play?lang=vi'))
    throw new Error(
      `the header's "Chơi ngay" does not carry the page's language: ${await play.getAttribute('href')}`,
    );
  await play.tap();
  await android.waitForURL((url) => url.pathname === '/play');
  // The catalog has no strip about where progress is kept (voice-and-look.md): the chip of who plays, and the games.
  await android.getByRole('link', { name: /Đổi người chơi/ }).waitFor();
  if (await android.getByText('Tiến độ đang lưu trên máy này').isVisible())
    throw new Error('the catalog still carries the permanent strip about progress kept on this device');
  // The chip shows the avatar, then the name: the name is its last line.
  const chip = (await android.getByRole('link', { name: 'Đổi người chơi' }).innerText()).trim();
  const deviceName = (chip.split('\n').at(-1) ?? '').trim();
  if (!deviceName || deviceName === 'Khách')
    throw new Error(`the catalog names no device profile: "${deviceName}"`);
  // One animal for the name and the avatar: never "Cá Heo Lém Lỉnh" with a fox.
  const avatarOf = chip.split('\n')[0]?.trim() ?? '';
  const animal = ANIMALS.find((candidate) => candidate.avatar === avatarOf);
  if (!animal || !deviceName.includes(animal.vi))
    throw new Error(`the guest's name "${deviceName}" does not match its avatar "${avatarOf}"`);
  await android
    .getByRole('link', { name: /Ghép Khối|Chạm Chấm/ })
    .first()
    .waitFor();
  if (android.url().includes('/account/sign-in')) throw new Error('a new visitor was sent to sign in');
  if (await installCard(android).isVisible()) throw new Error('the install card showed before any game');

  step('"Góp ý / báo lỗi" in Tôi writes to the operator, with the version and the browser in the mail');
  await tab(android, 'Tôi').tap();
  await android.waitForURL((url) => url.pathname === '/account');
  const me = android.getByRole('main');
  const mail = await me.getByRole('link', { name: /Góp ý \/ báo lỗi/ }).getAttribute('href');
  const mailUrl = new URL(mail ?? 'about:blank');
  if (mailUrl.protocol !== 'mailto:' || mailUrl.pathname !== 'hello@toheplay.io.vn') {
    throw new Error(`the feedback link does not write to the operator: ${mail}`);
  }
  const body = mailUrl.searchParams.get('body') ?? '';
  if (!body.includes('Phiên bản:') || !body.includes('Trình duyệt:')) {
    throw new Error(`the feedback mail lacks the version or the browser: ${body}`);
  }
  await me.getByRole('button', { name: 'Cài', exact: true }).waitFor();
  await check(android, 'me');
  await tab(android, 'Trò chơi').tap();
  await android.waitForURL(catalogUrl);

  step(
    'the visitor plays the sample game without signing in; after the round, the catalog offers "Cài Tò He"',
  );
  await playOneRound(android);
  await installCard(android).waitFor({ timeout: 5000 });
  await check(android, 'install-card');
  // Coming back (ADR 0046): the catalog starts from the game this profile opened last.
  await android
    .getByRole('region', { name: 'Chơi tiếp' })
    .getByRole('link', { name: /Chạm Chấm/ })
    .waitFor();

  step('"Cài về máy" calls the browser\'s prompt and the card goes away');
  await android.getByRole('button', { name: 'Cài về máy' }).tap();
  await android.waitForFunction(() => (window as unknown as { __prompted: number }).__prompted === 1);
  await installCard(android).waitFor({ state: 'hidden' });

  step('"Cài app" in Tôi still opens something any time, saying how by hand once the prompt is used');
  await tab(android, 'Tôi').tap();
  await me.getByRole('button', { name: 'Cài', exact: true }).tap();
  const sheet = android.getByRole('dialog', { name: 'Cài Tò He' });
  await sheet.getByText(/Cài đặt ứng dụng/).waitFor();
  await sheet.getByRole('button', { name: 'Đóng' }).tap();
  await tab(android, 'Trò chơi').tap();
  await android.waitForURL(catalogUrl);

  step(
    `the visitor signs up keeping the device profile "${deviceName}" (ADR 0043): its score is in the account, on no public board`,
  );
  const deviceId = await android.evaluate(() => localStorage.getItem('tohe:device-profile'));
  if (!deviceId) throw new Error('no device profile is playing');
  // A device profile signs in from Tôi, where the account's section says so.
  await tab(android, 'Tôi').tap();
  await android.getByRole('link', { name: 'Đăng nhập' }).tap();
  await android.waitForURL(/\/account\/sign-in$/);
  await android.getByRole('link', { name: 'Tạo tài khoản' }).tap();
  await android.getByText(`Hồ sơ “${deviceName}” là của bạn?`).waitFor();
  await check(android, 'sign-up-question');
  const email = `e2e${Date.now().toString(36)}@e2e.test`;
  await android.getByLabel('Email', { exact: true }).fill(email);
  await android.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-e2e-123');
  await android.getByLabel('Nhập lại mật khẩu').fill('mat-khau-e2e-123');
  await android.getByRole('checkbox', { name: /16 tuổi/ }).check();
  await android.getByRole('button', { name: 'Gửi mã xác nhận' }).tap();
  await android.getByLabel('Mã xác nhận').fill(await codeSentTo(email));
  await android.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  await android.waitForURL(catalogUrl);
  const account = await android.evaluate(async () => {
    const me = (await (await fetch('/api/auth/me')).json()) as { profiles: { id: string; name: string }[] };
    const own = (await (await fetch('/api/boards/hello?period=week')).json()) as {
      rows: { profileId: string }[];
    };
    const server = (await (await fetch('/api/boards/hello/public?scope=server&period=week')).json()) as {
      top: { profileId: string }[];
    };
    return {
      profiles: me.profiles.map((profile) => `${profile.id} ${profile.name}`),
      own: own.rows.map((row) => row.profileId),
      server: server.top.map((row) => row.profileId),
    };
  });
  if (account.profiles.join() !== `${deviceId} ${deviceName}`) {
    throw new Error(`the account's first profile is not the device profile: ${account.profiles.join(', ')}`);
  }
  if (!account.own.includes(deviceId))
    throw new Error("the device profile's score is not on the account's board");
  if (account.server.includes(deviceId)) throw new Error("a device profile's score reached a public board");
  await android.context().close();

  step(
    'another phone plays as its own device profile, then signs in to that account: "Thêm vào" brings it in, and it plays on',
  );
  const second = await visitor('second', userAgents.androidChrome, browser);
  await second.goto(catalogUrl);
  await second.getByRole('link', { name: /Đổi người chơi/ }).waitFor();
  await playOneRound(second);
  const secondId = await second.evaluate(() => localStorage.getItem('tohe:device-profile'));
  if (!secondId) throw new Error('no device profile is playing on the second phone');
  await tab(second, 'Tôi').tap();
  await second.getByRole('link', { name: 'Đăng nhập' }).tap();
  await second.waitForURL(/\/account\/sign-in$/);
  await second.getByLabel('Email', { exact: true }).fill(email);
  await second.getByLabel('Mật khẩu').fill('mat-khau-e2e-123');
  await second.getByRole('button', { name: 'Đăng nhập', exact: true }).tap();
  await second.getByRole('heading', { name: 'Hồ sơ trên máy này' }).waitFor();
  for (const choice of ['Thêm vào', 'Gộp vào', 'Giữ ở máy'])
    await second.getByRole('button', { name: choice }).waitFor();
  await check(second, 'bring-in');
  await second.getByRole('button', { name: 'Thêm vào' }).tap();
  await second.getByRole('button', { name: 'Xong' }).tap();
  // Profile management: the account has no manage PIN yet, so its password.
  await second.getByLabel('Mật khẩu').fill('mat-khau-e2e-123');
  await second.getByRole('button', { name: 'Xác nhận' }).tap();
  await second.waitForURL(catalogUrl);
  const signedIn = await second.evaluate(async () => {
    const me = (await (await fetch('/api/auth/me')).json()) as {
      profiles: { id: string }[];
      activeProfileId: string | null;
    };
    const server = (await (await fetch('/api/boards/hello/public?scope=server&period=week')).json()) as {
      top: { profileId: string }[];
    };
    return {
      profiles: me.profiles.map((p) => p.id),
      active: me.activeProfileId,
      server: server.top.map((r) => r.profileId),
    };
  });
  if (!signedIn.profiles.includes(secondId)) throw new Error('the second device profile was not brought in');
  if (signedIn.active !== secondId)
    throw new Error('the phone does not play on as the profile it brought in');
  if (signedIn.server.includes(secondId)) throw new Error("a device profile's score reached a public board");

  step(
    "the account's session ends on that phone: the app says so and offers to sign in — no silent device profile (ADR 0046)",
  );
  await second.context().clearCookies();
  await second.reload();
  await second.getByRole('heading', { name: 'Phiên đăng nhập đã hết' }).waitFor();
  if (await second.getByRole('link', { name: 'Đổi người chơi' }).isVisible()) {
    throw new Error('a player shows as playing after the session ended');
  }
  await check(second, 'session-ended');
  await second.getByRole('button', { name: 'Đăng nhập lại' }).tap();
  await second.waitForURL(/\/account\/sign-in$/);
  await second.context().close();

  step(
    'an iPhone in Safari: after the first round, the sheet with the steps of iOS 26; "Đã hiểu" keeps it quiet',
  );
  const iphone = await visitor('iphone', userAgents.iphoneSafari, browser);
  await iphone.goto(catalogUrl);
  await iphone.getByRole('link', { name: /Đổi người chơi/ }).waitFor();
  await playOneRound(iphone);
  const steps = iphone.getByRole('dialog', { name: 'Cài Tò He' });
  await steps.getByText(/Thêm vào Màn hình chính/).waitFor();
  await steps.getByText(/Mở dưới dạng ứng dụng web/).waitFor();
  await check(iphone, 'install-ios');
  await steps.getByRole('button', { name: 'Đã hiểu' }).tap();
  await steps.waitFor({ state: 'hidden' });
  if ((await storedNo(iphone)) === null) throw new Error('"Đã hiểu" did not keep the hub quiet for 14 days');
  await tab(iphone, 'Tôi').tap();
  await iphone.getByRole('main').getByRole('button', { name: 'Cài', exact: true }).tap();
  await iphone
    .getByRole('dialog', { name: 'Cài Tò He' })
    .getByText(/Chia sẻ/)
    .waitFor();
  await iphone.getByRole('dialog', { name: 'Cài Tò He' }).getByRole('button', { name: 'Đóng' }).tap();

  step(
    'on the iPhone, a room link says how to open it in the installed app, whose storage Safari does not share',
  );
  await iphone.goto(`${hubUrl}/r/123456`);
  await iphone.getByRole('heading', { name: 'Vào bàn cùng mọi người' }).waitFor();
  await iphone.getByText('Đã cài app Tò He? Mở app, bấm Nhập mã rồi gõ 123 456.').waitFor();
  await check(iphone, 'installed-app-hint');
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
    await inApp.getByRole('link', { name: /Đổi người chơi/ }).waitFor();
    if (await openStrip(inApp).isVisible()) throw new Error(`${name}: the strip came back after "Ẩn"`);
    await inApp.context().close();
  }

  step('the installed app (standalone) never shows an install offer: not after a round, not in Tôi');
  const installed = await visitor('standalone', userAgents.androidChrome, browser, [
    fakeInstallPrompt,
    asInstalledApp,
  ]);
  await installed.goto(catalogUrl);
  await installed.getByRole('link', { name: /Đổi người chơi/ }).waitFor();
  await playOneRound(installed);
  await installed.waitForTimeout(1500);
  if (await installCard(installed).isVisible()) throw new Error('the installed app offered to install');
  if (await openStrip(installed).isVisible())
    throw new Error('the installed app offered to open in a browser');
  await tab(installed, 'Tôi').tap();
  const installedMe = installed.getByRole('main');
  await installedMe.getByRole('link', { name: /Góp ý \/ báo lỗi/ }).waitFor();
  if ((await installedMe.getByRole('button', { name: 'Cài', exact: true }).count()) > 0) {
    throw new Error('the installed app has "Cài app" in Tôi');
  }
  await installed.context().close();

  step('a room link on a new device asks for a name and the terms line, not an account (ADR 0043)');
  const link = await visitor('room-link', userAgents.androidChrome, browser);
  await link.goto(`${hubUrl}/r/123456`);
  await link.getByRole('heading', { name: 'Vào bàn cùng mọi người' }).waitFor();
  await link.getByRole('button', { name: 'Nhờ bố mẹ' }).waitFor();
  if (await link.getByText(/Đã cài app Tò He/).isVisible()) {
    throw new Error('Android was told to open the link in the app by hand');
  }
  await link.context().close();

  step(
    'a guest at a game’s lobby has a way out (←); a path that is no screen says so in Vietnamese, with the way to Trò chơi (ADR 0046)',
  );
  const lost = await visitor('lost', userAgents.androidChrome, browser);
  await lost.goto(`${hubUrl}/play/tien-len/rooms`);
  const out = lost.getByRole('link', { name: /Quay lại|Về danh sách trò chơi/ }).first();
  await out.waitFor();
  await out.tap();
  await lost.waitForURL((url) => url.pathname === '/play');
  for (const path of ['/account/foo', '/play/x/y']) {
    await lost.goto(`${hubUrl}${path}`);
    await lost.getByRole('heading', { name: 'Không tìm thấy trang này' }).waitFor();
    await lost.getByRole('link', { name: 'Về Tò He' }).tap();
    await lost.waitForURL((url) => url.pathname === '/play');
  }
  await lost.context().close();

  step(
    'a device profile moves to a new phone with six digits the old phone confirms, its score with it (ADR 0043, I2b)',
  );
  const oldPhone = await visitor('transfer-old', userAgents.androidChrome, browser);
  await oldPhone.goto(catalogUrl);
  await oldPhone.getByRole('link', { name: /Đổi người chơi/ }).waitFor();
  await playOneRound(oldPhone);
  const movingId = await oldPhone.evaluate(() => localStorage.getItem('tohe:device-profile'));
  if (!movingId) throw new Error('no device profile is playing on the old phone');
  await oldPhone.goto(`${hubUrl}/account/profiles`);
  await oldPhone.getByRole('button', { name: /^Sửa / }).tap();
  await oldPhone.getByRole('button', { name: /Chuyển sang máy khác/ }).tap();
  // Never on the server yet: the named screen and its terms line first.
  await oldPhone.getByRole('heading', { name: 'Trước khi chuyển máy' }).waitFor();
  await oldPhone.getByRole('checkbox').check();
  await oldPhone.getByRole('button', { name: 'Tạo mã' }).tap();
  const shown = oldPhone.getByText(/^\d{3} \d{3}$/);
  await shown.waitFor();
  await oldPhone.getByRole('img', { name: 'Mã QR để chuyển hồ sơ' }).waitFor();
  await check(oldPhone, 'transfer-code');
  const digits = ((await shown.textContent()) ?? '').replace(/\s/g, '');

  const newPhone = await visitor('transfer-new', userAgents.androidChrome, browser);
  await newPhone.goto(`${hubUrl}/account/transfer`);
  await newPhone.getByRole('heading', { name: 'Nhận hồ sơ từ máy khác' }).waitFor();
  await check(newPhone, 'transfer-receive');
  await newPhone.getByLabel('6 số hoặc link chuyển máy').fill(digits);
  await newPhone.getByRole('button', { name: 'Nhận hồ sơ' }).tap();
  await newPhone.getByRole('heading', { name: 'Đang chờ máy cũ đồng ý…' }).waitFor();
  await oldPhone.getByRole('button', { name: 'Đồng ý' }).tap();
  await newPhone.getByRole('heading', { name: /^Đã nhận/ }).waitFor();
  await oldPhone.getByRole('heading', { name: /đã sang máy mới/ }).waitFor();
  const arrived = await newPhone.evaluate(
    (id) =>
      new Promise<{ playing: string | null; scores: number }>((resolve, reject) => {
        const open = indexedDB.open('tohe');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction('scores').objectStore('scores').getAll();
          read.onsuccess = () =>
            resolve({
              playing: localStorage.getItem('tohe:device-profile'),
              scores: (read.result as { profileId: string }[]).filter((score) => score.profileId === id)
                .length,
            });
        };
      }),
    movingId,
  );
  if (arrived.playing !== movingId) throw new Error('the new phone does not play as the profile it received');
  if (arrived.scores === 0) throw new Error("the profile's score did not move with it");
  await oldPhone.context().close();
  await newPhone.context().close();

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
