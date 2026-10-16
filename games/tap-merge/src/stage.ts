// The play stage (ADR 0020): the board, the HUD, the goal and the moves. The shell creates it when the player presses
// play and destroys it when they go back to the menu; leave() saves and stops everything start() started. Rules live
// in logic.ts, drawing in view.ts, the save in app.ts.
import {
  bump,
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
import {
  type Cell,
  cellAt,
  floorOf,
  isStuck,
  matches,
  newGame,
  nextMilestone,
  type State,
  shuffle,
  tap,
} from './logic.ts';
import { BOARD, PALETTE_IDS, type PaletteId } from './palette.ts';
import { miniBlock, samples } from './swatches.ts';
import { BoardScene } from './view.ts';

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const goal = ctx.root.querySelector<HTMLElement>('#goal') as HTMLElement;
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
  /** The score passes the best score once a game; a game resumed above it has already had its moment. */
  let passedBest = store.best > 0 && state.score > store.best;

  const save = () => {
    store.game = state;
    store.best = Math.max(store.best, state.best);
    store.run = runId;
    return persist();
  };

  // ------------------------------------------------------------------ HUD: ☰ | score | 🔀 | best, then the goal

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  scores.setBest(store.best);
  const rescueBox = document.createElement('div');
  rescueBox.className = 'rescue';
  const shuffleLabel = document.createElement('span');
  shuffleLabel.className = 'tohe-stat-label';
  const shuffleButton = document.createElement('button');
  shuffleButton.type = 'button';
  shuffleButton.className = 'shuffle';
  shuffleButton.disabled = true;
  const shuffleIcon = document.createElement('span');
  shuffleIcon.setAttribute('aria-hidden', 'true');
  shuffleIcon.textContent = '🔀';
  const shuffleCount = document.createElement('span');
  shuffleButton.append(shuffleIcon, shuffleCount);
  rescueBox.append(shuffleLabel, shuffleButton);
  hud.center.append(rescueBox);

  let theme: Theme = session.settings.theme;
  const showScore = (score: number, animate = true) => scores.set(score, animate);

  /**
   * 🎯 The next milestone and the value it retires: "Mục tiêu [4K] tạm biệt [2]". It lights up when one more new
   * largest block reaches it, and pops when it moves on (SPEC.md, "Rising floor").
   */
  function showGoal(reached = false) {
    const target = nextMilestone(state.top);
    const retired = floorOf(state.top);
    const label = document.createElement('span');
    label.className = 'goal-label';
    label.textContent = `🎯 ${t.goal}`;
    const then = document.createElement('span');
    then.textContent = t.goalThen;
    goal.replaceChildren(
      label,
      miniBlock(target, theme, store.palette),
      then,
      miniBlock(retired, theme, store.palette),
    );
    goal.setAttribute('aria-label', t.goalLabel(formatValue(2 ** target), formatValue(2 ** retired)));
    const near = target - state.top === 1;
    if (near && !goal.classList.contains('is-near')) bump(goal);
    goal.classList.toggle('is-near', near);
    if (reached) bump(goal);
  }

  /** A move or a shuffle is animating: taps wait for it (SPEC.md, "A move"). */
  let moving = false;
  /** Set by leave(): moves still animating stop there. */
  let left = false;

  /** 🔀 shows how many are left; it only works, and pulses, when nothing can merge (SPEC.md). */
  function showShuffle() {
    const stuck = isStuck(state);
    shuffleCount.textContent = String(state.shuffles);
    shuffleButton.disabled = !stuck || moving;
    shuffleButton.classList.toggle('is-urgent', stuck);
    shuffleButton.setAttribute('aria-label', t.shuffleLabel(state.shuffles));
    shuffleLabel.textContent = stuck ? t.shuffleNow : t.shuffle;
  }

  // ------------------------------------------------------------------ the board

  const kit = createGame({
    parent: stage,
    background: BOARD[theme].background,
    telemetry: session.telemetry,
    createScene: () =>
      new BoardScene(
        sfx,
        t,
        {
          onTap: (cell) => void play(cell),
          onScore: (score) => showScore(score),
          onTop: () => bump(shuffleButton),
          onFloor: () => showGoal(true),
        },
        theme,
        store.palette,
        session.locale,
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
    showShuffle();
  });

  // Light/dark follows the hub (ADR 0013): the page through the menu stage's followTheme, the board here.
  const offTheme = session.on('settings', (settings) => {
    if (settings.theme === theme) return;
    theme = settings.theme;
    board.setTheme(theme);
    kit.setBackground(BOARD[theme].background);
    showGoal();
  });

  function setPalette(id: PaletteId) {
    sfx.play('click');
    store.palette = id;
    board.setPalette(id);
    showGoal();
    void save();
  }

  async function play(cell: Cell) {
    if (moving || ctx.overlay.visible) return;
    const result = tap(state, cell);
    if (!result.ok) {
      if (result.reason === 'no_match') board.reject(cell);
      return;
    }
    await animate(result.state, result.events);
    if (left) return;
    void run.update(state.score).catch(scoreFailed);
    if (!passedBest && store.best > 0 && state.score > store.best && !state.over) {
      passedBest = true;
      board.celebrateRecord();
    }
    if (state.over) endGame();
  }

  async function rescue() {
    if (moving || ctx.overlay.visible) return;
    const result = shuffle(state);
    if (!result.ok) return;
    sfx.play('click');
    await animate(result.state, result.events);
  }
  shuffleButton.addEventListener('click', () => void rescue());

  async function animate(next: State, events: Parameters<BoardScene['play']>[0]) {
    moving = true;
    const before = state.score;
    state = next;
    showShuffle();
    await board.play(events, state, before);
    if (left) return;
    showScore(state.score);
    moving = false;
    showShuffle();
    void save();
  }

  function endGame() {
    const record = state.score > store.best;
    void save();
    void run.finish(state.score).catch(scoreFailed);
    const largest = document.createElement('p');
    largest.className = 'largest';
    largest.append(t.largest(''), miniBlock(state.top, theme, store.palette));
    ctx.gameOver({
      icon: record ? '🏆' : '👆',
      title: record ? t.record : t.over,
      body: t.result(formatScore(state.score, session.locale), formatScore(store.best, session.locale)),
      content: largest,
    });
  }

  function startNewGame() {
    if (!state.over && state.score > 0) void run.finish(state.score).catch(scoreFailed);
    runId = newRunId();
    run = session.run(runId);
    state = newGame(state.rng, store.best);
    passedBest = false;
    board.setBoard(state);
    scores.setBest(store.best);
    showScore(0, false);
    showShuffle();
    showGoal();
    void save();
  }

  /** The first block that merges, for the pointing hand of the first game. */
  function firstMove(): Cell | null {
    for (let index = 0; index < state.grid.length; index++) {
      const cell = cellAt(index);
      if (matches(state.grid, cell).length > 0) return cell;
    }
    return null;
  }

  const onKey = (event: KeyboardEvent) => {
    // A focused button (🔀, ☰) handles Enter and Space itself.
    if (ctx.overlay.visible || event.target instanceof HTMLButtonElement) return;
    if (event.key === 'ArrowLeft') board.nudge(-1, 0);
    else if (event.key === 'ArrowRight') board.nudge(1, 0);
    else if (event.key === 'ArrowUp') board.nudge(0, 1);
    else if (event.key === 'ArrowDown') board.nudge(0, -1);
    else if (event.key === 'Enter' || event.key === ' ') {
      const aimed = board.aimed;
      if (aimed && !event.repeat) void play(aimed);
    } else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  await board.whenReady;
  board.relayout(kit.size().width, kit.size().height);
  board.setBoard(state);
  showScore(state.score, false);
  showShuffle();
  showGoal();
  if (ctx.firstTime) board.showHint(firstMove());
  void save();
  ctx.ready();

  return {
    pause: () => kit.pause(),
    resume: () => kit.resume(),
    newGame: () => {
      sfx.play('click');
      startNewGame();
    },
    quick: () => [
      {
        kind: 'choices',
        icon: '🎨',
        label: t.colours,
        choices: PALETTE_IDS.map((id) => ({ id, label: t.palettes[id], preview: samples(id, theme, 4) })),
        chosen: store.palette,
        onChoose: (id) => setPalette(id as PaletteId),
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
