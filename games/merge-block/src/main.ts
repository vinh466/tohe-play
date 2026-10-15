// Wiring: SDK session, kit game, HUD, overlays, saving. Rules live in logic.ts, drawing in view.ts.
import '@tohe/game-kit/overlay.css';
import './style.css';
import {
  choiceList,
  createLifecycle,
  createOverlay,
  createSfx,
  followTheme,
  formatScore,
  formatValue,
  haptics,
  hintList,
  lifecycleStrings,
  type Theme,
} from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { connect } from '@tohe/game-sdk';
import { blockValue, drop, type Exponent, newGame, restore, type State } from './logic.ts';
import { BOARD, blockStyle, DEFAULT_PALETTE, isPalette, PALETTE_IDS, type PaletteId } from './palette.ts';
import { stringsFor } from './strings.ts';
import { BoardScene } from './view.ts';

interface Saved {
  best: number;
  /** The game in progress, resumed when the game opens again. */
  game: State | null;
  tutorialSeen: boolean;
  /** The id the game in progress reports its score under on the household leaderboard (ADR 0014). */
  run?: string;
  /** The player's block colours (SPEC.md, "Block colours"); absent in saves from before 1.5.0. */
  palette?: PaletteId;
}

const session = await connect<Saved>({ gameId: 'merge-block' });
const t = stringsFor(session.locale);
document.documentElement.lang = session.locale;

const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const saved = session.saved;
let best = saved?.best ?? 0;
const resumed = restore(saved?.game);
let state: State = resumed && !resumed.over ? resumed : newGame(session.seed, best);
let tutorialSeen = saved?.tutorialSeen ?? false;
let palette: PaletteId = isPalette(saved?.palette) ? saved.palette : DEFAULT_PALETTE;

/** A fresh id per game. `crypto.randomUUID` needs a secure context, which a home server on plain HTTP is not. */
function newRunId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
// The leaderboard shows the game in progress as it grows, and its best score stays when it ends.
let runId = (resumed && !resumed.over && saved?.run) || newRunId();
let run = session.run(runId);
const scoreFailed = (error: unknown) => session.log('warn', `score not stored: ${String(error)}`);

// ------------------------------------------------------------------ HUD

const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
const stage = document.querySelector<HTMLElement>('#stage') as HTMLElement;
const scoreLabel = document.querySelector('#score-label') as HTMLElement;
const bestLabel = document.querySelector('#best-label') as HTMLElement;
const scoreValue = document.querySelector('#score') as HTMLElement;
const bestValue = document.querySelector('#best') as HTMLElement;
const bestBox = document.querySelector('#best-box') as HTMLElement;
const nextBox = document.querySelector('#next-box') as HTMLElement;
const nextBlock = document.querySelector('#next-block') as HTMLElement;
scoreLabel.textContent = t.score;
bestLabel.textContent = t.best;
(document.querySelector('#next-label') as HTMLElement).textContent = t.next;

let shownScore = state.score;
let scoreAnimation = 0;
function showScore(target: number, animate = true) {
  cancelAnimationFrame(scoreAnimation);
  const from = shownScore;
  const started = performance.now();
  const duration = animate ? 380 : 0;
  const step = (now: number) => {
    const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
    shownScore = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
    scoreValue.textContent = formatScore(shownScore, session.locale);
    const leading = shownScore > best && best > 0;
    bestValue.textContent = formatScore(Math.max(best, shownScore), session.locale);
    bestBox.classList.toggle('is-record', leading);
    if (progress < 1) scoreAnimation = requestAnimationFrame(step);
  };
  scoreAnimation = requestAnimationFrame(step);
  if (animate && target > from) bump(scoreValue);
}

function bump(element: HTMLElement) {
  element.classList.remove('bump');
  void element.offsetWidth; // restart the CSS animation
  element.classList.add('bump');
}

const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** The next block shown in the HUD, kept to repaint it when the player picks other colours. */
let shownNext: Exponent | null = null;

/** The next block sits in the HUD, so the current block can hover over any column without covering it. */
function showNext(exp: Exponent | null, animate: boolean) {
  shownNext = exp;
  nextBox.classList.toggle('is-hidden', exp === null);
  if (exp === null) return;
  const style = blockStyle(exp, theme, palette);
  const value = formatValue(blockValue(exp));
  nextBlock.textContent = value;
  nextBlock.classList.toggle('is-long', value.length > 2);
  nextBlock.style.setProperty('--fill', cssColor(style.fill));
  nextBlock.style.setProperty('--edge', cssColor(style.edge));
  nextBlock.style.setProperty('--text', style.text);
  if (animate) bump(nextBlock);
}

// ------------------------------------------------------------------ game

let moving = false;
/** A tap made while a move still animates, played as soon as it ends (children tap ahead); the latest wins. */
let queued: number | null = null;
let lastTap = Number.NEGATIVE_INFINITY;
/** Taps closer together than this are one bouncing finger, not two drops. */
const DOUBLE_TAP_MS = 150;

let theme: Theme = session.settings.theme;
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
      palette,
    ),
});
/** The current scene; replaced if the kit restarts the game with the Canvas renderer. */
let board = kit.scene;

// Light/dark follows the hub (ADR 0013): the HUD and cards through data-theme, the board through setTheme.
followTheme(session, (next) => {
  theme = next;
  board.setTheme(next);
  kit.setBackground(BOARD[next].background);
});
kit.onResize((size) => board.relayout(size.width, size.height));
kit.onRestart(async (scene) => {
  board = scene;
  await board.whenReady;
  board.relayout(kit.size().width, kit.size().height);
  board.setBoard(state);
  moving = false;
  queued = null;
});

session.on('pause', () => kit.pause());
session.on('resume', () => kit.resume());

const overlay = createOverlay(app);

// Continue or start over when a game in progress is opened, and the ⏸ menu while playing (kit lifecycle).
const lifecycle = createLifecycle({
  overlay,
  strings: lifecycleStrings(session.locale),
  icon: '🧱',
  title: t.title,
  howTo: () => ({ icon: '🧱', title: t.title, content: hintList(t.hints) }),
  menuCards: [{ label: t.colours, card: () => ({ icon: '🎨', title: t.colours, content: palettePicker() }) }],
  onNewGame: () => {
    sfx.play('click');
    startNewGame();
  },
});
document.querySelector('#hud')?.prepend(lifecycle.menuButton());

/** Sample blocks 2 … 256 of a preset, drawn like the board's blocks. */
const SAMPLES = 8;
function samples(id: PaletteId): HTMLElement {
  const row = document.createElement('span');
  row.className = 'samples';
  row.setAttribute('aria-hidden', 'true');
  for (let exp = 1; exp <= SAMPLES; exp++) {
    const style = blockStyle(exp, theme, id);
    const block = document.createElement('span');
    block.className = 'sample';
    block.textContent = formatValue(blockValue(exp));
    block.style.backgroundColor = cssColor(style.fill);
    block.style.color = style.text;
    block.style.boxShadow = `inset 0 -0.2rem 0 ${cssColor(style.edge)}`;
    row.append(block);
  }
  return row;
}

/** ⏸ → Màu khối: the board and the next block take the new colours at once; the choice is saved with the player. */
function palettePicker(): HTMLElement {
  const choices = PALETTE_IDS.map((id) => ({ id, label: t.palettes[id], preview: samples(id) }));
  return choiceList(choices, palette, (id) => {
    sfx.play('click');
    palette = id;
    board.setPalette(id);
    showNext(shownNext, false);
    void persist();
  });
}

function requestMove(col: number) {
  if (overlay.visible) return;
  const now = performance.now();
  if (now - lastTap < DOUBLE_TAP_MS) return;
  lastTap = now;
  if (moving) queued = col;
  else void move(col);
}

async function move(col: number) {
  if (moving || overlay.visible) return;
  const result = drop(state, col);
  if (!result.ok) {
    if (result.reason === 'column_full') board.reject(col);
    return;
  }
  moving = true;
  const before = state.score;
  state = result.state;
  await board.play(result.events, state, before);
  showScore(state.score);
  moving = false;
  if (!state.over && state.score > before) void run.update(state.score).catch(scoreFailed);

  if (!state.over && queued !== null) {
    const nextCol = queued;
    queued = null;
    void persist();
    void move(nextCol);
    return;
  }
  queued = null;
  if (state.over) {
    const record = state.score > best;
    best = Math.max(best, state.score);
    void persist();
    void run.finish(state.score).catch(scoreFailed);
    showGameOver(record);
  } else {
    void persist();
  }
}

function persist(): Promise<void> {
  const data: Saved = {
    best: Math.max(best, state.best),
    game: state.over ? null : state,
    tutorialSeen,
    run: runId,
    palette,
  };
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

function startNewGame() {
  // A game left unfinished ends here and keeps the best score it reached on the leaderboard.
  if (!state.over && state.score > 0) void run.finish(state.score).catch(scoreFailed);
  runId = newRunId();
  run = session.run(runId);
  // The next game continues the PRNG sequence, so every new game differs but stays reproducible.
  state = newGame(state.rng, best);
  board.setBoard(state);
  shownScore = 0;
  showScore(0, false);
  void persist();
}

function showGameOver(record: boolean) {
  overlay.show({
    icon: record ? '🏆' : '🧱',
    title: record ? t.record : t.over,
    body: t.result(formatScore(state.score, session.locale), formatScore(best, session.locale)),
    actions: [
      {
        label: t.again,
        onClick: () => {
          sfx.play('click');
          overlay.hide();
          startNewGame();
        },
      },
      ...(session.mode === 'embedded'
        ? [{ label: t.exit, variant: 'secondary' as const, onClick: () => session.exit() }]
        : []),
    ],
  });
}

function showTutorial() {
  overlay.show({
    icon: '🧱',
    title: t.title,
    content: hintList(t.hints),
    actions: [
      {
        label: t.start,
        onClick: () => {
          sfx.play('pop');
          haptics.play('tap');
          overlay.hide();
          tutorialSeen = true;
          board.showHint(true);
          void persist();
        },
      },
    ],
  });
}

window.addEventListener('keydown', (event) => {
  if (overlay.visible) return;
  if (event.key === 'Escape') lifecycle.openMenu();
  else if (event.key === 'ArrowLeft') board.nudge(-1);
  else if (event.key === 'ArrowRight') board.nudge(1);
  else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    if (!event.repeat) requestMove(board.aimedColumn); // holding the key down drops once
  } else return;
  event.preventDefault();
});

await board.whenReady;
board.relayout(kit.size().width, kit.size().height);
board.setBoard(state);
showScore(state.score, false);
if (!tutorialSeen) showTutorial();
else if (state.moves > 0) lifecycle.offerContinue(t.inProgress(formatScore(state.score, session.locale)));
