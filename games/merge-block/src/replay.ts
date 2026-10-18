// The replay stage (ADR 0032): a ranked run played back from its seed the way the verify module replays it, so the
// admin console watches the game the server judged. The board takes no taps; the bar under it steps back and forward,
// plays and pauses at three speeds, and jumps to any move. Nothing is saved, scored or handed in.
import {
  choiceList,
  createHud,
  formatScore,
  type PlayStage,
  type StageContext,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { rankedReplay, session, sfx, store, t } from './app.ts';
import { drop, replayMoves, type State } from './logic.ts';
import { createNextBlock } from './next.ts';
import { BOARD, PALETTE_IDS, type PaletteId } from './palette.ts';
import { samples } from './swatches.ts';
import { BoardScene } from './view.ts';

/** A replay sets no record: the end of someone else's run is never "Kỷ lục mới!". */
const NO_RECORD = Number.MAX_SAFE_INTEGER;
/** ×1 shows where each block goes, then drops it; ×4 drops them one after another; ×20 only draws the boards. */
const SPEEDS = [1, 4, 20] as const;
type Speed = (typeof SPEEDS)[number];
/** At ×1, how long the aim shows over a column before its block drops, and the pause after a move. */
const AIM_MS = 300;
const BETWEEN_MS = 250;
/** At ×4 and ×20, the pause after a move. */
const FAST_MS = { 4: 60, 20: 50 } as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function start(ctx: StageContext): Promise<PlayStage> {
  if (!rankedReplay) throw new Error('replay.ts only plays a ranked run back');
  const { seed, moves } = rankedReplay;
  // The moves the logic takes: a run refused for a move that is not legal plays back up to that move.
  const checked = replayMoves(seed, moves, moves.length, NO_RECORD);
  const total = 'error' in checked ? checked.at : moves.length;
  const columns = moves.slice(0, total) as number[];
  const stateAt = (step: number): State => {
    const played = replayMoves(seed, columns, step, NO_RECORD);
    if ('error' in played) throw new Error(played.error);
    return played.state;
  };

  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const stage = ctx.root.querySelector<HTMLElement>('#stage') as HTMLElement;

  // ------------------------------------------------------------------ HUD: ☰ | score | next block | move

  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const score = hud.stat(t.score);
  let theme: Theme = session.settings.theme;
  const nextBlock = createNextBlock(hud.center, theme);
  const moveStat = hud.stat(t.replay.move, { place: 'end', format: (n) => `${n}/${total}` });

  // ------------------------------------------------------------------ the bar: where the run is, and the controls

  const bar = document.createElement('nav');
  bar.className = 'replay-bar';
  bar.setAttribute('aria-label', t.replay.title);
  const scrub = document.createElement('input');
  scrub.type = 'range';
  scrub.className = 'replay-scrub';
  scrub.min = '0';
  scrub.max = String(total);
  scrub.setAttribute('aria-label', t.replay.scrub);
  const buttons = document.createElement('div');
  buttons.className = 'replay-buttons';
  const button = (className: string, label: string, name?: string) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `tohe-button ${className}`;
    element.textContent = label;
    if (name) element.setAttribute('aria-label', name);
    buttons.append(element);
    return element;
  };
  const backButton = button('tohe-button-secondary', '◀', t.replay.back);
  const playButton = button('tohe-button-primary replay-play', '');
  const forwardButton = button('tohe-button-secondary', '▶', t.replay.forward);
  const speedButton = button('tohe-button-secondary', '');
  const status = document.createElement('p');
  status.className = 'replay-status';
  status.setAttribute('aria-live', 'polite');
  bar.append(scrub, buttons, status);
  ctx.root.append(bar);

  let step = 0;
  let state = stateAt(0);
  let speed: Speed = 1;
  let playing = false;
  /** A move animates: stepping and jumping wait for it, so the board never mixes two states. */
  let moving = false;
  /** A jump asked for while a move animates, made as soon as the move ends. */
  let pendingJump: number | null = null;
  /** Set by leave(): moves still animating stop there. */
  let left = false;

  function show() {
    moveStat.set(step, false);
    scrub.value = String(step);
    scrub.disabled = playing || moving;
    backButton.disabled = playing || moving || step === 0;
    forwardButton.disabled = playing || moving || step >= total;
    playButton.textContent = playing ? `⏸ ${t.replay.pause}` : `▶ ${t.replay.play}`;
    playButton.disabled = !playing && step >= total;
    speedButton.textContent = `×${speed}`;
    speedButton.setAttribute('aria-label', t.replay.speed(speed));
    status.textContent =
      step < total
        ? ''
        : 'error' in checked
          ? t.replay.illegal(total + 1)
          : state.over
            ? t.replay.ended(formatScore(state.score, session.locale))
            : t.replay.unfinished;
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
          onDrop: () => {},
          onScore: (value) => score.set(value),
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
    board.watch();
    board.relayout(kit.size().width, kit.size().height);
    board.setBoard(state);
    moving = false;
    if (pendingJump !== null) {
      const to = pendingJump;
      pendingJump = null;
      jump(to);
      return;
    }
    show();
  });

  const offTheme = session.on('settings', (settings) => {
    if (settings.theme === theme) return;
    theme = settings.theme;
    board.setTheme(theme);
    kit.setBackground(BOARD[theme].background);
    nextBlock.repaint(theme);
  });

  /** Block colours change the board at once, in memory only: a replay saves nothing. */
  function setPalette(id: PaletteId) {
    sfx.play('click');
    store.palette = id;
    board.setPalette(id);
    nextBlock.repaint(theme);
  }

  function jump(to: number) {
    if (moving) {
      pendingJump = to;
      return;
    }
    step = Math.max(0, Math.min(total, to));
    state = stateAt(step);
    board.setBoard(state);
    score.set(state.score, false);
    show();
  }

  /** The next move of the run: animated at ×1 and ×4, drawn at once at ×20. */
  async function forward() {
    if (moving || step >= total || left) return;
    const col = columns[step] as number;
    const result = drop(state, col);
    if (!result.ok) return;
    const before = state.score;
    state = result.state;
    step += 1;
    if (speed === 20) {
      board.setBoard(state);
      score.set(state.score, false);
      show();
      return;
    }
    moving = true;
    show();
    if (speed === 1) {
      board.hover(col);
      await wait(AIM_MS);
      if (left) return;
    }
    await board.play(result.events, state, before);
    if (left) return;
    score.set(state.score);
    moving = false;
    if (pendingJump !== null) {
      const to = pendingJump;
      pendingJump = null;
      jump(to);
      return;
    }
    show();
  }

  async function playOn() {
    while (playing && !left && step < total) {
      await forward();
      await wait(speed === 1 ? BETWEEN_MS : FAST_MS[speed]);
    }
    if (left) return;
    playing = false;
    show();
  }

  scrub.addEventListener('input', () => jump(Number(scrub.value)));
  backButton.addEventListener('click', () => jump(step - 1));
  forwardButton.addEventListener('click', () => void forward());
  playButton.addEventListener('click', () => {
    if (playing) {
      playing = false;
    } else if (step < total) {
      playing = true;
      void playOn();
    }
    show();
  });
  speedButton.addEventListener('click', () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] as Speed;
    show();
  });

  await board.whenReady;
  board.watch();
  board.relayout(kit.size().width, kit.size().height);
  board.setBoard(state);
  score.set(0, false);
  show();
  ctx.ready();
  // It plays from the start as it opens, like a video: ⏸ stops it to step or jump.
  if (total > 0) {
    playing = true;
    show();
    void playOn();
  }

  return {
    // The panel or the hub is over it: playing stops, and the player goes on with ▶.
    pause: () => {
      playing = false;
      show();
      kit.pause();
    },
    resume: () => kit.resume(),
    newGame: () => {
      playing = false;
      jump(0);
    },
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
      playing = false;
      offTheme();
      kit.destroy();
    },
  };
}
