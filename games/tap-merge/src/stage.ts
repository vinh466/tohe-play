// The play stage (ADR 0020): the board, the HUD, the goal and the moves. The shell creates it when the player presses
// play and destroys it when they go back to the menu; leave() saves and stops everything start() started. Rules live
// in logic.ts, drawing in view.ts, the save in app.ts. One stage plays all three doors: the state carries its mode.
import {
  bump,
  choiceList,
  createHud,
  formatScore,
  formatValue,
  icon,
  newRunId,
  type PlayStage,
  type StageContext,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import {
  activeMode,
  badgeTitle,
  startClassic as countClassicStart,
  finishGame,
  gameFor,
  levelLabel,
  newCards,
  nextSeed,
  noteSeen,
  persist,
  runFor,
  session,
  sfx,
  store,
  t,
} from './app.ts';
import {
  dailyDone,
  dailySeed,
  dailyStars,
  LEVEL_BY_ID,
  type Level,
  levelComplete,
  levelStars,
  nextLevel,
} from './content/levels.ts';
import { todayId } from './date.ts';
import {
  type Cell,
  cellAt,
  DAILY_TAPS,
  dailyDateOf,
  floorOf,
  isStuck,
  matches,
  newDailyGame,
  newGame,
  newLevelGame,
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
  const toast = document.createElement('div');
  toast.className = 'toast';
  ctx.root.append(toast);

  // ------------------------------------------------------------------ the game: a level, the daily, a resume or the classic

  const pending = ctx.fresh ? { ...store.pending } : {};
  if (ctx.fresh) store.pending = {};
  let level: Level | null = null;
  let runId: string | null = null;
  let run: ReturnType<typeof session.run> | null = null;
  let state: State;

  const beginClassic = (): State => {
    const previous = store.classicGame;
    if (previous && previous.score > 0 && store.run) {
      void session.run(store.run).finish(previous.score).catch(scoreFailed);
    }
    countClassicStart();
    runId = newRunId();
    run = runFor(runId);
    level = null;
    store.lastMode = 'classic';
    return newGame(nextSeed(), store.best, { mode: 'classic' });
  };

  const beginLevel = (nextLevelDef: Level): State => {
    level = nextLevelDef;
    runId = null;
    run = null;
    store.lastMode = 'journey';
    return newLevelGame(nextLevelDef);
  };

  const beginDaily = (date: string): State => {
    level = null;
    runId = null;
    run = null;
    store.lastMode = 'daily';
    return newDailyGame(date, dailySeed(date));
  };

  if (ctx.fresh && pending.level) {
    const chosen = LEVEL_BY_ID.get(pending.level);
    state = chosen ? beginLevel(chosen) : beginClassic();
  } else if (ctx.fresh && pending.daily) {
    state = beginDaily(pending.daily);
  } else if (!ctx.fresh) {
    const mode = activeMode();
    const saved = mode ? gameFor(mode) : null;
    if (!saved) state = beginClassic();
    else {
      state = saved;
      store.lastMode = state.mode;
      if (state.mode === 'journey' && state.level) level = LEVEL_BY_ID.get(state.level) ?? null;
      if (state.mode === 'classic') {
        runId = store.run ?? newRunId();
        run = runFor(runId);
      }
    }
  } else {
    state = beginClassic();
  }

  /** The score passes the classic best once a game; a game resumed above it has already had its moment. */
  let passedBest = state.mode === 'classic' && store.best > 0 && state.score > store.best;

  const save = () => {
    store.lastMode = state.mode;
    if (state.mode === 'classic') {
      store.classicGame = state;
      store.run = runId;
      store.best = Math.max(store.best, state.best);
    } else if (state.mode === 'journey') {
      store.journeyGame = state;
    } else {
      store.dailyGame = state;
    }
    return persist();
  };

  // ------------------------------------------------------------------ HUD: Menu | score | Xáo trộn | best, then the goal

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  scores.setBest(store.best);
  // Only the classic is ranked: a Journey or Daily score must not light the classic best's crown.
  if (state.mode !== 'classic') {
    const bestBox = ctx.root.querySelector<HTMLElement>('.tohe-stat-best');
    if (bestBox) bestBox.style.display = 'none';
  }
  const rescueBox = document.createElement('div');
  rescueBox.className = 'rescue';
  const shuffleLabel = document.createElement('span');
  shuffleLabel.className = 'tohe-stat-label';
  const shuffleButton = document.createElement('button');
  shuffleButton.type = 'button';
  shuffleButton.className = 'shuffle';
  shuffleButton.disabled = true;
  const shuffleCount = document.createElement('span');
  shuffleButton.append(icon('shuffle'), shuffleCount);
  rescueBox.append(shuffleLabel, shuffleButton);
  hud.center.append(rescueBox);

  let theme: Theme = session.settings.theme;
  const showScore = (score: number, animate = true) => scores.set(score, animate);

  const starMeter = (count: number): HTMLElement => {
    const row = document.createElement('span');
    row.className = 'star-meter';
    row.setAttribute('aria-label', t.stars(count));
    for (let i = 0; i < 3; i++) {
      const star = icon('star');
      star.classList.add('star', i < count ? 'is-on' : 'is-off');
      row.append(star);
    }
    return row;
  };

  const goalMain = (name: string, value?: HTMLElement): HTMLElement => {
    const line = document.createElement('span');
    line.className = 'goal-main';
    line.append(icon('target'), document.createTextNode(name));
    if (value) line.append(value);
    return line;
  };

  /**
   * The goal row. The classic shows the next milestone and the value it retires; a Journey shows the target and the
   * par; a Daily shows the tap budget and the 1K/2K/4K stars. The classic row is unchanged (SPEC.md, "Rising floor").
   */
  function showGoal(reached = false) {
    goal.classList.toggle('is-multi', state.mode !== 'classic');
    if (state.mode === 'classic') {
      const target = nextMilestone(state.top);
      const retired = floorOf(state.top);
      const label = document.createElement('span');
      label.className = 'goal-label';
      label.append(icon('target'), t.goal);
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
      return;
    }

    if (state.mode === 'journey' && level) {
      const projected = levelComplete(state, level)
        ? levelStars(state, level)
        : state.moves <= level.par.three
          ? 3
          : state.moves <= level.par.two
            ? 2
            : 1;
      const main = goalMain(t.goal, miniBlock(level.target, theme, store.palette));
      const sub = document.createElement('span');
      sub.className = 'goal-sub';
      sub.append(document.createTextNode(t.goalTaps(state.moves, level.par.three)), starMeter(projected));
      goal.replaceChildren(main, sub);
      goal.setAttribute(
        'aria-label',
        `${t.target(formatValue(2 ** level.target))} · ${t.goalTaps(state.moves, level.par.three)}`,
      );
      goal.classList.remove('is-near');
      if (reached) bump(goal);
      return;
    }

    if (state.mode === 'daily') {
      const main = document.createElement('span');
      main.className = 'goal-main';
      main.append(icon('timer'), document.createTextNode(t.daily), miniBlock(12, theme, store.palette));
      main.append(document.createTextNode(`Nước ${state.moves}/${DAILY_TAPS}`));
      const sub = document.createElement('span');
      sub.className = 'goal-sub';
      sub.append(document.createTextNode(t.dailyStars), starMeter(dailyStars(state.top)));
      goal.replaceChildren(main, sub);
      goal.setAttribute('aria-label', `${t.daily}, ${t.dailyStars}, ${t.dailyBudget(DAILY_TAPS)}`);
      goal.classList.remove('is-near');
      if (reached) bump(goal);
    }
  }

  /** A move or a shuffle is animating: taps wait for it (SPEC.md, "A move"). */
  let moving = false;
  /** Set by leave(): moves still animating stop there. */
  let left = false;

  /** Xáo trộn shows how many are left; it only works, and pulses, when nothing can merge (SPEC.md). */
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
    showGoal();
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

  // ------------------------------------------------------------------ a move

  function showToast(text: string): void {
    toast.textContent = text;
    toast.classList.add('is-visible');
    window.setTimeout(() => toast.classList.remove('is-visible'), 1900);
  }

  /** Count the merge sizes and the blocks met; returns the values newly added to the notebook. */
  function recordMove(next: State, events: Parameters<BoardScene['play']>[0]): number[] {
    for (const event of events) {
      if (event.type === 'merge')
        store.stats.maxAbsorbed = Math.max(store.stats.maxAbsorbed, event.from.length + 1);
    }
    const fresh = noteSeen(next, events);
    if (fresh.length > 0) {
      const values = fresh.map((exp) => formatValue(2 ** exp)).join(', ');
      showToast(t.newCard(values));
    }
    return fresh;
  }

  async function play(cell: Cell) {
    if (moving || ctx.overlay.visible) return;
    const result = tap(state, cell);
    if (!result.ok) {
      if (result.reason === 'no_match') board.reject(cell);
      return;
    }
    const fresh = recordMove(result.state, result.events);
    await animate(result.state, result.events);
    if (left) return;
    afterMove(fresh);
  }

  async function rescue() {
    if (moving || ctx.overlay.visible) return;
    const result = shuffle(state);
    if (!result.ok) return;
    sfx.play('click');
    const fresh = recordMove(result.state, result.events);
    await animate(result.state, result.events);
    if (left) return;
    afterMove(fresh);
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
    showGoal();
    void save();
  }

  function afterMove(freshCards: number[]) {
    if (state.mode === 'classic') {
      void run?.update(state.score).catch(scoreFailed);
      if (!passedBest && store.best > 0 && state.score > store.best && !state.over) {
        passedBest = true;
        board.celebrateRecord();
      }
      if (state.over) endClassic();
      else void save();
      return;
    }

    if (state.mode === 'journey') {
      if (level && levelComplete(state, level)) {
        state = { ...state, over: true };
        endJourney(freshCards);
        return;
      }
      if (state.over) {
        endJourneyFailed(freshCards);
        return;
      }
      void save();
      return;
    }

    if (state.mode === 'daily') {
      if (dailyDone(state)) {
        state = { ...state, over: true };
        endDaily(freshCards);
        return;
      }
      void save();
    }
  }

  // ------------------------------------------------------------------ end cards

  function starsRow(count: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'result-stars';
    for (let i = 0; i < 3; i++) {
      const star = icon('star');
      star.classList.add('star', i < count ? 'is-on' : 'is-off');
      row.append(star);
    }
    return row;
  }

  function resultContent(stars: number, cards: number[], badges: string[], note?: string): HTMLElement {
    const content = document.createElement('div');
    content.className = 'result';
    if (stars >= 0) content.append(starsRow(stars));
    if (note) {
      const line = document.createElement('p');
      line.className = 'result-note';
      line.textContent = note;
      content.append(line);
    }
    for (const exp of newCards(cards)) {
      const row = document.createElement('div');
      row.className = 'result-unlock';
      row.append(miniBlock(exp, theme, store.palette));
      const text = document.createElement('span');
      text.textContent = t.newCard(formatValue(2 ** exp));
      row.append(text);
      content.append(row);
    }
    for (const badge of badges) {
      const row = document.createElement('div');
      row.className = 'result-unlock';
      row.append(icon('star'));
      const text = document.createElement('span');
      text.textContent = t.newBadge(badgeTitle(badge));
      row.append(text);
      content.append(row);
    }
    return content;
  }

  function endClassic() {
    toast.classList.remove('is-visible');
    const record = state.score > store.best;
    const badges = finishGame(state);
    void save();
    void run?.finish(state.score).catch(scoreFailed);
    const largest = document.createElement('p');
    largest.className = 'largest';
    largest.append(t.largest(''), miniBlock(state.top, theme, store.palette));
    const content = resultContent(-1, [], badges);
    content.append(largest);
    ctx.gameOver({
      icon: record ? 'trophy' : { src: 'icon.svg' },
      title: record ? t.record : t.over,
      body: t.result(formatScore(state.score, session.locale), formatScore(store.best, session.locale)),
      content,
    });
  }

  function endJourney(freshCards: number[]) {
    toast.classList.remove('is-visible');
    if (!level) return;
    const stars = levelStars(state, level);
    const badges = finishGame(state);
    void save();
    const next = nextLevel(level);
    ctx.gameOver(
      {
        icon: stars === 3 ? 'trophy' : { src: 'icon.svg' },
        title: t.levelDone(levelLabel(level.id)),
        body: t.journeyResult(stars, state.moves),
        content: resultContent(stars, freshCards, badges, t.notRanked),
      },
      { label: t.replayLevel, icon: 'play', onClick: () => startLevel(level as Level) },
      next
        ? [
            {
              label: t.nextLevel,
              icon: 'caret-right',
              dismiss: true,
              onClick: () => startLevel(next),
            },
          ]
        : [],
    );
  }

  function endJourneyFailed(freshCards: number[]) {
    toast.classList.remove('is-visible');
    if (!level) return;
    const badges = finishGame(state);
    void save();
    ctx.gameOver(
      {
        icon: 'smiley-sad',
        title: t.stuck,
        body: t.journeyResult(0, state.moves),
        content: resultContent(0, freshCards, badges, t.notRanked),
      },
      { label: t.replayLevel, icon: 'play', onClick: () => startLevel(level as Level) },
    );
  }

  function endDaily(freshCards: number[]) {
    toast.classList.remove('is-visible');
    const date = dailyDateOf(state.level) ?? todayId();
    const stars = dailyStars(state.top);
    const badges = finishGame(state);
    void save();
    const played = stars > 0;
    ctx.gameOver(
      {
        icon: played ? 'trophy' : { src: 'icon.svg' },
        title: t.daily,
        body: t.dailyResult(
          formatValue(2 ** state.top),
          formatScore(state.score, session.locale),
          state.moves,
        ),
        content: resultContent(stars, freshCards, badges, played ? t.dailyStamped : t.notRanked),
      },
      {
        label: played ? t.dailyPractice : t.replayLevel,
        icon: 'play',
        onClick: () => startDaily(date),
      },
    );
  }

  function startLevel(next: Level) {
    level = next;
    state = newLevelGame(next);
    runId = null;
    run = null;
    passedBest = false;
    board.setBoard(state);
    scores.setBest(store.best);
    showScore(0, false);
    showShuffle();
    showGoal();
    void save();
  }

  function startDaily(date: string) {
    level = null;
    state = newDailyGame(date, dailySeed(date));
    runId = null;
    run = null;
    passedBest = false;
    board.setBoard(state);
    scores.setBest(store.best);
    showScore(0, false);
    showShuffle();
    showGoal();
    void save();
  }

  function startClassicFresh() {
    state = beginClassic();
    passedBest = false;
    board.setBoard(state);
    scores.setBest(store.best);
    showScore(0, false);
    showShuffle();
    showGoal();
    void save();
  }

  /** The panel's Ván mới: a fresh game of the current mode, not a jump to another door. */
  function restartCurrent() {
    if (state.mode === 'journey' && level) startLevel(level);
    else if (state.mode === 'daily' && state.level) startDaily(dailyDateOf(state.level) ?? todayId());
    else startClassicFresh();
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
    // A focused button (Xáo trộn, Menu) handles Enter and Space itself.
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
  noteSeen(state);
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
      restartCurrent();
    },
    // Màu khối opens the presets over the panel; a tap repaints the board and the goal behind it at once.
    quick: () => [
      {
        kind: 'card',
        icon: 'palette',
        label: t.colours,
        value: t.palettes[store.palette],
        card: () => ({
          icon: 'palette',
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
