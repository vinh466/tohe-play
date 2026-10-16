// The play stage (ADR 0020): the board, the HUD and the moves. The shell creates it when the player presses play and
// destroys it when they go back to the menu; leave() saves and stops everything start() started. Rules live in
// logic.ts, drawing in view.ts, the save in app.ts.
import {
  bump,
  choiceList,
  createHud,
  formatScore,
  formatValue,
  newRunId,
  type PlayStage,
  type StageContext,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { persist, session, sfx, store, t } from './app.ts';
import { blockValue, drop, type Exponent, newGame, type State } from './logic.ts';
import { BOARD, blockStyle, PALETTE_IDS, type PaletteId } from './palette.ts';
import { cssColor, samples } from './swatches.ts';
import { BoardScene } from './view.ts';

/** Taps closer together than this are one bouncing finger, not two drops. */
const DOUBLE_TAP_MS = 150;

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const scoreFailed = (error: unknown) => session.log('warn', `score not stored: ${String(error)}`);

  // ------------------------------------------------------------------ the game: continue, or a fresh one

  let state: State;
  let runId: string;
  if (!ctx.fresh && store.game && !store.game.over) {
    state = store.game;
    runId = store.run ?? newRunId();
  } else {
    // A game left unfinished ends here and keeps the best score it reached on the leaderboard.
    const previous = store.game;
    if (previous && !previous.over && previous.score > 0 && store.run) {
      void session.run(store.run).finish(previous.score).catch(scoreFailed);
    }
    // The next game continues the PRNG sequence, so every new game differs but stays reproducible.
    state = newGame(previous?.rng ?? session.seed, store.best);
    runId = newRunId();
  }
  // The leaderboard shows the game in progress as it grows, and its best score stays when it ends.
  let run = session.run(runId);

  const save = () => {
    store.game = state;
    store.best = Math.max(store.best, state.best);
    store.run = runId;
    return persist();
  };

  // ------------------------------------------------------------------ HUD: ☰ | score | next block | best

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  scores.setBest(store.best);
  const nextBox = document.createElement('div');
  nextBox.className = 'next';
  const nextLabel = document.createElement('span');
  nextLabel.className = 'tohe-stat-label';
  nextLabel.textContent = t.next;
  const nextBlock = document.createElement('span');
  nextBlock.className = 'mini-block';
  nextBox.append(nextLabel, nextBlock);
  hud.center.append(nextBox);

  let theme: Theme = session.settings.theme;
  /** The next block shown in the HUD, kept to repaint it when the player picks other colours. */
  let shownNext: Exponent | null = null;
  /** The next block sits in the HUD, so the current block can hover over any column without covering it. */
  function showNext(exp: Exponent | null, animate: boolean) {
    shownNext = exp;
    nextBox.classList.toggle('is-hidden', exp === null);
    if (exp === null) return;
    const style = blockStyle(exp, theme, store.palette);
    const value = formatValue(blockValue(exp));
    nextBlock.textContent = value;
    nextBlock.classList.toggle('is-long', value.length > 2);
    nextBlock.style.setProperty('--fill', cssColor(style.fill));
    nextBlock.style.setProperty('--edge', cssColor(style.edge));
    nextBlock.style.setProperty('--text', style.text);
    if (animate) bump(nextBlock);
  }
  const showScore = (score: number, animate = true) => scores.set(score, animate);

  // ------------------------------------------------------------------ the board

  let moving = false;
  /** A tap made while a move still animates, played as soon as it ends (children tap ahead); the latest wins. */
  let queued: number | null = null;
  let lastTap = Number.NEGATIVE_INFINITY;
  /** Set by leave(): moves still animating stop there. */
  let left = false;

  const kit = createGame({
    parent: stage,
    background: BOARD[theme].background,
    telemetry: session.telemetry,
    createScene: () =>
      new BoardScene(
        sfx,
        t,
        {
          onDrop: (col) => requestMove(col),
          onScore: (score) => showScore(score),
          onUpcoming: (next, animate) => showNext(next, animate),
        },
        theme,
        store.palette,
      ),
  });
  /** The current scene; replaced if the kit restarts the game with the Canvas renderer. */
  let board = kit.scene;
  kit.onResize((size) => board.relayout(size.width, size.height));
  kit.onRestart(async (scene) => {
    board = scene;
    await board.whenReady;
    board.relayout(kit.size().width, kit.size().height);
    board.setBoard(state);
    moving = false;
    queued = null;
  });

  // Light/dark follows the hub (ADR 0013): the page through the menu stage's followTheme, the board here.
  const offTheme = session.on('settings', (settings) => {
    if (settings.theme === theme) return;
    theme = settings.theme;
    board.setTheme(theme);
    kit.setBackground(BOARD[theme].background);
    showNext(shownNext, false);
  });

  function setPalette(id: PaletteId) {
    sfx.play('click');
    store.palette = id;
    board.setPalette(id);
    showNext(shownNext, false);
    void save();
  }

  function requestMove(col: number) {
    if (ctx.overlay.visible) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_TAP_MS) return;
    lastTap = now;
    if (moving) queued = col;
    else void move(col);
  }

  async function move(col: number) {
    if (moving || ctx.overlay.visible) return;
    const result = drop(state, col);
    if (!result.ok) {
      if (result.reason === 'column_full') board.reject(col);
      return;
    }
    moving = true;
    const before = state.score;
    state = result.state;
    await board.play(result.events, state, before);
    if (left) return;
    showScore(state.score);
    moving = false;
    if (!state.over && state.score > before) void run.update(state.score).catch(scoreFailed);

    if (!state.over && queued !== null) {
      const nextCol = queued;
      queued = null;
      void save();
      void move(nextCol);
      return;
    }
    queued = null;
    if (state.over) {
      const record = state.score > store.best;
      void save();
      void run.finish(state.score).catch(scoreFailed);
      ctx.gameOver({
        icon: record ? '🏆' : '🧱',
        title: record ? t.record : t.over,
        body: t.result(formatScore(state.score, session.locale), formatScore(store.best, session.locale)),
      });
    } else {
      void save();
    }
  }

  function startNewGame() {
    if (!state.over && state.score > 0) void run.finish(state.score).catch(scoreFailed);
    runId = newRunId();
    run = session.run(runId);
    state = newGame(state.rng, store.best);
    board.setBoard(state);
    scores.setBest(store.best);
    showScore(0, false);
    void save();
  }

  const onKey = (event: KeyboardEvent) => {
    if (ctx.overlay.visible) return;
    if (event.key === 'ArrowLeft') board.nudge(-1);
    else if (event.key === 'ArrowRight') board.nudge(1);
    else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) requestMove(board.aimedColumn); // holding the key down drops once
    } else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  await board.whenReady;
  board.relayout(kit.size().width, kit.size().height);
  board.setBoard(state);
  showScore(state.score, false);
  if (ctx.firstTime) board.showHint(true);
  void save();
  ctx.ready();

  return {
    pause: () => kit.pause(),
    resume: () => kit.resume(),
    newGame: () => {
      sfx.play('click');
      startNewGame();
    },
    // 🎨 Màu khối opens the presets over the panel; a tap repaints the board behind it at once.
    quick: () => [
      {
        kind: 'card',
        icon: '🎨',
        label: t.colours,
        value: t.palettes[store.palette],
        card: () => ({
          icon: '🎨',
          title: t.colours,
          content: choiceList(
            PALETTE_IDS.map((id) => ({ id, label: t.palettes[id], preview: samples(id, theme) })),
            store.palette,
            (id) => setPalette(id),
          ),
        }),
      },
    ],
    leave() {
      left = true;
      window.removeEventListener('keydown', onKey);
      offTheme();
      void save();
      kit.destroy();
    },
  };
}
