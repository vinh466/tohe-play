// Wiring: SDK session, kit game, HUD, overlays, saving. Rules live in logic.ts, drawing in view.ts.
import '@tohe/game-kit/overlay.css';
import './style.css';
import { createOverlay, createSfx, formatScore, haptics, hintList } from '@tohe/game-kit';
import { createGame } from '@tohe/game-kit/phaser';
import { connect } from '@tohe/game-sdk';
import { drop, newGame, restore, type State } from './logic.ts';
import { stringsFor } from './strings.ts';
import { BoardScene } from './view.ts';

interface Saved {
  best: number;
  /** The game in progress, resumed when the game opens again. */
  game: State | null;
  tutorialSeen: boolean;
}

const session = await connect<Saved>({ gameId: 'merge-block' });
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

// ------------------------------------------------------------------ HUD

const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
const stage = document.querySelector<HTMLElement>('#stage') as HTMLElement;
const scoreLabel = document.querySelector('#score-label') as HTMLElement;
const bestLabel = document.querySelector('#best-label') as HTMLElement;
const scoreValue = document.querySelector('#score') as HTMLElement;
const bestValue = document.querySelector('#best') as HTMLElement;
const bestBox = document.querySelector('#best-box') as HTMLElement;
scoreLabel.textContent = t.score;
bestLabel.textContent = t.best;

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
  if (animate && target > from) {
    scoreValue.classList.remove('bump');
    void scoreValue.offsetWidth; // restart the CSS animation
    scoreValue.classList.add('bump');
  }
}

// ------------------------------------------------------------------ game

let moving = false;
const kit = createGame({
  parent: stage,
  background: '#fff7ed',
  createScene: () =>
    new BoardScene(sfx, t, {
      onDrop: (col) => void move(col),
      onScore: (score) => showScore(score),
    }),
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
});

session.on('pause', () => kit.pause());
session.on('resume', () => kit.resume());

const overlay = createOverlay(app);

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

  if (state.over) {
    const record = state.score > best;
    best = Math.max(best, state.score);
    void persist();
    void session
      .submitScore(state.score)
      .catch((error) => session.log('warn', `score not stored: ${String(error)}`));
    showGameOver(record);
  } else {
    void persist();
  }
}

function persist(): Promise<void> {
  const data: Saved = { best: Math.max(best, state.best), game: state.over ? null : state, tutorialSeen };
  return session.save(data).catch((error) => session.log('warn', `save failed: ${String(error)}`));
}

function startNewGame() {
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
  if (event.key === 'ArrowLeft') board.nudge(-1);
  else if (event.key === 'ArrowRight') board.nudge(1);
  else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')
    void move(board.aimedColumn);
  else return;
  event.preventDefault();
});

await board.whenReady;
board.relayout(kit.size().width, kit.size().height);
board.setBoard(state);
showScore(state.score, false);
if (!tutorialSeen) showTutorial();
