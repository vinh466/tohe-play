// Wiring: SDK session, kit game, HUD, overlays, saving. Rules live in logic.ts, drawing in view.ts.
import '@tohe/game-kit/overlay.css';
import './style.css';
import {
  choiceList,
  createLifecycle,
  createOverlay,
  createSfx,
  followTheme,
  formatCompact,
  formatScore,
  formatValue,
  haptics,
  hintList,
  lifecycleStrings,
  type Theme,
} from '@tohe/game-kit';
import { createGame, cssHex } from '@tohe/game-kit/phaser';
import { connect } from '@tohe/game-sdk';
import {
  type Cell,
  cellAt,
  type Exponent,
  floorOf,
  isStuck,
  matches,
  newGame,
  nextMilestone,
  restore,
  type State,
  shuffle,
  tap,
} from './logic.ts';
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

/**
 * Room for a score: the HUD's score column minus the box's padding. Scores are shown in full while they fit and
 * shortened ("56,4M") when they do not, measured in the HUD's own font, so the boxes never grow over 🔀.
 */
let scoreRoom = Number.POSITIVE_INFINITY;
const measure = document.createElement('canvas').getContext('2d');
function measureScoreRoom() {
  const hud = document.querySelector('#hud') as HTMLElement;
  const track = Number.parseFloat(getComputedStyle(hud).gridTemplateColumns.split(' ')[1] ?? '');
  const box = getComputedStyle(scoreValue.parentElement as HTMLElement);
  const font = getComputedStyle(scoreValue);
  if (!measure || !Number.isFinite(track)) return;
  measure.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
  // A little margin: the canvas measures proportional digits, the HUD shows tabular ones.
  scoreRoom = (track - Number.parseFloat(box.paddingLeft) - Number.parseFloat(box.paddingRight)) * 0.95;
  renderScore();
}

/** The longest form of a score that fits its box. */
function fitted(value: number): string {
  const full = formatScore(value, session.locale);
  if (!measure || measure.measureText(full).width <= scoreRoom) return full;
  for (let chars = full.length - 1; chars > 3; chars--) {
    const text = formatCompact(value, session.locale, chars);
    if (measure.measureText(text).width <= scoreRoom) return text;
  }
  return formatCompact(value, session.locale, 3);
}

let shownScore = state.score;
let scoreAnimation = 0;
function renderScore() {
  scoreValue.textContent = fitted(shownScore);
  bestValue.textContent = fitted(Math.max(best, shownScore));
  bestBox.classList.toggle('is-record', shownScore > best && best > 0);
}

function showScore(target: number, animate = true) {
  cancelAnimationFrame(scoreAnimation);
  const from = shownScore;
  const started = performance.now();
  const duration = animate ? 380 : 0;
  const step = (now: number) => {
    const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
    shownScore = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
    renderScore();
    if (progress < 1) scoreAnimation = requestAnimationFrame(step);
  };
  scoreAnimation = requestAnimationFrame(step);
  if (animate && target > from) bump(scoreValue);
}

/** A block in small, coloured like the board's: the goal, and the largest block on the game-over card. */
function miniBlock(exp: Exponent): HTMLElement {
  const style = blockStyle(exp, theme, palette);
  const block = document.createElement('span');
  block.className = 'mini';
  block.textContent = formatValue(2 ** exp);
  block.style.backgroundColor = cssHex(style.fill);
  block.style.color = style.text;
  block.style.boxShadow =
    style.outline === undefined
      ? `inset 0 -0.15rem 0 ${cssHex(style.edge)}`
      : `inset 0 0 0 2px ${cssHex(style.outline)}, inset 0 -0.15rem 0 ${cssHex(style.edge)}`;
  return block;
}

/**
 * 🎯 The next milestone and the value it retires: "Mục tiêu [4K] tạm biệt [2]". It lights up when one more new
 * largest block reaches it, and pops when it moves on (SPEC.md, "Rising floor").
 */
const goal = document.querySelector('#goal') as HTMLElement;
function showGoal(reached = false) {
  const target = nextMilestone(state.top);
  const retired = floorOf(state.top);
  const label = document.createElement('span');
  label.className = 'goal-label';
  label.textContent = `🎯 ${t.goal}`;
  const then = document.createElement('span');
  then.textContent = t.goalThen;
  goal.replaceChildren(label, miniBlock(target), then, miniBlock(retired));
  goal.setAttribute('aria-label', t.goalLabel(formatValue(2 ** target), formatValue(2 ** retired)));
  const near = target - state.top === 1;
  if (near && !goal.classList.contains('is-near')) bump(goal);
  goal.classList.toggle('is-near', near);
  if (reached) bump(goal);
}

/** The score passes the best score once a game; a game resumed above it has already had its moment. */
let passedBest = best > 0 && state.score > best;

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
      palette,
      session.locale,
    ),
});
/** The current scene; replaced if the kit restarts the game with the Canvas renderer. */
let board = kit.scene;

// Light/dark follows the hub (ADR 0013): the HUD and cards through data-theme, the board through setTheme.
followTheme(session, (next) => {
  theme = next;
  board.setTheme(next);
  kit.setBackground(BOARD[next].background);
  showGoal();
});
kit.onResize((size) => {
  board.relayout(size.width, size.height);
  measureScoreRoom();
});
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
    showGoal();
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
  if (!passedBest && best > 0 && state.score > best && !state.over) {
    passedBest = true;
    board.celebrateRecord();
  }
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
  passedBest = false;
  board.setBoard(state);
  shownScore = 0;
  showScore(0, false);
  showShuffle();
  showGoal();
  void persist();
}

function showGameOver(record: boolean) {
  overlay.show({
    icon: record ? '🏆' : '👆',
    title: record ? t.record : t.over,
    body: t.result(formatScore(state.score, session.locale), formatScore(best, session.locale)),
    content: largestBlock(),
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

/** "Khối lớn nhất [512K]" on the game-over card. */
function largestBlock(): HTMLElement {
  const line = document.createElement('p');
  line.className = 'largest';
  line.append(t.largest(''), miniBlock(state.top));
  return line;
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
measureScoreRoom();
void document.fonts?.ready.then(measureScoreRoom);
showScore(state.score, false);
showShuffle();
showGoal();
if (!tutorialSeen) showTutorial();
else if (state.moves > 0) lifecycle.offerContinue(t.inProgress(formatScore(state.score, session.locale)));
