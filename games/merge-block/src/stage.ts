// The play stage (ADR 0020): the board, the HUD and the moves. The shell creates it when the player presses play and
// destroys it when they go back to the menu; leave() saves and stops everything start() started. Rules live in
// logic.ts, drawing in view.ts, the save in app.ts. Opened by a challenge link (ADR 0045), it plays the challenge in a
// slot of its own — the regular game, and its ranked run, stay as they were — until "Về ván thường".
import {
  choiceList,
  createHud,
  formatScore,
  newRunId,
  type PlayStage,
  type StageContext,
  shellStrings,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { finishRanked, persist, session, sfx, shareChallenge, startRanked, store, t } from './app.ts';
import { type ChallengeSlot, openChallenge, outcome, readEntry } from './challenge.ts';
import { drop, newGame, type State } from './logic.ts';
import { createNextBlock } from './next.ts';
import { BOARD, PALETTE_IDS, type PaletteId } from './palette.ts';
import { samples } from './swatches.ts';
import { BoardScene } from './view.ts';

/** Taps closer together than this are one bouncing finger, not two drops. */
const DOUBLE_TAP_MS = 150;

export async function start(ctx: StageContext): Promise<PlayStage> {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;
  const scoreFailed = (error: unknown) => session.log('warn', `score not stored: ${String(error)}`);
  const score = (value: number) => formatScore(value, session.locale);

  // ------------------------------------------------------------------ the game: a challenge, continue, or a fresh one

  /** The challenge being played, or null for the regular game. Its slot is in the save beside the regular game. */
  let challenge: ChallengeSlot | null = null;

  /** The regular game: the one in progress, or a fresh one (ranked when the hub deals a run). */
  async function regularGame(fresh: boolean): Promise<{ state: State; runId: string }> {
    if (!fresh && store.game && !store.game.over)
      return { state: store.game, runId: store.run ?? newRunId() };
    // A game left unfinished ends here and keeps the best score it reached on the leaderboard.
    const previous = store.game;
    if (previous && !previous.over && previous.score > 0 && store.run) {
      void session.run(store.run).finish(previous.score).catch(scoreFailed);
    }
    if (previous && !previous.over) finishRanked(previous.score);
    // A ranked run plays from the server's seed (ADR 0030); otherwise the next game continues the PRNG sequence, so
    // every new game differs but stays reproducible.
    const ranked = await startRanked();
    store.ranked = ranked ? { run: ranked.run, seed: ranked.seed, moves: [] } : null;
    return {
      state: newGame(ranked?.seed ?? previous?.rng ?? session.seed, store.best),
      runId: ranked?.run ?? newRunId(),
    };
  }

  /** The challenge a link opened, from its slot or fresh — never a ranked run: its seed is the link's (ADR 0030). */
  const firstGame = async (): Promise<{ state: State; runId: string }> => {
    const opened = ctx.entry ? readEntry(ctx.entry.kind, ctx.entry.payload) : null;
    if (opened?.result !== 'handled') return regularGame(ctx.fresh);
    challenge = openChallenge(
      store.challenge,
      opened.challenge,
      ctx.entry?.from ?? null,
      store.best,
      newRunId,
    );
    store.challenge = challenge;
    return { state: challenge.game ?? newGame(challenge.seed, store.best), runId: challenge.run };
  };
  let { state, runId } = await firstGame();
  // The leaderboard shows the game in progress as it grows, and its best score stays when it ends.
  let run = session.run(runId);

  const save = () => {
    store.best = Math.max(store.best, state.best);
    if (challenge) {
      challenge.game = state;
      challenge.run = runId;
    } else {
      store.game = state;
      store.run = runId;
    }
    return persist();
  };

  // ------------------------------------------------------------------ HUD: ☰ | score | next block | best

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  scores.setBest(store.best);
  let theme: Theme = session.settings.theme;
  const nextBlock = createNextBlock(hud.center, theme);
  const showScore = (value: number, animate = true) => scores.set(value, animate);
  // A challenge's target, under the HUD: the score the link claimed, and whose it is when the hub may say.
  const target = document.createElement('p');
  target.className = 'challenge-target';
  hud.element.after(target);
  const showTarget = () => {
    target.hidden = challenge === null;
    target.textContent = challenge
      ? t.challenge.target(score(challenge.target), challenge.from?.name ?? null)
      : '';
  };
  showTarget();

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
          onScore: (value) => showScore(value),
          onUpcoming: (next, animate) => nextBlock.show(next, animate),
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
    nextBlock.repaint(theme);
  });

  function setPalette(id: PaletteId) {
    sfx.play('click');
    store.palette = id;
    board.setPalette(id);
    nextBlock.repaint(theme);
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
    // A challenge is never ranked: the regular game's ranked run, if any, waits untouched.
    if (!challenge) store.ranked?.moves.push(col);
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
      if (challenge) challengeOver(challenge);
      else regularOver(record);
    } else {
      void save();
    }
  }

  /** The regular game's end: its card, with "Thách bạn" when the game knows its seed and the hub can share. */
  function regularOver(record: boolean) {
    finishRanked(state.score);
    const seed = state.seed;
    const final = state.score;
    ctx.gameOver(
      {
        icon: record ? '🏆' : '🧱',
        title: record ? t.record : t.over,
        body: t.result(score(final), score(store.best)),
      },
      undefined,
      seed !== undefined && session.canShare
        ? [{ label: t.challenge.button, onClick: () => shareChallenge(seed, final) }]
        : [],
    );
  }

  /** A challenge's end: beaten or not, "Thách lại" on the same blocks, and back to the regular game. */
  function challengeOver(played: ChallengeSlot) {
    const final = state.score;
    const { beaten, short } = outcome(final, played.target);
    const name = played.from?.name ?? null;
    ctx.gameOver(
      {
        icon: beaten ? '🏆' : '🎯',
        title: beaten ? t.challenge.beaten(score(played.target), name) : t.challenge.short(score(short)),
        body: t.result(score(final), score(store.best)),
      },
      { label: t.challenge.back, onClick: () => void toRegular() },
      session.canShare
        ? [{ label: t.challenge.again, onClick: () => shareChallenge(played.seed, final) }]
        : [],
    );
  }

  /** Shows a game on the board from its first frame. */
  function show(next: State) {
    state = next;
    run = session.run(runId);
    board.setBoard(state);
    scores.setBest(store.best);
    showScore(state.score, false);
    showTarget();
    moving = false;
    queued = null;
  }

  /** "Về ván thường": the regular game in place — the one in progress, or a fresh one. */
  async function toRegular() {
    moving = true;
    challenge = null;
    const regular = await regularGame(false);
    if (left) return;
    runId = regular.runId;
    show(regular.state);
    void save();
  }

  async function startNewGame() {
    if (!state.over && state.score > 0) void run.finish(state.score).catch(scoreFailed);
    // No drop on the old board while the new one waits for its seed.
    moving = true;
    if (challenge) {
      // A new game of a challenge starts it again on the same blocks, with a run of its own.
      challenge.game = newGame(challenge.seed, store.best);
      runId = newRunId();
      show(challenge.game);
      void save();
      return;
    }
    if (!state.over) finishRanked(state.score);
    const ranked = await startRanked();
    if (left) return;
    store.ranked = ranked ? { run: ranked.run, seed: ranked.seed, moves: [] } : null;
    runId = ranked?.run ?? newRunId();
    show(newGame(ranked?.seed ?? state.rng, store.best));
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
  // A challenge that starts: whose blocks these are, and that the score is the sender's claim.
  // (Set inside firstGame(), which the compiler does not follow.)
  const opening = challenge as ChallengeSlot | null;
  if (opening && state.moves === 0) {
    const name = opening.from?.name ?? null;
    ctx.overlay.show({
      icon: '🎯',
      title: t.challenge.target(score(opening.target), name),
      body: t.challenge.intro(score(opening.target), name),
      actions: [{ label: shellStrings(session.locale).start, onClick: () => ctx.overlay.hide() }],
    });
  }
  void save();
  ctx.ready();

  return {
    pause: () => kit.pause(),
    resume: () => kit.resume(),
    newGame: () => {
      sfx.play('click');
      void startNewGame();
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
