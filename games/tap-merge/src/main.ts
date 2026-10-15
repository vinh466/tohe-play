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
import { createGame, cssHex } from '@tohe/game-kit/phaser';
import { connect } from '@tohe/game-sdk';
import { type Cell, cellAt, isStuck, matches, newGame, restore, type State, shuffle, tap } from './logic.ts';
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
  /** The player's block colours (SPEC.md, "Block colours"); absent in saves from before 0.4.0. */
  palette?: PaletteId;
}

const session = await connect<Saved>({ gameId: 'tap-merge' });
const t = stringsFor(session.locale);
document.documentElement.lang = session.locale;

const sfx = createSfx();
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

/** A move or a shuffle is animating: taps wait for it (SPEC.md, "A move"). */
let moving = false;

// ------------------------------------------------------------------ HUD

const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
const stage = document.querySelector<HTMLElement>('#stage') as HTMLElement;
const scoreValue = document.querySelector('#score') as HTMLElement;
const bestValue = document.querySelector('#best') as HTMLElement;
const bestBox = document.querySelector('#best-box') as HTMLElement;
const shuffleButton = document.querySelector('#shuffle') as HTMLButtonElement;
const shuffleCount = document.querySelector('#shuffle-count') as HTMLElement;
const shuffleLabel = document.querySelector('#shuffle-label') as HTMLElement;
(document.querySelector('#score-label') as HTMLElement).textContent = t.score;
(document.querySelector('#best-label') as HTMLElement).textContent = t.best;

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

/** 🔀 shows how many are left; it only works, and pulses, when nothing can merge (SPEC.md). */
function showShuffle() {
  const stuck = isStuck(state);
  shuffleCount.textContent = String(state.shuffles);
  shuffleButton.disabled = !stuck || moving;
  shuffleButton.classList.toggle('is-urgent', stuck);
  shuffleButton.setAttribute('aria-label', t.shuffleLabel(state.shuffles));
  shuffleLabel.textContent = stuck ? t.shuffleNow : t.shuffle;
}

// ------------------------------------------------------------------ game

let theme: Theme = session.settings.theme;
const kit = createGame({
  parent: stage,
  background: BOARD[theme].background,
  createScene: () =>
    new BoardScene(
      sfx,
      t,
      {
        onTap: (cell) => void play(cell),
        onScore: (score) => showScore(score),
        onTop: () => bump(shuffleButton),
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
  showShuffle();
});

session.on('pause', () => kit.pause());
session.on('resume', () => kit.resume());

const overlay = createOverlay(app);

// Continue or start over when a game in progress is opened, and the ⏸ menu while playing (kit lifecycle).
const lifecycle = createLifecycle({
  overlay,
  strings: lifecycleStrings(session.locale),
  icon: '👆',
  title: t.title,
  howTo: () => ({ icon: '👆', title: t.title, content: hintList(t.hints) }),
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
    block.textContent = formatValue(2 ** exp);
    block.style.backgroundColor = cssHex(style.fill);
    block.style.color = style.text;
    block.style.boxShadow = `inset 0 -0.2rem 0 ${cssHex(style.edge)}`;
    row.append(block);
  }
  return row;
}

/** ⏸ → Màu khối: the board takes the new colours at once, and the choice is saved with the player. */
function palettePicker(): HTMLElement {
  const choices = PALETTE_IDS.map((id) => ({ id, label: t.palettes[id], preview: samples(id) }));
  return choiceList(choices, palette, (id) => {
    sfx.play('click');
    palette = id;
    board.setPalette(id);
    void persist();
  });
}

async function play(cell: Cell) {
  if (moving || overlay.visible) return;
  const result = tap(state, cell);
  if (!result.ok) {
    if (result.reason === 'no_match') board.reject(cell);
    return;
  }
  await animate(result.state, result.events);
  void run.update(state.score).catch(scoreFailed);
  if (state.over) endGame();
}

async function rescue() {
  if (moving || overlay.visible) return;
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
  showScore(state.score);
  moving = false;
  showShuffle();
  void persist();
}

function endGame() {
  const record = state.score > best;
  best = Math.max(best, state.score);
  void persist();
  void run.finish(state.score).catch(scoreFailed);
  showGameOver(record);
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
  showShuffle();
  void persist();
}

function showGameOver(record: boolean) {
  overlay.show({
    icon: record ? '🏆' : '👆',
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

/** The first block that merges, for the pointing hand of the first game. */
function firstMove(): Cell | null {
  for (let index = 0; index < state.grid.length; index++) {
    const cell = cellAt(index);
    if (matches(state.grid, cell).length > 0) return cell;
  }
  return null;
}

function showTutorial() {
  overlay.show({
    icon: '👆',
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
          board.showHint(firstMove());
          void persist();
        },
      },
    ],
  });
}

window.addEventListener('keydown', (event) => {
  // A focused button (🔀, ⏸) handles Enter and Space itself.
  if (overlay.visible || event.target instanceof HTMLButtonElement) return;
  if (event.key === 'Escape') lifecycle.openMenu();
  else if (event.key === 'ArrowLeft') board.nudge(-1, 0);
  else if (event.key === 'ArrowRight') board.nudge(1, 0);
  else if (event.key === 'ArrowUp') board.nudge(0, 1);
  else if (event.key === 'ArrowDown') board.nudge(0, -1);
  else if (event.key === 'Enter' || event.key === ' ') {
    const aimed = board.aimed;
    if (aimed && !event.repeat) void play(aimed);
  } else return;
  event.preventDefault();
});

await board.whenReady;
board.relayout(kit.size().width, kit.size().height);
board.setBoard(state);
showScore(state.score, false);
showShuffle();
if (!tutorialSeen) showTutorial();
else if (state.moves > 0) lifecycle.offerContinue(t.inProgress(formatScore(state.score, session.locale)));
