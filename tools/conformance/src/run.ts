// Conformance kit: decides whether a built game honours the Game Contract, whatever it is written in.
// It serves the build on its own origin with the production CSP, embeds it in a fake hub on a second
// origin, drives the protocol from Node through @tohe/game-sdk/host, and throws random input at it.
// Then it shows the game in every theme it declares and checks its text contrast (ADR 0013). A game with the
// `shell` capability (ADR 0018) is checked for its main menu, its answer to Back and its way out. Every game is opened
// with an entry (ADR 0045); a game that declares `entries` is opened with each payload it ships, and with hostile ones.
// The build is served under its folder, `/<id>/<version>/`, as the games origin serves it, and a request outside that
// folder fails (ADR 0053); a game that declares `assets` is checked for its `studio/` folder.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import {
  ENTRY_SAMPLES,
  type EntryResult,
  entrySamplesPath,
  type GameManifest,
  GameManifest as GameManifestSchema,
  gameContentSecurityPolicy,
  jsonBytes,
  MAX_ENTRY_PAYLOAD_BYTES,
  type Theme,
} from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import { createHost, type Transport } from '@tohe/game-sdk/host';
import { type Browser, type BrowserContext, chromium, type Frame, type Page } from 'playwright';
import { checkRules, defaultOptions, loadRules, pure } from './rules.ts';
import { serveStatic } from './static-server.ts';
import { checkStudio } from './studio.ts';
import { checkVerify, loadVerify, playRanked, replayRanked } from './verify.ts';

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ConformanceResult {
  gameId: string | null;
  checks: Check[];
  ok: boolean;
  /** After random input, then one per declared theme. */
  screenshots: string[];
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
  const done = (gameId: string | null, screenshots: string[] = []): ConformanceResult => ({
    gameId,
    checks,
    ok: checks.every((c) => c.ok),
    screenshots,
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

  // A game played at a table (ADR 0016): its rules module, checked the way the API will run it.
  if (manifest.rooms) {
    for (const result of await checkRules(dist, manifest.rooms)) check(result.name, result.ok, result.detail);
  }

  // A ranked game (ADR 0030): its verify module, checked the way the API will replay runs with it.
  if (manifest.ranked) {
    for (const result of await checkVerify(dist, manifest.ranked))
      check(result.name, result.ok, result.detail);
  }

  // A game that opens share links itself (ADR 0045) ships the payloads its share makes.
  const samples = manifest.entries?.includes('share') ? readSamples(dist) : null;
  if (samples)
    check(`${entrySamplesPath('share')} holds the payloads its share makes`, samples.ok, samples.detail);

  // A game that pins asset packs (ADR 0053) ships them in studio/, by hash, with the lock and the credits.
  if (manifest.assets) {
    for (const result of checkStudio(dist, manifest.assets)) check(result.name, result.ok, result.detail);
  }

  // ---------------------------------------------------------------- runtime checks
  const hostDir = mkdtempSync(join(tmpdir(), 'tohe-conformance-'));
  const hostServer = await serveStatic({ root: hostDir });
  // The games origin serves each build under its folder (ADR 0007): the build is linked at <root>/<id>/<version>.
  const gamesRoot = mkdtempSync(join(tmpdir(), 'tohe-conformance-games-'));
  const folderPath = `/${manifest.id}/${manifest.version}/`;
  const buildLink = join(gamesRoot, manifest.id, manifest.version);
  mkdirSync(join(gamesRoot, manifest.id));
  symlinkSync(dist, buildLink, 'dir');
  const gameServer = await serveStatic({
    root: gamesRoot,
    headers: () => ({ 'content-security-policy': gameContentSecurityPolicy([hostServer.url]) }),
  });
  /** Where the build is served; every page of the game's frame starts with it. */
  const gameFolder = `${gameServer.url}${folderPath}`;
  writeFileSync(
    join(hostDir, 'index.html'),
    hostPage(new URL(manifest.entry, gameFolder).href, gameServer.url),
  );

  // The host page's origin, data: and blob:, and the game origin only under the game's own folder (ADR 0053).
  const mayRequest = (url: string) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return true;
    const { origin, pathname } = new URL(url);
    return origin === hostServer.url || (origin === gameServer.url && pathname.startsWith(folderPath));
  };
  const foreignRequests: string[] = [];
  const errors: string[] = [];
  const protocolErrors: string[] = [];
  const traffic = { saves: 0, scores: 0, logs: 0, requires: 0, shares: 0 };
  const ranked = {
    seeds: new Map<string, number>(),
    finished: [] as { run: string; moves: JsonValue[]; score: number }[],
  };
  // Telemetry is on, as in the hub, so every game's reporting is exercised and held to its budget (ADR 0015).
  const telemetry: { events: number; bytes: number }[] = [];
  const started = Date.now();
  let browser: Browser | undefined;
  const screenshots: string[] = [];
  // The game starts in its first declared theme; a settings change to the other one must not break it.
  const startTheme: Theme = manifest.themes[0] ?? 'light';
  const otherTheme: Theme = startTheme === 'light' ? 'dark' : 'light';
  /** Whether a shell game says its menu (the title screen or the panel over play) is up: its last `menu` message. */
  let menuOpen = false;

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
      if (mayRequest(url)) return route.continue();
      foreignRequests.push(url);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));
    page.on('crash', () => errors.push('the page crashed'));

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
        profile: { id: 'conformance', name: 'Tester', kind: 'device' },
        locale: 'vi',
        settings: { muted: true, theme: startTheme },
        save: null,
        seed: 20261013,
        telemetry: true,
        shell: shellOf(manifest),
        can: canOf(manifest),
      }),
      // Under random input the hub's sheets are refused, and the game plays on (ADR 0045).
      onIdentityRequire: () => {
        traffic.requires++;
        throw new Error('declined');
      },
      onShare: () => {
        traffic.shares++;
        throw new Error('cancelled');
      },
      onSave: () => void traffic.saves++,
      onScore: () => void traffic.scores++,
      // Ranked runs as the API deals them: a seed of the hub's own, and the moves handed back to replay.
      onRankedStart: manifest.ranked
        ? () => {
            const run = { run: `conformance-${ranked.seeds.size + 1}`, seed: 20261018 + ranked.seeds.size };
            ranked.seeds.set(run.run, run.seed);
            return run;
          }
        : undefined,
      onRankedFinish: (finish) => void ranked.finished.push(finish),
      onLog: () => void traffic.logs++,
      onTelemetry: (events) =>
        void telemetry.push({ events: events.length, bytes: JSON.stringify(events).length }),
      onMenu: (open) => {
        menuOpen = open;
      },
      onProtocolError: (error) => protocolErrors.push(error),
    });

    await page.goto(hostServer.url);
    const handshake = await host.ready.then(
      () => null,
      (error: Error) => error.message,
    );
    check('handshake: ready -> init within 10 s', handshake === null, handshake ?? undefined);

    if (handshake === null) {
      const frame = await gameFrame(page, gameFolder);
      // A shell game opens on its title screen: play first (and through the first-time how-to), so the random input
      // reaches the game itself.
      if (hasShell(manifest)) await playFromTitle(frame);
      await monkey(page, frame, options.monkeyMs ?? 4000, host, otherTheme);
      const alive = await frame
        .evaluate(() => document.readyState)
        .then(
          () => true,
          () => false,
        );
      check('survives random input, pause/resume and settings', alive);
      if (manifest.ranked) {
        check('asks for a ranked run when a game starts', ranked.seeds.size > 0, `${ranked.seeds.size} runs`);
        // A run the game played and handed in replays, with its own verify module, to the score it claimed.
        if (ranked.finished.length > 0) {
          const verify = await loadVerify(dist, manifest.ranked);
          const wrong = ranked.finished.flatMap((finish) => {
            const seed = ranked.seeds.get(finish.run);
            if (seed === undefined) return [`${finish.run}: a run the hub never opened`];
            try {
              const { score } = replayRanked(verify, { seed, moves: finish.moves });
              return score === finish.score
                ? []
                : [`${finish.run}: the game said ${finish.score}, the replay ${score}`];
            } catch (error) {
              return [`${finish.run}: ${(error as Error).message}`];
            }
          });
          check(
            'a ranked run it played replays to the score it handed in',
            wrong.length === 0,
            wrong.join('\n') || `${ranked.finished.length} runs`,
          );
        }
      }
      const outDir = resolve(options.outDir ?? 'test-results/conformance');
      mkdirSync(outDir, { recursive: true });
      const shot = (name: string) => {
        const path = join(outDir, `${name}.png`);
        screenshots.push(path);
        return page.screenshot({ path });
      };
      await shot(manifest.id);

      // Every declared theme: a screenshot to look at, and WCAG AA contrast for the game's text (axe-core; text
      // drawn on a canvas is not visible to it). Paused, so two screenshots differ only by theme.
      host.pause();
      const looks: Buffer[] = [];
      for (const theme of manifest.themes) {
        host.setSettings({ muted: true, theme });
        await page.waitForTimeout(500);
        looks.push(await shot(`${manifest.id}-${theme}`));
        const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const low = violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary}`),
        );
        check(`text contrast meets WCAG AA (${theme})`, low.length === 0, low.slice(0, 5).join('\n'));
      }
      const [first, second] = looks;
      if (first && second) {
        check(
          'looks different in light and dark',
          !first.equals(second),
          first.equals(second)
            ? 'game.json declares both themes, but the game ignores settings.theme'
            : undefined,
        );
      }
      host.resume();

      // Every orientation the game declares beyond an upright phone: the play stage at that size (ADR 0050).
      const sizes = PLAY_VIEWPORTS[manifest.orientation];
      if (sizes.length > 0) {
        const playing = await backToPlay(frame, host, () => menuOpen);
        for (const { label, size } of sizes) {
          const result = await playsAt(page, frame, size, {
            errors,
            protocolErrors,
            playing,
            screenshot: join(outDir, `${manifest.id}-play-${sizeName(size)}.png`),
          });
          if (result.screenshot) screenshots.push(result.screenshot);
          check(
            `plays ${label} (${size.width}×${size.height})`,
            result.problems.length === 0,
            result.problems.join('\n'),
          );
        }
      }
    }
    host.dispose();
    await page.close();

    if (hasShell(manifest) && handshake === null) {
      for (const result of await shellRun({
        context,
        manifest,
        hostUrl: hostServer.url,
        gameUrl: gameFolder,
        errors,
        protocolErrors,
        screenshot: join(resolve(options.outDir ?? 'test-results/conformance'), `${manifest.id}-shell.png`),
      }).catch((error: Error) => [{ name: 'game shell runs', ok: false, detail: error.message }])) {
        check(result.name, result.ok, result.detail);
      }
    }

    if (manifest.rooms && handshake === null) {
      const outDir = resolve(options.outDir ?? 'test-results/conformance');
      const room = await roomRun({
        context,
        manifest,
        dist,
        hostUrl: hostServer.url,
        gameUrl: gameFolder,
        errors,
        protocolErrors,
        monkeyMs: options.monkeyMs ?? 4000,
        screenshot: join(outDir, `${manifest.id}-room.png`),
      }).catch((error: Error) => ({ ok: false, detail: error.message }));
      check('plays at a table, refereed by its rules module', room.ok, room.detail);
      if (room.ok) screenshots.push(join(outDir, `${manifest.id}-room.png`));
      const replayed = await replayRun({
        context,
        manifest,
        dist,
        hostUrl: hostServer.url,
        gameUrl: gameFolder,
        errors,
        protocolErrors,
        screenshot: join(outDir, `${manifest.id}-replay.png`),
      }).catch((error: Error) => ({ ok: false, detail: error.message }));
      check('replays a finished hand with its rules module', replayed.ok, replayed.detail);
      if (replayed.ok) screenshots.push(join(outDir, `${manifest.id}-replay.png`));
    }

    if (handshake === null) {
      for (const result of await entryChecks({
        context,
        manifest,
        hostUrl: hostServer.url,
        gameUrl: gameFolder,
        errors,
        protocolErrors,
        samples: samples?.ok ? samples.payloads : [],
        screenshot: join(resolve(options.outDir ?? 'test-results/conformance'), `${manifest.id}-entry.png`),
      }).catch((error: Error) => [{ name: 'opens entries', ok: false, detail: error.message }])) {
        check(result.name, result.ok, result.detail);
      }
    }

    if (manifest.ranked && handshake === null) {
      const outDir = resolve(options.outDir ?? 'test-results/conformance');
      const watched = await rankedReplayRun({
        context,
        manifest,
        dist,
        hostUrl: hostServer.url,
        gameUrl: gameFolder,
        errors,
        protocolErrors,
        screenshot: join(outDir, `${manifest.id}-ranked-replay.png`),
      }).catch((error: Error) => ({ ok: false, detail: error.message }));
      check('plays a ranked run back to watch, and records nothing', watched.ok, watched.detail);
      if (watched.ok) screenshots.push(join(outDir, `${manifest.id}-ranked-replay.png`));
    }

    check('no console errors or uncaught exceptions', errors.length === 0, errors.slice(0, 5).join('\n'));
    check(
      "no requests outside the game's folder",
      foreignRequests.length === 0,
      foreignRequests.slice(0, 5).join('\n'),
    );
    check('no protocol errors', protocolErrors.length === 0, protocolErrors.slice(0, 5).join('\n'));
    // One message a minute, plus one per pause or hide (the run pauses a few times); each one small.
    const allowed = Math.ceil((Date.now() - started) / 60_000) + 6;
    const largest = Math.max(0, ...telemetry.map((m) => m.bytes));
    check(
      'telemetry stays within its budget',
      telemetry.length <= allowed && largest <= TELEMETRY_MESSAGE_BYTES,
      `${telemetry.length} messages (at most ${allowed}), largest ${largest} bytes (at most ${TELEMETRY_MESSAGE_BYTES})`,
    );
    checks.push({
      name: 'traffic (informational)',
      ok: true,
      detail: `${traffic.saves} saves, ${traffic.scores} scores, ${traffic.logs} logs, ${traffic.requires} identity requests, ${traffic.shares} shares, ${telemetry.length} telemetry messages (${telemetry.reduce((sum, m) => sum + m.events, 0)} events)`,
    });
  } finally {
    await browser?.close();
    await gameServer.close();
    await hostServer.close();
    // The link first: removing the folder must never reach the build it points to.
    unlinkSync(buildLink);
    rmSync(gamesRoot, { recursive: true, force: true });
  }
  return done(manifest.id, screenshots);
}

/**
 * The game opened at a two-seat table, as the hub opens it online: Node referees with the game's own rules module,
 * a bot holds the other seat, and random taps play the game's seat. Its actions go through `room.act`.
 */
async function roomRun(run: {
  context: BrowserContext;
  manifest: GameManifest;
  dist: string;
  hostUrl: string;
  gameUrl: string;
  errors: string[];
  protocolErrors: string[];
  monkeyMs: number;
  screenshot: string;
}): Promise<{ ok: boolean; detail: string }> {
  const rooms = run.manifest.rooms;
  if (!rooms) return { ok: false, detail: 'no rooms block' };
  const rules = await loadRules(run.dist, rooms);
  const options = defaultOptions(rooms);
  const level = rooms.bots[0] ?? null;
  const page = await run.context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') run.errors.push(`console (room): ${message.text()}`);
  });
  page.on('pageerror', (error) => run.errors.push(`uncaught (room): ${error.message}`));
  page.on('crash', () => run.errors.push('the page crashed (room)'));
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
  let state = pure(() => rules.setup({ seats: 2, seed: 7, options, carry: null }));
  let seq = 0;
  let accepted = 0;
  let refused = 0;
  let hands = 1;
  const seats = [
    { profile: { id: 'conformance', name: 'Tester' }, bot: null, connected: true },
    { profile: null, bot: level, connected: true },
  ];
  const push = (events: unknown[]) =>
    host.roomView({
      view: pure(() => rules.view(state, 0)) as JsonValue,
      events: events as JsonValue[],
      seq: ++seq,
      turnMs: 20_000,
    });
  // The bot plays until it is the game's turn again or the hand is over.
  const advance = () => {
    for (let i = 0; i < 300; i++) {
      const status = pure(() => rules.status(state));
      if (status.over || status.turn[0] === 0) return;
      const seat = status.turn[0] as number;
      const action = pure(
        () => (level ? rules.bot(state, seat, level, seq) : null) ?? rules.timeout(state, seat),
      );
      const result = pure(() => rules.act(state, seat, action));
      if (!result.ok) throw new Error(`the bot's action was refused: ${result.error}`);
      state = result.state;
      push(result.events);
    }
  };
  const host = createHost({
    transport,
    manifest: run.manifest,
    readyTimeoutMs: 10_000,
    init: () => ({
      profile: { id: 'conformance', name: 'Tester' },
      locale: 'vi',
      settings: { muted: true, theme: run.manifest.themes[0] ?? 'light' },
      save: null,
      seed: 20261016,
      room: { id: 'conformance-room', seat: 0, seats, options: options as Record<string, JsonValue> },
    }),
    onRoomAct: (action) => {
      const result = pure(() => rules.act(state, 0, action));
      if (!result.ok) {
        refused++;
        throw new Error(result.error);
      }
      accepted++;
      state = result.state;
      push(result.events);
      setTimeout(advance, 30);
    },
    onRoomNext: () => {
      const status = pure(() => rules.status(state));
      if (!status.over) return;
      hands++;
      state = pure(() => rules.setup({ seats: 2, seed: 7 + hands, options, carry: status.carry ?? null }));
      push([]);
      setTimeout(advance, 30);
    },
    onProtocolError: (error) => run.protocolErrors.push(`room: ${error}`),
  });
  try {
    await page.goto(run.hostUrl);
    await host.ready;
    push([]);
    advance();
    const frame = await gameFrame(page, run.gameUrl);
    await monkey(
      page,
      frame,
      run.monkeyMs,
      host,
      run.manifest.themes[1] ?? run.manifest.themes[0] ?? 'light',
    );
    mkdirSync(resolve(run.screenshot, '..'), { recursive: true });
    await page.screenshot({ path: run.screenshot });
    // Random taps do not always reach a play (a menu may stay open): the counts are informational; what fails the
    // check is a crash, a console error or a protocol error at the table.
    return { ok: true, detail: `${accepted} actions accepted, ${refused} refused, ${hands} hands` };
  } finally {
    host.dispose();
    await page.close();
  }
}

const hasShell = (manifest: GameManifest) => manifest.capabilities.includes('shell');

/** What a hub answers for a player playing alone (ADR 0045): identity requests, and shares for a game with entries. */
const canOf = (manifest: GameManifest) => ({
  require: true,
  share: (manifest.entries ?? []).length > 0,
});

/** `entries/share.json`: one to five payloads, each at most 2 KB as UTF-8 JSON (ADR 0045). */
function readSamples(dist: string): { ok: boolean; detail?: string; payloads: JsonValue[] } {
  const path = join(dist, entrySamplesPath('share'));
  if (!existsSync(path)) return { ok: false, detail: `missing ${path} (put it in public/)`, payloads: [] };
  let payloads: unknown;
  try {
    payloads = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { ok: false, detail: `not JSON: ${(error as Error).message}`, payloads: [] };
  }
  if (
    !Array.isArray(payloads) ||
    payloads.length < ENTRY_SAMPLES.min ||
    payloads.length > ENTRY_SAMPLES.max
  ) {
    return {
      ok: false,
      detail: `an array of ${ENTRY_SAMPLES.min} to ${ENTRY_SAMPLES.max} payloads`,
      payloads: [],
    };
  }
  const big = payloads.findIndex((payload) => jsonBytes(payload) > MAX_ENTRY_PAYLOAD_BYTES);
  return big >= 0
    ? { ok: false, detail: `payload ${big} is over ${MAX_ENTRY_PAYLOAD_BYTES} bytes`, payloads: [] }
    : { ok: true, detail: `${payloads.length} payloads`, payloads: payloads as JsonValue[] };
}

/** Payloads anyone could put in a share link through the API: the game must refuse them calmly. */
function hostilePayloads(): { label: string; payload: JsonValue }[] {
  let deep: JsonValue = 0;
  for (let depth = 0; depth < 600; depth++) deep = [deep];
  const filler = 'x'.repeat(MAX_ENTRY_PAYLOAD_BYTES - 40);
  return [
    { label: 'null', payload: null },
    { label: 'a string', payload: 'Thách bạn!' },
    { label: 'wrong types', payload: { v: '1', seed: 'abc', score: [1, 2], from: { name: 7 } } },
    { label: 'deep nesting', payload: deep },
    { label: 'close to 2 KB', payload: { v: 1, seed: 1, score: 1, pad: filler } },
  ];
}

/** How long a game has to answer an entry (ADR 0045). */
const ENTRY_ANSWER_MS = 3000;

/**
 * Entries (ADR 0045): every game, opened with a share entry it does not declare — as an older build may be — shows its
 * title screen. A game that declares `entries` opens play for each payload it ships, answering `handled` within 3 s,
 * and refuses hostile ones with `invalid` or `unsupported` within 3 s, showing its title screen. No errors anywhere.
 */
async function entryChecks(run: {
  context: BrowserContext;
  manifest: GameManifest;
  hostUrl: string;
  gameUrl: string;
  errors: string[];
  protocolErrors: string[];
  samples: JsonValue[];
  /** The game opened by its first payload, to look at. */
  screenshot: string;
}): Promise<Check[]> {
  const shell = hasShell(run.manifest);
  const declares = run.manifest.entries?.includes('share') ?? false;
  const checks: Check[] = [];
  if (!declares) {
    const opened = await openWithEntry(run, { v: 1, conformance: true });
    checks.push({
      name: 'entries: opened with a share entry it does not take, it shows its title screen',
      ok: shell ? opened.answer === 'unsupported' && opened.title : true,
      detail: describeOpening(opened),
    });
    return checks;
  }
  const handled = [];
  for (const [index, payload] of run.samples.entries()) {
    const opened = await openWithEntry(run, payload, index === 0 ? run.screenshot : undefined);
    handled.push(
      opened.answer === 'handled' && opened.answeredMs <= ENTRY_ANSWER_MS && (!shell || opened.playing)
        ? null
        : `payload ${index}: ${describeOpening(opened)}`,
    );
  }
  const wrong = handled.filter(Boolean);
  checks.push({
    name: `entries: opens play for each payload of ${entrySamplesPath('share')}, answering handled within 3 s`,
    ok: run.samples.length > 0 && wrong.length === 0,
    detail: wrong.join('\n') || `${run.samples.length} payloads`,
  });
  const refused = [];
  for (const { label, payload } of hostilePayloads()) {
    const opened = await openWithEntry(run, payload);
    const answered =
      (opened.answer === 'invalid' || opened.answer === 'unsupported') &&
      opened.answeredMs <= ENTRY_ANSWER_MS;
    refused.push(answered && (!shell || opened.title) ? null : `${label}: ${describeOpening(opened)}`);
  }
  const unsafe = refused.filter(Boolean);
  checks.push({
    name: 'entries: refuses hostile payloads within 3 s and shows its title screen',
    ok: unsafe.length === 0,
    detail: unsafe.join('\n') || undefined,
  });
  return checks;
}

interface Opening {
  answer: EntryResult | null;
  answeredMs: number;
  /** The title screen showed. */
  title: boolean;
  /** Play opened, with no title screen over it. */
  playing: boolean;
}

const describeOpening = (opened: Opening) =>
  `answered ${opened.answer ?? 'nothing'}${opened.answer ? ` in ${opened.answeredMs} ms` : ''}, ${
    opened.playing
      ? 'playing'
      : opened.title
        ? 'on its title screen'
        : 'neither playing nor on its title screen'
  }`;

/** The game opened in a fresh session with a share entry carrying `payload`, as the hub opens it from a link. */
async function openWithEntry(
  run: {
    context: BrowserContext;
    manifest: GameManifest;
    hostUrl: string;
    gameUrl: string;
    errors: string[];
    protocolErrors: string[];
  },
  payload: JsonValue,
  screenshot?: string,
): Promise<Opening> {
  const page = await run.context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') run.errors.push(`console (entry): ${message.text()}`);
  });
  page.on('pageerror', (error) => run.errors.push(`uncaught (entry): ${error.message}`));
  page.on('crash', () => run.errors.push('the page crashed (entry)'));
  const listeners = new Set<(message: unknown) => void>();
  await page.exposeFunction('__toNode', (message: unknown) => {
    for (const listener of listeners) listener(message);
  });
  const menus: boolean[] = [];
  let answer: EntryResult | null = null;
  let answeredAt = 0;
  let initAt = 0;
  // The fake hub sends the entry whatever the build declares, as an older build could be opened by a newer link. As
  // JSON text: Playwright does not carry a deeply nested argument, and postMessage does.
  const host = createHost({
    transport: {
      post: (message) =>
        void page
          .evaluate((m) => (window as unknown as Bridge).__toGame(JSON.parse(m)), JSON.stringify(message))
          .catch(() => {}),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    manifest: { ...run.manifest, entries: ['share'] },
    readyTimeoutMs: 10_000,
    init: () => {
      initAt = Date.now();
      return {
        profile: { id: 'conformance', name: 'Tester', kind: 'device' },
        locale: 'vi',
        settings: { muted: true, theme: run.manifest.themes[0] ?? 'light' },
        save: null,
        seed: 20261016,
        shell: shellOf(run.manifest),
        entry: {
          kind: 'share',
          payload,
          version: run.manifest.version,
          from: { name: 'Bạn của Tester', avatar: '🐱' },
        },
        can: canOf(run.manifest),
      };
    },
    onEntry: (result) => {
      answer = result;
      answeredAt = Date.now();
    },
    onMenu: (open) => void menus.push(open),
    onIdentityRequire: () => {
      throw new Error('declined');
    },
    onShare: () => {
      throw new Error('cancelled');
    },
    onProtocolError: (error) => run.protocolErrors.push(`entry: ${error}`),
  });
  try {
    await page.goto(run.hostUrl);
    await host.ready;
    await until(() => answer !== null, ENTRY_ANSWER_MS + 500);
    const frame = await gameFrame(page, run.gameUrl);
    const shown = (selector: string, timeout: number) =>
      frame
        .locator(selector)
        .first()
        .waitFor({ state: 'visible', timeout })
        .then(
          () => true,
          () => false,
        );
    let playing = false;
    let title = false;
    if (answer === 'handled') {
      // A first-time how-to may come first (ADR 0019) — never the title screen, whose way out it would show.
      const howTo =
        !(await until(() => menus.includes(false), 1500)) &&
        (await frame
          .locator('[data-tohe-exit]:visible')
          .count()
          .catch(() => -1)) === 0 &&
        (await frame
          .locator('[data-tohe-play]:visible')
          .count()
          .catch(() => 0)) > 0;
      if (howTo) await press(frame, '[data-tohe-play]:visible');
      // Play opened: the shell reports a closed menu once the board is up, and no title screen shows over it.
      playing =
        (await until(() => menus.includes(false), FIRST_SCREEN_MS)) &&
        (await frame
          .locator('[data-tohe-play]:visible')
          .count()
          .catch(() => -1)) === 0;
    } else {
      title = await shown('[data-tohe-play]', 5000);
    }
    await page.waitForTimeout(300);
    if (screenshot) {
      mkdirSync(resolve(screenshot, '..'), { recursive: true });
      await page.screenshot({ path: screenshot }).catch(() => {});
    }
    const settled = answer as EntryResult | null;
    return { answer: settled, answeredMs: settled ? answeredAt - initAt : -1, title, playing };
  } finally {
    host.dispose();
    await page.close();
  }
}

/** What a hub would offer this game's player (ADR 0018): everything the game has, so every entry shows. */
const shellOf = (manifest: GameManifest) =>
  hasShell(manifest)
    ? { leaderboard: manifest.capabilities.includes('scores'), rooms: manifest.rooms !== undefined }
    : undefined;

/** How long a shell game may take from the handshake to its first screen; the hub's loading screen waits as long. */
const FIRST_SCREEN_MS = 8000;

/**
 * The game shell (ADR 0018–0020), in a fresh session: the game reports its first screen (its first `menu`) soon after
 * the handshake and opens on its title screen — a stage of its own, nothing drawn under it — with a way back to Tò He
 * (`data-tohe-exit`); it plays from there (`data-tohe-play`, through the first-time how-to), answers the hub's `menu`
 * (Back) by opening its in-game menu within 1.5 s and closing it on the next Back, opens it when the hub hides the
 * game (`pause`), shows no way out to Tò He over play, leads from it to the title screen (`data-tohe-main-menu`)
 * leaving no board behind, and the title screen's way out sends `exit`.
 */
async function shellRun(run: {
  context: BrowserContext;
  manifest: GameManifest;
  hostUrl: string;
  gameUrl: string;
  errors: string[];
  protocolErrors: string[];
  /** The game's menu after Back, to look at. */
  screenshot: string;
}): Promise<Check[]> {
  const page = await run.context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') run.errors.push(`console (shell): ${message.text()}`);
  });
  page.on('pageerror', (error) => run.errors.push(`uncaught (shell): ${error.message}`));
  page.on('crash', () => run.errors.push('the page crashed (shell)'));
  const listeners = new Set<(message: unknown) => void>();
  await page.exposeFunction('__toNode', (message: unknown) => {
    for (const listener of listeners) listener(message);
  });
  const menus: boolean[] = [];
  let exits = 0;
  const host = createHost({
    transport: {
      post: (message) =>
        void page.evaluate((m) => (window as unknown as Bridge).__toGame(m), message).catch(() => {}),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    manifest: run.manifest,
    readyTimeoutMs: 10_000,
    init: () => ({
      profile: { id: 'conformance', name: 'Tester' },
      locale: 'vi',
      settings: { muted: true, theme: run.manifest.themes[0] ?? 'light' },
      save: null,
      seed: 20261016,
      shell: shellOf(run.manifest),
    }),
    onMenu: (open) => void menus.push(open),
    onExit: () => void exits++,
    onProtocolError: (error) => run.protocolErrors.push(`shell: ${error}`),
  });
  const visible = (frame: Frame, selector: string) =>
    frame
      .locator(selector)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(
        () => true,
        () => false,
      );
  const checks: Check[] = [];
  try {
    await page.goto(run.hostUrl);
    await host.ready;
    const handshaken = Date.now();
    const firstScreen = await until(() => menus.length > 0, FIRST_SCREEN_MS);
    checks.push({
      name: `shell: shows its first screen (reports it) within ${FIRST_SCREEN_MS / 1000} s of the handshake`,
      ok: firstScreen,
      detail: firstScreen
        ? `${Date.now() - handshaken} ms`
        : 'no menu message: the hub would keep its loading screen up',
    });
    const frame = await gameFrame(page, run.gameUrl);
    const opens = (await visible(frame, '[data-tohe-play]')) && (await visible(frame, '[data-tohe-exit]'));
    mkdirSync(resolve(run.screenshot, '..'), { recursive: true });
    await page.screenshot({ path: run.screenshot.replace(/\.png$/, '-title.png') }).catch(() => {});
    checks.push({ name: 'shell: opens on its title screen, with play and the way back to Tò He', ok: opens });
    const glyphs = opens ? await glyphControls(frame) : [];
    if (opens) {
      const reach = await titleReach(
        page,
        frame,
        run.screenshot.replace(/-shell\.png$/, '-title-{size}.png'),
      );
      checks.push({
        name: `shell: the title screen keeps play, its tools and the way back in sight on ${TITLE_VIEWPORTS.map(sizeName).join(', ')}`,
        ok: reach.length === 0,
        detail: reach.length === 0 ? undefined : reach.join('; '),
      });
    }
    const canvases = () => frame.evaluate(() => document.querySelectorAll('canvas').length).catch(() => -1);
    const underTitle = await canvases();
    checks.push({
      name: 'shell: the title screen is a stage of its own (no board drawn under it, ADR 0020)',
      ok: underTitle === 0,
      detail: underTitle === 0 ? undefined : `${underTitle} canvas element(s) before play`,
    });
    const played = await playFromTitle(frame);
    await page.waitForTimeout(1500);
    let before = menus.length;
    host.menu();
    const answered = await until(() => menus.slice(before).includes(true), 1500);
    await page.screenshot({ path: run.screenshot }).catch(() => {});
    checks.push({
      name: 'shell: answers Back with its menu within 1.5 s',
      ok: answered,
      detail: answered
        ? undefined
        : `${played}; menu states after Back: ${JSON.stringify(menus.slice(before))}, exits: ${exits}`,
    });
    if (answered) glyphs.push(...(await glyphControls(frame)));
    checks.push({
      name: 'shell: its title screen and menu draw their controls with icons and words, no emoji (ADR 0049)',
      ok: opens && glyphs.length === 0,
      detail: glyphs.length === 0 ? undefined : glyphs.map((text) => JSON.stringify(text)).join(', '),
    });
    before = menus.length;
    host.menu();
    const closed = await until(() => menus.slice(before).includes(false), 1500);
    checks.push({ name: 'shell: Back again closes its menu (play goes on)', ok: closed });
    before = menus.length;
    host.pause();
    const paused = await until(() => menus.slice(before).includes(true), 1500);
    host.resume();
    const exitInPlay = await frame
      .locator('[data-tohe-exit]:visible')
      .count()
      .catch(() => -1);
    checks.push({
      name: 'shell: its in-game menu has no way out to Tò He (that is the title screen’s)',
      ok: exitInPlay === 0,
      detail: exitInPlay === 0 ? undefined : `${exitInPlay} visible [data-tohe-exit] over play`,
    });
    checks.push({
      name: 'shell: opens its menu when the hub hides the game (pause)',
      ok: paused,
      detail: paused ? undefined : `menu states after pause: ${JSON.stringify(menus.slice(before))}`,
    });
    const toMenu =
      (await visible(frame, '[data-tohe-main-menu]')) &&
      (await press(frame, '[data-tohe-main-menu]:visible')) === 'pressed' &&
      (await visible(frame, '[data-tohe-play]'));
    await page.waitForTimeout(500);
    const leftBehind = await canvases();
    checks.push({
      name: 'shell: its menu leads to the title screen, and the play stage is gone (no board left)',
      ok: toMenu && leftBehind === 0,
      detail: !toMenu
        ? 'no [data-tohe-main-menu] leading to the title screen'
        : leftBehind === 0
          ? undefined
          : `${leftBehind} canvas element(s) after leaving play`,
    });
    const out =
      (await visible(frame, '[data-tohe-exit]')) &&
      (await press(frame, '[data-tohe-exit]:visible')) === 'pressed' &&
      (await until(() => exits > 0, 1000));
    checks.push({ name: 'shell: the title screen leads back to Tò He (exit)', ok: out });
    return checks;
  } finally {
    host.dispose();
    await page.close();
  }
}

/**
 * The screens a title screen must fit without scrolling (ADR 0046): a phone held upright and sideways, from the
 * smallest still in use (320x568, 568x320) to a long Android one (915x412).
 */
const TITLE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
  { width: 915, height: 412 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
];
const sizeName = (size: { width: number; height: number }) => `${size.width}x${size.height}`;

/**
 * The words of the kit's controls on screen — the buttons of the menu stage and of the panel over play, and the HUD's
 * Menu button — that hold an emoji or a character drawn as a control's picture (an arrow, ☰, a tick): those are SVG
 * icons beside words (ADR 0049, docs/conventions/voice-and-look.md). Both the visible text and the accessible name.
 */
async function glyphControls(frame: Frame): Promise<string[]> {
  return frame
    .evaluate(() => {
      const glyph = /\p{Extended_Pictographic}|[←→▶◀☰›✓⏸]/u;
      const found: string[] = [];
      const controls = document.querySelectorAll<HTMLElement>(
        '.tohe-overlay:not([hidden]) button, [data-tohe-menu]',
      );
      for (const control of controls) {
        for (const text of [control.textContent ?? '', control.getAttribute('aria-label') ?? '']) {
          if (glyph.test(text)) found.push(text.trim());
        }
      }
      return found;
    })
    .catch((error: unknown) => [`could not read the controls: ${String(error)}`]);
}

/**
 * Resizes the page to each of TITLE_VIEWPORTS and asks whether play (`data-tohe-play`), the way back to Tò He
 * (`data-tohe-exit`) and every tool of the title screen lie wholly inside it — scrolling the card is the last resort,
 * not the plan. Writes a screenshot per size (`{size}` in `screenshot`), puts the page back, and returns what was out
 * of reach, one line per size.
 */
async function titleReach(page: Page, frame: Frame, screenshot: string): Promise<string[]> {
  const original = page.viewportSize();
  const lines: string[] = [];
  for (const size of TITLE_VIEWPORTS) {
    await page.setViewportSize(size);
    let outside: string[] = [];
    // The screen's entrance animation (a few hundred ms) and the resize settle first.
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.waitForTimeout(attempt === 0 ? 700 : 250);
      outside = await frame
        .evaluate(() => {
          const out: string[] = [];
          const nodes = document.querySelectorAll('[data-tohe-play], [data-tohe-exit], .tohe-tool');
          for (const node of nodes) {
            const box = node.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;
            const inside =
              box.top >= -0.5 &&
              box.left >= -0.5 &&
              box.bottom <= window.innerHeight + 0.5 &&
              box.right <= window.innerWidth + 0.5;
            if (!inside) {
              const name = (node.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
              out.push(
                `"${name}" at ${Math.round(box.top)}-${Math.round(box.bottom)} of ${window.innerHeight}`,
              );
            }
          }
          return out;
        })
        .catch(() => ['the page could not be read']);
      if (outside.length === 0) break;
    }
    mkdirSync(resolve(screenshot, '..'), { recursive: true });
    await page.screenshot({ path: screenshot.replace('{size}', sizeName(size)) }).catch(() => {});
    if (outside.length > 0) lines.push(`${sizeName(size)}: ${outside.join(', ')}`);
  }
  if (original) await page.setViewportSize(original);
  await page.waitForTimeout(300);
  return lines;
}

/**
 * The sizes the play stage is checked at beyond the main run's upright phone, per declared `orientation` (ADR 0050):
 * a phone held sideways for `landscape`, and also a desktop window for `any`.
 */
const PLAY_VIEWPORTS: Record<
  GameManifest['orientation'],
  { label: string; size: { width: number; height: number } }[]
> = {
  portrait: [],
  landscape: [{ label: 'sideways', size: { width: 844, height: 390 } }],
  any: [
    { label: 'sideways', size: { width: 844, height: 390 } },
    { label: 'in a desktop window', size: { width: 1280, height: 800 } },
  ],
};

/**
 * After the random input, back to the play stage: a shell game left on its title screen plays again, and one with its
 * panel open over play — or a screen or card over either — steps back with `menu`, at most four times. Returns what is
 * wrong when play could not be reached, or null.
 */
async function backToPlay(
  frame: Frame,
  host: ReturnType<typeof createHost>,
  menuOpen: () => boolean,
): Promise<string | null> {
  // The random input can leave a game deep in its menus — a screen of its title (how to play, settings), a card over
  // its panel — and Back steps out one level at a time: Back until play goes on or the title shows, whose play opens it.
  for (let step = 0; step < 4; step++) {
    if (!menuOpen()) return null;
    const onTitle = await frame
      .locator('[data-tohe-play]:visible')
      .count()
      .catch(() => 0);
    if (onTitle > 0) {
      const pressed = await playFromTitle(frame);
      if (pressed !== 'pressed') return `could not play from the title screen: ${pressed}`;
      return (await until(() => !menuOpen(), 3000)) ? null : 'the game stayed in its menu, not in play';
    }
    host.menu();
    if (await until(() => !menuOpen(), 1500)) return null;
  }
  return 'the game stayed in its menu, not in play';
}

/**
 * Resizes the page to `size`, lets the game settle, and checks the play stage there: no errors since the resize, and
 * the play area — the kit's play stage, else the largest canvas, else the page's body — fills the frame's viewport
 * within 1 px. Writes a screenshot, puts the page back, and returns what was wrong, one line each.
 */
async function playsAt(
  page: Page,
  frame: Frame,
  size: { width: number; height: number },
  run: { errors: string[]; protocolErrors: string[]; playing: string | null; screenshot: string },
): Promise<{ problems: string[]; screenshot?: string }> {
  const original = page.viewportSize();
  const errorsBefore = run.errors.length;
  const protocolBefore = run.protocolErrors.length;
  await page.setViewportSize(size);
  type Fit = {
    what: string;
    box: { x: number; y: number; width: number; height: number };
    view: { width: number; height: number };
  } | null;
  const measure = () =>
    frame
      .evaluate((): Fit => {
        const visible = (node: Element) => {
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        };
        const stage = document.querySelector('.tohe-play-stage:not([hidden])');
        const canvases = [...document.querySelectorAll('canvas')].filter(visible);
        const largest = canvases.sort((a, b) => {
          const area = (c: Element) => c.getBoundingClientRect().width * c.getBoundingClientRect().height;
          return area(b) - area(a);
        })[0];
        const [what, node] =
          stage && visible(stage)
            ? ['the play stage', stage]
            : largest
              ? ['the canvas', largest]
              : ['the page', document.body];
        const { x, y, width, height } = node.getBoundingClientRect();
        return {
          what,
          box: { x, y, width, height },
          view: { width: window.innerWidth, height: window.innerHeight },
        };
      })
      .catch((): Fit => null);
  const fills = (fit: Fit) =>
    fit !== null &&
    Math.abs(fit.box.x) <= 1 &&
    Math.abs(fit.box.y) <= 1 &&
    Math.abs(fit.box.width - fit.view.width) <= 1 &&
    Math.abs(fit.box.height - fit.view.height) <= 1;
  // The resize and the game's own relayout (a ResizeObserver, a debounce) settle first.
  let fit: Fit = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(attempt === 0 ? 700 : 250);
    fit = await measure();
    if (fills(fit)) break;
  }
  await page.waitForTimeout(300);
  mkdirSync(resolve(run.screenshot, '..'), { recursive: true });
  const shot = await page.screenshot({ path: run.screenshot }).then(
    () => run.screenshot,
    () => undefined,
  );
  const problems: string[] = [];
  if (run.playing) problems.push(run.playing);
  if (fit === null) problems.push('the page could not be read');
  else if (!fills(fit)) {
    const { box, view } = fit;
    problems.push(
      `${fit.what} is ${Math.round(box.width)}×${Math.round(box.height)} at ${Math.round(box.x)},${Math.round(box.y)} in a ${view.width}×${view.height} frame`,
    );
  }
  problems.push(...run.errors.slice(errorsBefore, errorsBefore + 5));
  problems.push(...run.protocolErrors.slice(protocolBefore, protocolBefore + 5));
  if (original) await page.setViewportSize(original);
  await page.waitForTimeout(300);
  return { problems, screenshot: shot };
}

/**
 * From the title screen into play: presses play, and again while a play button shows (the first-time how-to's).
 * Returns what happened, for a failure's detail.
 */
async function playFromTitle(frame: Frame): Promise<string> {
  let result = 'no play button';
  for (let step = 0; step < 3; step++) {
    const shown = await frame
      .locator('[data-tohe-play]:visible')
      .first()
      .waitFor({ state: 'visible', timeout: step === 0 ? 5000 : 800 })
      .then(
        () => true,
        () => false,
      );
    if (!shown) break;
    result = await press(frame, '[data-tohe-play]:visible');
    await frame.page().waitForTimeout(300);
  }
  return result;
}

/**
 * Presses a button of the game's menu with a DOM click. Visibility is checked on its own; Playwright's own click also
 * waits for the page to draw two frames, which a WebGL game drawn in software on a CI machine may not do in time.
 */
function press(frame: Frame, selector: string): Promise<string> {
  return frame
    .locator(selector)
    .first()
    .evaluate((button) => (button as HTMLElement).click(), undefined, { timeout: 5000 })
    .then(
      () => 'pressed',
      (error: Error) => `${selector} was not pressed: ${error.message.split('\n')[0]}`,
    );
}

async function until(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return condition();
}

/**
 * The game opened with `init.replay` (ADR 0016): a hand that Node played to the end with the module's own bots,
 * played back by the game for seat 0. Checks that it opens and plays back without errors.
 */
async function replayRun(run: {
  context: BrowserContext;
  manifest: GameManifest;
  dist: string;
  hostUrl: string;
  gameUrl: string;
  errors: string[];
  protocolErrors: string[];
  screenshot: string;
}): Promise<{ ok: boolean; detail: string }> {
  const rooms = run.manifest.rooms;
  if (!rooms) return { ok: false, detail: 'no rooms block' };
  const rules = await loadRules(run.dist, rooms);
  const options = defaultOptions(rooms);
  const level = rooms.bots[0] ?? null;
  const seats = rooms.seats.min;
  const seed = 11;
  let state = pure(() => rules.setup({ seats, seed, options, carry: null }));
  const actions: { seat: number; action: JsonValue }[] = [];
  for (let i = 0; i < 3000; i++) {
    const status = pure(() => rules.status(state));
    if (status.over) break;
    const seat = status.turn[0] as number;
    const action = pure(
      () => (level ? rules.bot(state, seat, level, i) : null) ?? rules.timeout(state, seat),
    );
    const result = pure(() => rules.act(state, seat, action));
    if (!result.ok) throw new Error(`a bot's action was refused: ${result.error}`);
    state = result.state;
    actions.push({ seat, action: action as JsonValue });
  }
  const page = await run.context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') run.errors.push(`console (replay): ${message.text()}`);
  });
  page.on('pageerror', (error) => run.errors.push(`uncaught (replay): ${error.message}`));
  page.on('crash', () => run.errors.push('the page crashed (replay)'));
  const listeners = new Set<(message: unknown) => void>();
  await page.exposeFunction('__toNode', (message: unknown) => {
    for (const listener of listeners) listener(message);
  });
  const host = createHost({
    transport: {
      post: (message) =>
        void page.evaluate((m) => (window as unknown as Bridge).__toGame(m), message).catch(() => {}),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    manifest: run.manifest,
    readyTimeoutMs: 10_000,
    init: () => ({
      profile: { id: 'conformance', name: 'Tester' },
      locale: 'vi',
      settings: { muted: true, theme: run.manifest.themes[0] ?? 'light' },
      save: null,
      seed: 20261016,
      replay: {
        seats: Array.from({ length: seats }, (_, s) =>
          s === 0
            ? { profile: { id: 'conformance', name: 'Tester' }, bot: null, connected: true }
            : { profile: null, bot: level, connected: true },
        ),
        seat: 0,
        seed,
        options: options as Record<string, JsonValue>,
        carry: null,
        actions,
      },
    }),
    onProtocolError: (error) => run.protocolErrors.push(`replay: ${error}`),
  });
  try {
    await page.goto(run.hostUrl);
    await host.ready;
    await gameFrame(page, run.gameUrl);
    await page.waitForTimeout(4000);
    mkdirSync(resolve(run.screenshot, '..'), { recursive: true });
    await page.screenshot({ path: run.screenshot });
    return { ok: true, detail: `${actions.length} actions` };
  } finally {
    host.dispose();
    await page.close();
  }
}

/**
 * The game opened with `init.rankedReplay` (ADR 0032): a run its verify module's bot played, to watch instead of play.
 * Checks that it opens and plays back without errors, and that watching records nothing — no save, no score, no
 * ranked run.
 */
async function rankedReplayRun(run: {
  context: BrowserContext;
  manifest: GameManifest;
  dist: string;
  hostUrl: string;
  gameUrl: string;
  errors: string[];
  protocolErrors: string[];
  screenshot: string;
}): Promise<{ ok: boolean; detail: string }> {
  const ranked = run.manifest.ranked;
  if (!ranked) return { ok: false, detail: 'no ranked block' };
  const verify = await loadVerify(run.dist, ranked);
  const seed = 20261018;
  const moves = playRanked(verify, seed, Math.min(ranked.maxMoves, 400)) as JsonValue[];
  const recorded = new Set<string>();
  const page = await run.context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') run.errors.push(`console (ranked replay): ${message.text()}`);
  });
  page.on('pageerror', (error) => run.errors.push(`uncaught (ranked replay): ${error.message}`));
  page.on('crash', () => run.errors.push('the page crashed (ranked replay)'));
  const listeners = new Set<(message: unknown) => void>();
  await page.exposeFunction('__toNode', (message: unknown) => {
    for (const listener of listeners) listener(message);
  });
  const host = createHost({
    transport: {
      post: (message) =>
        void page.evaluate((m) => (window as unknown as Bridge).__toGame(m), message).catch(() => {}),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    manifest: run.manifest,
    readyTimeoutMs: 10_000,
    init: () => ({
      profile: { id: 'conformance', name: 'Tester' },
      locale: 'vi',
      settings: { muted: true, theme: run.manifest.themes[0] ?? 'light' },
      save: null,
      seed: 20261016,
      rankedReplay: { seed, moves },
    }),
    onSave: () => void recorded.add('save'),
    onScore: () => void recorded.add('score'),
    onRankedStart: () => {
      recorded.add('ranked.start');
      throw new Error('watching a run');
    },
    onRankedFinish: () => void recorded.add('ranked.finish'),
    onProtocolError: (error) => run.protocolErrors.push(`ranked replay: ${error}`),
  });
  try {
    await page.goto(run.hostUrl);
    await host.ready;
    await gameFrame(page, run.gameUrl);
    await page.waitForTimeout(4000);
    mkdirSync(resolve(run.screenshot, '..'), { recursive: true });
    await page.screenshot({ path: run.screenshot });
    return recorded.size === 0
      ? { ok: true, detail: `${moves.length} moves` }
      : { ok: false, detail: `recorded while watching: ${[...recorded].join(', ')}` };
  } finally {
    host.dispose();
    await page.close();
  }
}

/** A telemetry message from a game stays small; the hub adds them up before sending. */
const TELEMETRY_MESSAGE_BYTES = 8 * 1024;

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

/** The game's frame: the one whose page lies under the game's folder (`<games origin>/<id>/<version>/`). */
async function gameFrame(page: Page, folder: string): Promise<Frame> {
  for (let i = 0; i < 50; i++) {
    const frame = page.frames().find((f) => f.url().startsWith(folder));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error('game frame not found');
}

/** Random taps, with a bias towards visible buttons so menus get exercised too. */
async function monkey(
  page: Page,
  frame: Frame,
  durationMs: number,
  host: ReturnType<typeof createHost>,
  otherTheme: Theme,
) {
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
    if (step === 30) host.setSettings({ muted: false, theme: otherTheme });
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
