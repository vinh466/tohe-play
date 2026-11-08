// The play stage (ADR 0020): the board, the HUD, the mode select and the moves. The shell creates it when the player
// presses play and destroys it when they go back to the menu; leave() saves and stops everything start() started.
// Rules live in logic.ts, drawing in view.ts, the save and the Workshop in app.ts/workshop.ts. Opened by a challenge
// link (ADR 0045), it plays the challenge in a slot of its own — the regular game, and its ranked run, stay as they
// were — until "Về ván thường".
import {
  createHud,
  formatScore,
  formatValue,
  icon as kitIcon,
  newRunId,
  type OverlayAction,
  type PlayStage,
  type StageContext,
  shellStrings,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import {
  bankRun,
  finishRanked,
  levelFor,
  localDate,
  openDaily,
  persist,
  recordDaily,
  resumeMode,
  savedRun,
  session,
  sfx,
  shareChallenge,
  shareDaily,
  store,
  t,
  takeRanked,
} from './app.ts';
import {
  type ChallengePayload,
  type ChallengeSlot,
  isDailyPayload,
  openChallenge,
  outcome,
  readEntry,
} from './challenge.ts';
import {
  blockValue,
  choosePart,
  clockOut as clockOutRun,
  currentOrder,
  fire,
  isFull,
  isMode,
  type Mode,
  newGame,
  type PartId,
  type State,
} from './logic.ts';
import { BOARD, PALETTE_IDS, type PaletteId } from './palette.ts';
import { samples } from './swatches.ts';
import { BoardScene } from './view.ts';
import { workshopContent } from './workshop.ts';

/** Taps closer together than this are one bouncing finger, not two shots. */
const DOUBLE_TAP_MS = 150;

/** The best before a run of this mode. */
function bestOf(mode: Mode): number {
  if (mode === 'orders') return store.bests.orders;
  if (mode === 'daily') return store.bests.daily;
  if (mode === 'zen') return 0;
  return store.best;
}

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const scoreFailed = (error: unknown) => session.log('warn', `score not stored: ${String(error)}`);
  const score = (value: number) => formatScore(value, session.locale);
  const value = (exp: number) => formatValue(blockValue(exp));
  /** Small behavioural counts (D-11), once per stage: no names, no move logs. */
  const counted = new Set<string>();
  const count = (name: string) => {
    if (counted.has(name)) return;
    counted.add(name);
    session.telemetry.count(name);
  };

  // ------------------------------------------------------------------ the frame: HUD, challenge target, mode rail

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  let theme: Theme = session.settings.theme;

  const target = document.createElement('p');
  target.className = 'challenge-target';
  hud.element.after(target);

  const rail = document.createElement('div');
  rail.className = 'mode-rail';
  target.after(rail);

  // ------------------------------------------------------------------ the run in play

  let mode: Mode = 'orders';
  let state: State | null = null;
  let challenge: ChallengeSlot | null = null;
  let runId = '';
  let run: ReturnType<typeof session.run> | null = null;
  /** A finished run is banked once: its scrap, XP and best are written to the save a single time. */
  let banked = false;
  /** Whether the run that just ended set a record (its best is banked before the card is drawn). */
  let endedRecord = false;

  let moving = false;
  /** A tap made while a move still animates, played as soon as it ends (children tap ahead); the latest wins. */
  let queued: number | null = null;
  let lastTap = Number.NEGATIVE_INFINITY;
  /** Set by leave(): moves still animating stop there. */
  let left = false;

  let kit: ReturnType<typeof createGame> | null = null;
  let board: BoardScene | null = null;
  const showScore = (next: number, animate = true) => scores.set(next, animate);
  /** Opens the shell's quick panel, the only way back to the title screen from over play. */
  const openMenu = () => hud.element.querySelector<HTMLButtonElement>('.tohe-menu-button')?.click();

  const showTarget = () => {
    target.hidden = challenge === null;
    if (!challenge) {
      target.textContent = '';
      return;
    }
    target.textContent =
      challenge.mode === 'daily'
        ? t.daily.target(score(challenge.target), challenge.date ?? '')
        : t.challenge.target(score(challenge.target), challenge.from?.name ?? null);
  };

  const modeName = (id: Mode) => t.modeNames[id];

  // ------------------------------------------------------------------ saving

  const save = () => {
    if (!state) return persist();
    if (challenge) {
      challenge.game = state;
      challenge.run = runId;
      store.challenge = challenge;
    } else if (mode === 'classic') {
      store.game = state;
      store.run = runId;
    } else if (mode === 'orders') {
      store.orders = state;
    } else if (mode === 'daily') {
      recordDaily(state);
    }
    // Zen is never saved: it has no score and no next time.
    if (mode !== 'zen') store.last = mode;
    return persist();
  };

  /** Ends the live score run and the ranked run of the state being replaced (a new run of the same mode, a challenge). */
  function finishCurrentRun() {
    if (run && state && !state.over && state.score > 0) void run.finish(state.score).catch(scoreFailed);
    if (challenge) {
      challenge.game = state;
    } else if (mode === 'classic' && state && !state.over) {
      finishRanked(state.score);
      store.run = null;
    }
    run = null;
  }

  /** A fresh classic run replaces any saved classic run: hand in the live/ranked one first. */
  function finishSavedClassic() {
    const saved = store.game;
    if (!saved || saved.over) return;
    if (store.ranked) {
      finishRanked(saved.score);
    } else if (store.run) {
      void session.run(store.run).finish(saved.score).catch(scoreFailed);
    }
    store.run = null;
  }

  /**
   * Leaving a mode for another keeps that run (saved after every move); only a new run of the same mode, a challenge
   * being left, or a new classic run replacing the saved classic hands a live/ranked run in.
   */
  function prepareForNewRun(target: Mode) {
    if (challenge) finishCurrentRun();
    else if (target === mode) finishCurrentRun();
    if (target === 'classic') finishSavedClassic();
    run = null;
  }

  // ------------------------------------------------------------------ the board

  async function ensureBoard(): Promise<BoardScene> {
    if (kit && board) return board;
    kit = createGame({
      parent: stage,
      background: BOARD[theme].background,
      telemetry: session.telemetry,
      createScene: () =>
        new BoardScene(
          sfx,
          t,
          {
            onFire: (col) => requestMove(col),
            onScore: (next) => showScore(next),
          },
          theme,
          store.palette,
        ),
    });
    const scene = kit.scene as BoardScene;
    board = scene;
    kit.onResize((size) => board?.relayout(size.width, size.height));
    kit.onRestart(async (restarted) => {
      board = restarted as BoardScene;
      await board.whenReady;
      board.relayout(kit?.size().width ?? 0, kit?.size().height ?? 0);
      if (state) board.setBoard(state);
      moving = false;
      queued = null;
    });
    await scene.whenReady;
    scene.relayout(kit.size().width, kit.size().height);
    if (state) scene.setBoard(state);
    return scene;
  }

  const offTheme = session.on('settings', (settings) => {
    if (settings.theme === theme) return;
    theme = settings.theme;
    board?.setTheme(theme);
    kit?.setBackground(BOARD[theme].background);
  });

  function setPalette(id: PaletteId) {
    sfx.play('click');
    store.palette = id;
    board?.setPalette(id);
    void save();
  }

  // ------------------------------------------------------------------ the rail: the mode's own line

  function railButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-rail-button';
    button.textContent = label;
    button.addEventListener('click', () => {
      sfx.play('click');
      onClick();
    });
    return button;
  }

  function updateRail() {
    rail.replaceChildren();
    if (!state) {
      rail.hidden = true;
      return;
    }
    rail.hidden = false;
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'mode-rail-name';
    label.setAttribute('aria-label', `${t.over.changeMode}: ${modeName(mode)}`);
    label.append(modeName(mode), kitIcon('caret-right', 'tohe-svg mode-rail-caret'));
    label.addEventListener('click', () => {
      sfx.play('click');
      ctx.changeMode();
    });
    rail.append(label);

    if (mode === 'orders') {
      const order = currentOrder(state);
      const line = document.createElement('span');
      line.className = 'mode-rail-line';
      line.textContent = order ? t.orders.rail(value(order.exp), order.done, order.count) : t.orders.allDone;
      rail.append(line);
      const parts = state.parts ?? [];
      if (parts.length > 0) {
        const chips = document.createElement('span');
        chips.className = 'mode-rail-parts';
        for (const part of parts) {
          const chip = document.createElement('span');
          chip.className = 'mode-part-chip';
          chip.textContent = t.orders.part[part];
          chips.append(chip);
        }
        rail.append(chips);
      }
      if ((state.orderIndex ?? 0) >= (state.orders?.length ?? 0)) {
        rail.append(railButton(t.orders.clockOut, clockOut));
      }
    } else if (mode === 'daily') {
      const line = document.createElement('span');
      line.className = 'mode-rail-line';
      line.textContent = t.daily.tag(state.daily?.date ?? localDate(), store.daily?.streak ?? 1);
      rail.append(line);
    } else if (mode === 'zen') {
      const line = document.createElement('span');
      line.className = 'mode-rail-line';
      line.textContent = t.zen.tag;
      rail.append(line);
    } else {
      const line = document.createElement('span');
      line.className = 'mode-rail-line';
      line.textContent = challenge
        ? t.challenge.target(score(challenge.target), challenge.from?.name ?? null)
        : t.modes.classicLine;
      rail.append(line);
    }
  }

  /** Resumes the saved run of `modeChoice`; the same run already on the board just closes the screen. */
  async function resumeRun(modeChoice: Mode, saved: State) {
    if (saved === state && kit) {
      ctx.overlay.hide();
      return;
    }
    if (challenge) finishCurrentRun();
    else if (modeChoice === 'classic' && mode === 'classic') finishCurrentRun();
    run = null;
    const switching = kit !== null;
    if (!switching) ctx.overlay.hide();
    mode = modeChoice;
    challenge = null;
    banked = false;
    endedRecord = false;
    count(`mode.start.${modeChoice}`);
    if (modeChoice === 'daily') count('daily.start');
    state = saved;
    runId = modeChoice === 'classic' ? (store.ranked?.run ?? store.run ?? newRunId()) : newRunId();
    if (modeChoice === 'classic') {
      store.run = runId;
      run = session.run(runId);
    } else {
      run = null;
    }
    if (switching) {
      ctx.overlay.show({
        layout: 'loading',
        icon: { src: 'icon.svg' },
        title: shellStrings(session.locale).loading,
        actions: [],
      });
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    const current = await ensureBoard();
    if (left) return;
    current.setBoard(state);
    scores.setBest(bestOf(mode));
    showScore(state.score, false);
    showTarget();
    updateRail();
    if (ctx.firstTime) current.showHint(true);
    if (state.choice) showChoice();
    else ctx.overlay.hide();
    void save();
  }

  /** Starts a fresh run of `modeChoice` (a ranked classic run when the hub deals one). */
  async function startNewRun(modeChoice: Mode) {
    prepareForNewRun(modeChoice);
    // A mode switch happens in place: show the loading card before the board is rebuilt, so the tap has an answer.
    const switching = kit !== null;
    if (!switching) ctx.overlay.hide();
    mode = modeChoice;
    challenge = null;
    banked = false;
    count(`mode.start.${modeChoice}`);
    if (modeChoice === 'daily') count('daily.start');
    const previous = state;
    state = null;
    run = null;
    runId = '';
    if (modeChoice === 'classic') {
      const ranked = await takeRanked();
      if (left) return;
      store.ranked = ranked ? { run: ranked.run, seed: ranked.seed, moves: [] } : null;
      runId = ranked?.run ?? newRunId();
      store.run = runId;
      state = newGame(ranked?.seed ?? previous?.rng ?? session.seed, store.best);
      run = session.run(runId);
    } else if (modeChoice === 'orders') {
      runId = newRunId();
      state = newGame(store.orders?.rng ?? session.seed, 0, 'orders', {
        unlocked: store.workshop.blueprints,
      });
    } else if (modeChoice === 'daily') {
      // A fresh run of today's shift: same seed, its own board (Continue resumes the saved one).
      const daily = openDaily();
      daily.game = newGame(daily.seed, daily.best, 'daily', { dailyDate: daily.date });
      state = daily.game;
      runId = newRunId();
    } else {
      runId = newRunId();
      state = newGame(session.seed, 0, 'zen');
    }
    if (switching) {
      ctx.overlay.show({
        layout: 'loading',
        icon: { src: 'icon.svg' },
        title: shellStrings(session.locale).loading,
        actions: [],
      });
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    const current = await ensureBoard();
    if (left) return;
    current.setBoard(state);
    scores.setBest(bestOf(mode));
    showScore(state.score, false);
    showTarget();
    updateRail();
    if (ctx.firstTime) current.showHint(true);
    if (switching) ctx.overlay.hide();
    void save();
  }

  // ------------------------------------------------------------------ the Workshop over play

  function openWorkshop(back: () => void) {
    count('workshop.view');
    ctx.overlay.show({
      layout: 'screen',
      icon: 'gear-six',
      title: t.workshop.title,
      content: workshopContent({
        t,
        theme,
        palette: store.palette,
        onPalette: (id) => setPalette(id),
      }),
      actions: [{ label: shellStrings(session.locale).back, icon: 'arrow-left', onClick: back }],
    });
  }

  // ------------------------------------------------------------------ the choice sheet

  function showChoice() {
    if (!state?.choice || !state.offer?.length) return;
    const offered = state.offer;
    ctx.overlay.show({
      icon: 'gear-six',
      title: t.orders.choiceTitle,
      body: t.orders.choiceBody,
      actions: offered.map((part) => ({
        label: `${t.orders.part[part]} — ${t.orders.partLine[part]}`,
        onClick: () => pickPart(part),
      })),
    });
  }

  function pickPart(part: PartId) {
    if (!state) return;
    const chosen = choosePart(state, part);
    if (!chosen) return;
    session.telemetry.count(`part.pick.${part}`);
    state = chosen;
    sfx.play('levelUp');
    ctx.overlay.hide();
    // A tank raises the gauge's max at once; the board redraws the lamps and the rest of the state.
    board?.setBoard(state);
    showScore(state.score, false);
    updateRail();
    void save();
  }

  // ------------------------------------------------------------------ the end of a run

  function endCard() {
    if (!state) return;
    const final = state.score;
    if (challenge) return challengeOver(challenge);
    const best = bestOf(mode);
    const body = `${t.result(score(final), score(best))}${state.shipped > 0 ? ` · ${t.shipped(state.shipped)}` : ''}`;
    const actions: OverlayAction[] = [];
    if (mode === 'orders') {
      actions.push({
        label: t.over.again,
        icon: 'play' as const,
        onClick: () => void startNewRun('orders'),
      });
      actions.push({
        label: t.over.workshop,
        icon: 'gear-six' as const,
        variant: 'secondary' as const,
        onClick: () => openWorkshop(endCard),
      });
      actions.push({
        label: t.over.changeMode,
        icon: 'list' as const,
        variant: 'secondary' as const,
        onClick: () => ctx.changeMode(),
      });
    } else if (mode === 'daily') {
      actions.push({
        label: t.over.again,
        icon: 'play' as const,
        onClick: () => void startNewRun('daily'),
      });
      if (state.seed !== undefined && session.canShare) {
        const seed = state.seed;
        const date = state.daily?.date ?? localDate();
        actions.push({
          label: t.daily.share,
          icon: 'target' as const,
          variant: 'secondary' as const,
          onClick: () => shareDaily(seed, final, date),
        });
      }
      actions.push({
        label: t.over.changeMode,
        icon: 'list' as const,
        variant: 'secondary' as const,
        onClick: () => ctx.changeMode(),
      });
    } else {
      actions.push({
        label: t.over.again,
        icon: 'play' as const,
        onClick: () => void startNewRun('classic'),
      });
      if (state.seed !== undefined && session.canShare) {
        const seed = state.seed;
        actions.push({
          label: t.challenge.button,
          icon: 'target' as const,
          variant: 'secondary' as const,
          onClick: () => shareChallenge(seed, final),
        });
      }
      actions.push({
        label: t.over.workshop,
        icon: 'gear-six' as const,
        variant: 'secondary' as const,
        onClick: () => openWorkshop(endCard),
      });
      actions.push({
        label: t.over.changeMode,
        icon: 'list' as const,
        variant: 'secondary' as const,
        onClick: () => ctx.changeMode(),
      });
    }
    const title =
      mode === 'orders' ? (state.ended === 'clock_out' ? t.over.clockOut : t.over.jam) : t.over.jam;
    actions.push({
      label: t.over.menu,
      icon: 'house',
      variant: 'secondary',
      onClick: openMenu,
    });
    const ticket = mode === 'orders' ? ticketLines(state) : undefined;
    ctx.overlay.show({
      icon: endedRecord ? 'trophy' : { src: 'icon.svg' },
      title: endedRecord ? t.over.record : title,
      body: ticket ? `${body}\n${ticket}` : body,
      actions,
    });
  }

  /** The Ca làm ticket: the orders, the shipped, the scrap and the XP of the run. */
  function ticketLines(finished: State): string {
    const orders = (finished.orders ?? [])
      .map((order) => `${order.done}/${order.count} × ${value(order.exp)}`)
      .join(' · ');
    const lines = [t.orders.ticket, orders, t.orders.shipped(finished.shipped)];
    if ((finished.scrap ?? 0) > 0) lines.push(t.orders.scrap(String(finished.scrap)));
    if ((finished.xp ?? 0) > 0) lines.push(t.orders.xp(String(finished.xp)));
    return lines.join(' · ');
  }

  function challengeOver(played: ChallengeSlot) {
    if (!state) return;
    const final = state.score;
    const { beaten, short } = outcome(final, played.target);
    const name = played.from?.name ?? null;
    const body = `${t.result(score(final), score(bestOf(mode)))}${state.shipped > 0 ? ` · ${t.shipped(state.shipped)}` : ''}`;
    const daily = played.mode === 'daily';
    const date = played.date ?? localDate();
    const actions: OverlayAction[] = [
      {
        label: t.over.again,
        icon: 'play' as const,
        onClick: () => restartChallenge(),
      },
      {
        label: t.challenge.back,
        icon: 'arrow-left' as const,
        variant: 'secondary' as const,
        onClick: () => void toRegular(),
      },
    ];
    if (session.canShare) {
      actions.push({
        label: t.challenge.again,
        icon: 'target' as const,
        variant: 'secondary' as const,
        onClick: () => (daily ? shareDaily(played.seed, final, date) : shareChallenge(played.seed, final)),
      });
    }
    ctx.overlay.show({
      icon: beaten ? 'trophy' : 'target',
      title: beaten ? t.challenge.beaten(score(played.target), name) : t.challenge.short(score(short)),
      body,
      actions,
    });
  }

  /** Finishes the run once: banks its scrap/XP/best, hands in its scores and shows its card. */
  function finishRun() {
    if (!state || banked) return;
    banked = true;
    session.telemetry.count(`run.end.${mode}`);
    endedRecord = state.score > bestOf(mode);
    const before = levelFor(store.workshop.xp);
    if (!challenge) {
      bankRun(state);
      const after = levelFor(store.workshop.xp);
      if (after > before && board) {
        // The rank-up is shown on the ticket; the sound is the same as a finished order.
        sfx.play('levelUp');
      }
    }
    if (run) {
      void run.finish(state.score).catch(scoreFailed);
      run = null;
    }
    if (!challenge && mode === 'classic') finishRanked(state.score);
    void save();
    endCard();
  }

  function clockOut() {
    if (!state) return;
    const result = clockOutRun(state);
    if (!result) return;
    state = result.state;
    board?.setBoard(state);
    showScore(state.score, false);
    updateRail();
    finishRun();
  }

  // ------------------------------------------------------------------ the challenge slot

  function openEntry(entry: ChallengePayload): void {
    const best = isDailyPayload(entry) ? store.bests.daily : store.best;
    challenge = openChallenge(store.challenge, entry, ctx.entry?.from ?? null, best, newRunId);
    store.challenge = challenge;
    mode = challenge.mode;
    count(`mode.start.${mode}`);
    if (mode === 'daily') count('daily.start');
    runId = challenge.run;
    state = challenge.game;
    run = session.run(runId);
    banked = false;
  }

  async function startChallenge() {
    const current = await ensureBoard();
    if (left || !state) return;
    current.setBoard(state);
    scores.setBest(bestOf(mode));
    showScore(state.score, false);
    showTarget();
    updateRail();
    if (ctx.firstTime) current.showHint(true);
    void save();
    if (state.moves === 0 && challenge) {
      const played = challenge;
      const name = played.from?.name ?? null;
      const daily = played.mode === 'daily';
      const date = played.date ?? localDate();
      ctx.overlay.show({
        icon: 'target',
        title: daily
          ? t.daily.target(score(played.target), date)
          : t.challenge.target(score(played.target), name),
        body: daily
          ? t.daily.intro(score(played.target), date)
          : t.challenge.intro(score(played.target), name),
        actions: [
          {
            label: shellStrings(session.locale).start,
            icon: 'play',
            onClick: () => ctx.overlay.hide(),
          },
        ],
      });
    }
  }

  function restartChallenge() {
    if (!challenge) return;
    ctx.overlay.hide();
    challenge.game = newGame(
      challenge.seed,
      bestOf(mode),
      mode,
      challenge.date ? { dailyDate: challenge.date } : {},
    );
    runId = newRunId();
    challenge.run = runId;
    state = challenge.game;
    run = session.run(runId);
    banked = false;
    board?.setBoard(state);
    scores.setBest(bestOf(mode));
    showScore(0, false);
    showTarget();
    updateRail();
    void save();
  }

  /** "Về ván thường": the regular game in place — the one in progress, or a fresh classic run. */
  async function toRegular() {
    moving = true;
    ctx.overlay.hide();
    if (challenge) finishCurrentRun();
    challenge = null;
    const resumed = store.game;
    if (resumed && !resumed.over) {
      mode = 'classic';
      state = resumed;
      runId = store.run ?? newRunId();
      store.run = runId;
      run = session.run(runId);
      const current = await ensureBoard();
      if (left) return;
      current.setBoard(state);
      scores.setBest(store.best);
      showScore(state.score, false);
      showTarget();
      updateRail();
      void save();
      return;
    }
    await startNewRun('classic');
  }

  // ------------------------------------------------------------------ the moves

  function requestMove(col: number) {
    if (!state || !board || ctx.overlay.visible) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_TAP_MS) return;
    lastTap = now;
    if (moving) queued = col;
    else void move(col);
  }

  async function move(col: number) {
    if (!state || !board || moving || ctx.overlay.visible) return;
    const result = fire(state, col);
    if (!result.ok) {
      if (result.reason === 'column_full') board.reject(col);
      if (result.reason === 'choose_part') showChoice();
      return;
    }
    moving = true;
    const before = state.score;
    state = result.state;
    if (result.events.some((event) => event.type === 'land')) count('shot.first');
    if (result.events.some((event) => event.type === 'merge')) count('merge.first');
    if (result.events.some((event) => event.type === 'pulse')) count('shake.first');
    if (result.events.some((event) => event.type === 'ship')) count('ship.first');
    for (const event of result.events) {
      if (event.type === 'order' && event.complete) count(`order.done.${event.index + 1}`);
    }
    // A challenge is never ranked: the regular game's ranked run, if any, waits untouched.
    if (!challenge) store.ranked?.moves.push(col);
    await board.play(result.events, state, before);
    if (left) return;
    showScore(state.score);
    moving = false;
    if (!state.over && state.score > before && run) void run.update(state.score).catch(scoreFailed);
    updateRail();

    if (state.over) {
      queued = null;
      finishRun();
      return;
    }
    if (mode === 'zen' && isFull(state.grid)) {
      queued = null;
      zenFull();
      return;
    }
    if (state.choice) {
      queued = null;
      void save();
      showChoice();
      return;
    }
    if (queued !== null) {
      const nextCol = queued;
      queued = null;
      void save();
      void move(nextCol);
      return;
    }
    queued = null;
    void save();
  }

  /** Thư giãn never jams: a full rack offers a new run or another mode, and records nothing. */
  function zenFull() {
    ctx.overlay.show({
      icon: { src: 'icon.svg' },
      title: t.modes.zen,
      body: t.zen.full,
      actions: [
        { label: t.over.again, icon: 'play', onClick: () => void startNewRun('zen') },
        {
          label: t.zen.leave,
          icon: 'list',
          variant: 'secondary',
          onClick: () => ctx.changeMode(),
        },
      ],
    });
  }

  const onKey = (event: KeyboardEvent) => {
    if (!board || ctx.overlay.visible) return;
    // A focused control (the mode chip, the Menu button) keeps its own Enter/Space and arrows.
    if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return;
    if (event.key === 'ArrowLeft') board.nudge(-1);
    else if (event.key === 'ArrowRight') board.nudge(1);
    else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) requestMove(board.aimedColumn); // holding the key down fires once
    } else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  // ------------------------------------------------------------------ open: a challenge, a run, or the mode select

  const opened = ctx.entry ? readEntry(ctx.entry.kind, ctx.entry.payload) : null;
  if (opened?.result === 'handled') {
    openEntry(opened.challenge);
    await startChallenge();
  } else {
    const chosen = ctx.choice && isMode(ctx.choice) ? ctx.choice : null;
    const resume = !ctx.fresh ? (chosen ?? resumeMode()) : null;
    const saved = resume ? savedRun(resume) : null;
    if (resume && saved) await resumeRun(resume, saved);
    else await startNewRun(chosen ?? resume ?? 'orders');
  }

  ctx.ready();

  return {
    pause: () => kit?.pause(),
    resume: () => kit?.resume(),
    newGame: (choice?: string, fresh = true) => {
      sfx.play('click');
      const chosen = choice && isMode(choice) ? choice : mode;
      const saved = !fresh ? savedRun(chosen) : null;
      if (saved) void resumeRun(chosen, saved);
      else void startNewRun(chosen);
    },
    // Đổi chế độ and the block colours open over the panel; the game behind stays as it was.
    quick: () => [
      {
        kind: 'action',
        icon: 'cards',
        label: t.over.changeMode,
        value: t.modeNames[mode],
        onClick: () => ctx.changeMode(),
      },
      {
        kind: 'card',
        icon: 'palette',
        label: t.colours,
        value: t.palettes[store.palette],
        card: () => ({
          icon: 'palette',
          title: t.colours,
          content: paletteList(),
        }),
      },
      {
        kind: 'card',
        icon: 'gear-six',
        label: t.workshop.title,
        value: `${store.workshop.scrap} · ${t.workshop.levelName(levelFor(store.workshop.xp))}`,
        card: () => ({
          icon: 'gear-six',
          title: t.workshop.title,
          content: workshopContent({
            t,
            theme,
            palette: store.palette,
            onPalette: (id) => setPalette(id),
          }),
        }),
      },
    ],
    leave() {
      left = true;
      window.removeEventListener('keydown', onKey);
      offTheme();
      void save();
      kit?.destroy();
    },
  };

  function paletteList(): HTMLElement {
    // A tiny wrapper keeps the palette picker the same in the panel and the Workshop.
    const holder = document.createElement('div');
    const buttons = document.createElement('div');
    buttons.className = 'palette-quick';
    for (const id of PALETTE_IDS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-quick-item';
      button.dataset.selected = String(store.palette === id);
      button.append(samples(id, theme), document.createTextNode(t.palettes[id]));
      button.addEventListener('click', () => {
        setPalette(id);
        for (const item of buttons.querySelectorAll<HTMLButtonElement>('.palette-quick-item')) {
          item.dataset.selected = String(item === button);
        }
      });
      buttons.append(button);
    }
    holder.append(buttons);
    return holder;
  }
}
