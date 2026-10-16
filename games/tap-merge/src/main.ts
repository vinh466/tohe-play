// Wiring: SDK session, kit game, HUD, overlays, saving. Rules live in logic.ts, drawing in view.ts.
import '@tohe/game-kit/overlay.css';
import './style.css';
import {
  bump,
  choiceList,
  createHud,
  createSfx,
  createShell,
  followTheme,
  formatScore,
  formatValue,
  haptics,
  hintList,
  newRunId,
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

// The leaderboard shows the game in progress as it grows, and its best score stays when it ends.
let runId = (resumed && !resumed.over && saved?.run) || newRunId();
let run = session.run(runId);
const scoreFailed = (error: unknown) => session.log('warn', `score not stored: ${String(error)}`);

/** A move or a shuffle is animating: taps wait for it (SPEC.md, "A move"). */
let moving = false;

// ------------------------------------------------------------------ shell and HUD

const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
const stage = document.querySelector<HTMLElement>('#stage') as HTMLElement;

// The game shell (ADR 0019): the title screen, ☰ and its menu, phone Back, how to play the first time. The colours
// change any time.
const shell = createShell({
  session,
  root: app,
  icon: '👆',
  title: t.title,
  inProgress: () =>
    state.moves > 0 && !state.over ? t.inProgress(formatScore(state.score, session.locale)) : null,
  play: () => {
    if (state.over) startNewGame();
  },
  newGame: () => {
    sfx.play('click');
    startNewGame();
  },
  howTo: () => ({ icon: '👆', title: t.title, content: hintList(t.hints) }),
  tutorial: {
    seen: () => tutorialSeen,
    done: () => {
      sfx.play('pop');
      haptics.play('tap');
      tutorialSeen = true;
      board.showHint(firstMove());
      void persist();
    },
  },
  settings: [
    {
      label: t.colours,
      when: 'any-time',
      card: () => ({ icon: '🎨', title: t.colours, content: palettePicker() }),
    },
  ],
  leaderboard: true,
  onPause: () => kit.pause(),
  onResume: () => kit.resume(),
});
const overlay = shell.overlay;

// ☰ | score | 🔀 | best — the kit's HUD (it shortens a score that does not fit its box); 🔀 sits between the scores.
const hud = createHud({ shell, parent: app, locale: session.locale });
const scores = hud.score({ score: t.score, best: t.best });
scores.setBest(best);
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

const showScore = (score: number, animate = true) => scores.set(score, animate);

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
kit.onResize((size) => board.relayout(size.width, size.height));
kit.onRestart(async (scene) => {
  board = scene;
  await board.whenReady;
  board.relayout(kit.size().width, kit.size().height);
  board.setBoard(state);
  moving = false;
  showShuffle();
});

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

/** Cài đặt → Màu khối: the board takes the new colours at once, and the choice is saved with the player. */
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
  scores.setBest(best);
  showScore(0, false);
  showShuffle();
  showGoal();
  void persist();
}

function showGameOver(record: boolean) {
  shell.gameOver({
    icon: record ? '🏆' : '👆',
    title: record ? t.record : t.over,
    body: t.result(formatScore(state.score, session.locale), formatScore(best, session.locale)),
    content: largestBlock(),
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

window.addEventListener('keydown', (event) => {
  // A focused button (🔀, ⏸) handles Enter and Space itself.
  if (overlay.visible || event.target instanceof HTMLButtonElement) return;
  if (event.key === 'ArrowLeft') board.nudge(-1, 0);
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
showGoal();
shell.start();
