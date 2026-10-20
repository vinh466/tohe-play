#!/usr/bin/env node
// End-to-end test of the entry pipeline (ADR 0044, I3b) against a running stack, like journey.ts. A player signs up and
// shares the sample game ("Chia sẻ": the link, its QR code); a share link that asks for a name, opened on a fresh
// phone from a link preview's card (`?app=1`), keeps its intent through the named screen and lands in the game, `play`
// counted once though the game is reloaded; one that asks for an account keeps it through signing up, which passes
// `entryCode`; "Nhập mã" takes a share link's eight characters and a table's six digits; a link revoked in "Link của
// tôi" and an unknown code show their dead ends. Needs the sample game (hello) and Tiến Lên in the catalog, and Mailpit.
// Usage: HUB_URL=http://localhost:4720 pnpm --filter @tohe/e2e entries
import { AxeBuilder } from '@axe-core/playwright';
import { type BrowserContext, chromium, type Page } from 'playwright';
import { codeSentTo } from './mailpit.ts';

const hubUrl = process.env.HUB_URL ?? 'http://localhost:4720';
const password = 'mat-khau-e2e-123';
const step = (message: string) => console.log(`• ${message}`);
const errors: string[] = [];
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const contexts: { name: string; context: BrowserContext; page: Page }[] = [];

/** A new phone with nothing on it. */
async function phone(name: string): Promise<Page> {
  const context = await browser.newContext({
    userAgent: androidChrome,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'vi-VN',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  contexts.push({ name, context, page });
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    // A refused request logs a resource error; what matters is what the page shows.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
      errors.push(`${name}: ${message.text()} (${message.location().url})`);
  });
  return page;
}

/** Both themes: nothing overflows sideways and the text meets WCAG AA contrast (as journey.ts does). */
async function check(page: Page, name: string) {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((next) => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY) animation.finish();
      }
    }, theme);
    await page.screenshot({ path: `test-results/entries-${name}-${theme}.png` });
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

/** Signs up on the register page with a new email; returns it. */
async function signUp(page: Page): Promise<string> {
  const email = `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}@e2e.test`;
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('checkbox', { name: /16 tuổi/ }).check();
  await page.getByRole('button', { name: 'Gửi mã xác nhận' }).tap();
  await page.getByLabel('Mã xác nhận').fill(await codeSentTo(email));
  await page.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  return email;
}

/** The game's frame has loaded: the player landed in the game. */
async function inGame(page: Page, gameId: string) {
  await page.waitForURL(new RegExp(`/play/${gameId}$`));
  for (let i = 0; i < 100; i++) {
    if (page.frames().some((f) => f !== page.mainFrame() && f.url().includes(`/${gameId}/`))) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`the ${gameId} game never loaded`);
}

interface Mine {
  code: string;
  state: string;
  counts: { opened: number; played: number; accountsMade: number | null };
}

/** The maker's links, as "Link của tôi" reads them. */
const mine = (page: Page) =>
  page.evaluate(async () => (await (await fetch('/api/links/mine')).json()) as Mine[]);

/** A link made with the maker's session, asking `level` of whoever opens it. */
async function makeLink(page: Page, level: 'any' | 'named' | 'account'): Promise<string> {
  const made = await page.evaluate(async (asked) => {
    const response = await fetch('/api/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'game', gameId: 'hello', level: asked }),
    });
    return response.ok ? ((await response.json()) as { code: string }).code : `HTTP ${response.status}`;
  }, level);
  if (!/^[0-9A-Z]{8}$/.test(made)) throw new Error(`could not make a ${level} link: ${made}`);
  return made;
}

try {
  step(
    'a player signs up, waits for the sample game, and shares it: "Chia sẻ" shows the link and its QR code',
  );
  const maker = await phone('maker');
  await maker.goto(`${hubUrl}/account/register`);
  await signUp(maker);
  await maker.waitForURL((url) => url.pathname === '/play');
  const share = maker.getByRole('button', { name: 'Chia sẻ Chạm Chấm' });
  for (let attempt = 0; ; attempt++) {
    const shown = await share.waitFor({ timeout: 3000 }).then(
      () => true,
      () => false,
    );
    if (shown) break;
    if (attempt === 20) throw new Error('the sample game never appeared in the catalog');
    await maker.reload();
  }
  await share.tap();
  const sheet = maker.getByRole('dialog', { name: 'Chia sẻ Chạm Chấm' });
  await sheet.getByRole('img', { name: 'Mã QR mời chơi Chạm Chấm' }).waitFor();
  const shown = ((await sheet.getByText(/^[0-9A-Z]{4} [0-9A-Z]{4}$/).textContent()) ?? '').replace(' ', '');
  await sheet.getByRole('button', { name: 'Chép link' }).tap();
  await sheet.getByRole('button', { name: 'Đã chép' }).waitFor();
  const copied = await maker.evaluate(() => navigator.clipboard.readText());
  if (copied !== `${hubUrl}/s/${shown}`)
    throw new Error(`"Chép link" copied ${copied}, not ${hubUrl}/s/${shown}`);
  await check(maker, 'share-sheet');
  await sheet.getByRole('button', { name: '✕' }).tap();
  // Opening the sheet again shows the same link: it is not sharing twice.
  await share.tap();
  await sheet.getByText(`${shown.slice(0, 4)} ${shown.slice(4)}`).waitFor();
  await sheet.getByRole('button', { name: '✕' }).tap();
  if ((await mine(maker)).length !== 1) throw new Error('opening the share sheet twice made two links');

  step(
    'a link asking for a name, opened from a preview card on a new phone: ?app=1 dropped, the named screen',
  );
  const named = await makeLink(maker, 'named');
  const friend = await phone('friend');
  await friend.goto(`${hubUrl}/s/${named.toLowerCase()}?app=1`);
  await friend.waitForURL(`${hubUrl}/s/${named}`);
  await friend.getByRole('heading', { name: 'Trước khi vào chơi' }).waitFor();
  await check(friend, 'named-entry');

  step('the intent is kept through a reload, then the named screen lands in the game');
  await friend.reload();
  await friend.getByRole('heading', { name: 'Trước khi vào chơi' }).waitFor();
  await friend.getByRole('checkbox').check();
  await friend.getByRole('button', { name: 'Vào chơi' }).tap();
  await inGame(friend, 'hello');
  await friend.reload();
  await inGame(friend, 'hello');
  const afterNamed = (await mine(maker)).find((link) => link.code === named);
  if (afterNamed?.counts.opened !== 1 || afterNamed.counts.played !== 1) {
    throw new Error(`the named link counts ${JSON.stringify(afterNamed?.counts)}, not opened 1 and played 1`);
  }

  step('a link asking for an account keeps its intent through signing up, which passes entryCode once');
  const forAccount = await makeLink(maker, 'account');
  const newcomer = await phone('newcomer');
  const sentCodes: string[] = [];
  newcomer.on('request', (request) => {
    if (request.url().endsWith('/api/auth/register/confirm')) {
      const body = JSON.parse(request.postData() ?? '{}') as { entryCode?: string | null };
      sentCodes.push(body.entryCode ?? '');
    }
  });
  await newcomer.goto(`${hubUrl}/s/${forAccount}`);
  await newcomer.getByRole('heading', { name: 'Link này cần tài khoản' }).waitFor();
  await check(newcomer, 'account-needed');
  await newcomer.getByRole('button', { name: 'Tạo tài khoản' }).tap();
  await newcomer.waitForURL(/\/account\/register$/);
  await signUp(newcomer);
  await inGame(newcomer, 'hello');
  if (sentCodes.join() !== forAccount)
    throw new Error(`sign-up sent entryCode ${JSON.stringify(sentCodes)}, not ${forAccount}`);
  const afterAccount = (await mine(maker)).find((link) => link.code === forAccount);
  if (afterAccount?.counts.played !== 1) throw new Error('the account link did not count its play');
  // One account made: below three, the maker sees none.
  if (afterAccount.counts.accountsMade !== null)
    throw new Error('the maker sees one account made from its link');

  step('"Nhập mã" in the catalog takes a share link’s eight characters, typed loosely');
  const typist = await phone('typist');
  await typist.goto(`${hubUrl}/play`);
  await typist.getByRole('button', { name: 'Nhập mã' }).first().tap();
  const box = typist.getByRole('dialog', { name: 'Nhập mã' });
  await box
    .getByLabel('Mã bàn chơi hoặc link mời')
    .fill(`${shown.slice(0, 4).toLowerCase()}-${shown.slice(4)}`);
  await box.getByText(`Link mời ${shown.slice(0, 4)} ${shown.slice(4)}`).waitFor();
  await check(typist, 'enter-code');
  await box.getByRole('button', { name: 'Mở' }).tap();
  await inGame(typist, 'hello');

  step('…and a table’s six digits: the named screen, then the table');
  const table = await maker.evaluate(async () => {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: 'tien-len', seats: 4, isPublic: false, botsFill: true }),
    });
    return response.ok ? ((await response.json()) as { code: string }).code : `HTTP ${response.status}`;
  });
  if (!/^\d{6}$/.test(table)) throw new Error(`could not open a table: ${table}`);
  await typist.goto(`${hubUrl}/play`);
  await typist.getByRole('button', { name: 'Nhập mã' }).first().tap();
  await box.getByLabel('Mã bàn chơi hoặc link mời').fill(`${table.slice(0, 3)} ${table.slice(3)}`);
  await box.getByRole('button', { name: 'Mở' }).tap();
  await typist.waitForURL(`${hubUrl}/r/${table}`);
  await typist.getByRole('heading', { name: 'Vào bàn cùng mọi người' }).waitFor();
  await typist.getByRole('checkbox').check();
  await typist.getByRole('button', { name: 'Vào chơi' }).tap();
  await typist.getByRole('button', { name: 'Vào ngồi' }).waitFor();

  step('the maker revokes a link in "Link của tôi"; opened again, it says so and offers the game');
  await maker.goto(`${hubUrl}/account/links`);
  await maker.getByRole('heading', { name: 'Link của tôi' }).waitFor();
  await check(maker, 'my-links');
  const card = maker.getByRole('listitem').filter({ hasText: `${named.slice(0, 4)} ${named.slice(4)}` });
  await card.getByRole('button', { name: 'Thu hồi' }).tap();
  await maker
    .getByRole('dialog')
    .filter({ hasText: 'Thu hồi link này?' })
    .getByRole('button', { name: 'Thu hồi' })
    .tap();
  await card.getByText('Đã thu hồi', { exact: true }).waitFor();
  const late = await phone('late');
  await late.goto(`${hubUrl}/s/${named}`);
  await late.getByRole('heading', { name: 'Link mời đã bị thu hồi' }).waitFor();
  await check(late, 'revoked');
  await late.getByRole('link', { name: 'Chơi Chạm Chấm' }).tap();
  await inGame(late, 'hello');

  step('an unknown code: "Mã này không mở được nữa", with the catalog and the "Nhập mã" box');
  await late.goto(`${hubUrl}/s/ZZZZZZZZ`);
  await late.getByRole('heading', { name: 'Mã này không mở được nữa' }).waitFor();
  await late.getByLabel('Mã bàn chơi hoặc link mời').waitFor();
  await late.getByRole('link', { name: 'Về danh sách trò chơi' }).waitFor();
  await check(late, 'unknown');

  if (errors.length > 0) throw new Error(`console errors:\n${errors.join('\n')}`);
  console.log('\nPASS');
} catch (error) {
  for (const { name, page } of contexts) {
    await page.screenshot({ path: `test-results/entries-failure-${name}.png` }).catch(() => {});
  }
  console.error(`\nFAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
