// View + wiring: turns pointer input into logic actions, draws state on a canvas, talks to the hub via the SDK.
// The minimal game: a Canvas 2D board and no engine, on the kit's engine-free parts like every other game — the game
// shell (title screen, ☰ menu, how to play, 3-2-1 before a round goes on: ADR 0019), the HUD and the sounds.
import '@tohe/game-kit/overlay.css';
import './style.css';
import { createHud, createSfx, createShell, followTheme } from '@tohe/game-kit';
import { connect, createRng } from '@tohe/game-sdk';
import { createState, ROUND_MS, type State, start, tap, tick } from './logic.ts';

interface Saved {
  best: number;
  /** The how-to was shown before a first round; absent in saves from before 1.3.0. */
  tutorialSeen?: boolean;
}

const text = {
  vi: {
    title: 'Chạm Chấm',
    intro: 'Chạm vào chấm tròn càng nhiều càng tốt trong 20 giây!',
    hints: 'Chấm nhỏ dần khi bạn ghi điểm. Chạm trượt không bị trừ điểm.',
    score: 'Điểm',
    best: 'Kỷ lục',
    over: 'Hết giờ!',
    record: 'Kỷ lục mới!',
    result: (score: number, best: number) => `Bạn được ${score} điểm · Kỷ lục ${best}`,
  },
  en: {
    title: 'Tap the Dot',
    intro: 'Tap the dot as many times as you can in 20 seconds!',
    hints: 'The dot shrinks as you score. Missed taps cost nothing.',
    score: 'Score',
    best: 'Best',
    over: "Time's up!",
    record: 'New record!',
    result: (score: number, best: number) => `You scored ${score} · Best ${best}`,
  },
};

const session = await connect<Saved>({ gameId: 'hello' });
const t = session.locale.startsWith('vi') ? text.vi : text.en;
document.documentElement.lang = session.locale;
const rng = createRng(session.seed);

const sfx = createSfx({ telemetry: session.telemetry });
sfx.setMuted(session.settings.muted);
session.on('settings', (settings) => sfx.setMuted(settings.muted));

const app = document.querySelector<HTMLElement>('#app') as HTMLElement;
const canvas = document.querySelector<HTMLCanvasElement>('#board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

let state: State = createState(session.saved?.best ?? 0);
let tutorialSeen = session.saved?.tutorialSeen ?? false;
/** The best score when the round began: beating it is a record. */
let bestBefore = state.best;
/** The round's clock stops while a shell screen is over it. */
let paused = true;
let last = performance.now();

// ------------------------------------------------------------------ shell and HUD

const shell = createShell({
  session,
  root: app,
  icon: '🟠',
  title: t.title,
  // A 20-second round is not worth continuing later: the title screen always starts a fresh one.
  inProgress: () => null,
  play: () => play(),
  newGame: () => play(),
  howTo: () => ({ icon: '🟠', title: t.title, body: `${t.intro} ${t.hints}` }),
  tutorial: {
    seen: () => tutorialSeen,
    done: () => {
      tutorialSeen = true;
      void persist();
    },
  },
  leaderboard: true,
  countdown: true,
  onPause: () => {
    paused = true;
  },
  onResume: () => {
    paused = false;
    last = performance.now();
  },
});

// ☰ | score | seconds left | best.
const hud = createHud({ shell, parent: app, locale: session.locale });
const scores = hud.score({ score: t.score, best: t.best });
scores.setBest(state.best);
const clock = document.createElement('span');
clock.className = 'clock';
hud.center.append(clock);

function showClock() {
  clock.textContent = `⏱ ${Math.ceil(state.timeLeftMs / 1000)}`;
  clock.classList.toggle('is-low', state.phase === 'playing' && state.timeLeftMs <= 5000);
}

// ------------------------------------------------------------------ theme

// Light/dark follows the hub (ADR 0013): the page and the kit's screens through CSS; the canvas reads the same design
// tokens, once per change.
let colors = readColors();
function readColors() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--tohe-${name}`).trim();
  return { arena: token('soft'), dot: token('brand'), timer: token('line-strong') };
}
followTheme(session, () => {
  colors = readColors();
});

// ------------------------------------------------------------------ layout

/** The playfield is the largest centred square that fits; logic works in its 0..1 coordinates. */
function playfield() {
  const size = Math.min(canvas.clientWidth, canvas.clientHeight - 24) * 0.94;
  return { size, left: (canvas.clientWidth - size) / 2, top: 24 + (canvas.clientHeight - 24 - size) / 2 };
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ------------------------------------------------------------------ rendering

function draw(): void {
  const { size, left, top } = playfield();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  ctx.fillStyle = colors.arena;
  ctx.beginPath();
  ctx.roundRect(left, top, size, size, 24);
  ctx.fill();

  if (state.dot) {
    ctx.fillStyle = colors.dot;
    ctx.beginPath();
    ctx.arc(left + state.dot.x * size, top + state.dot.y * size, state.dot.r * size, 0, Math.PI * 2);
    ctx.fill();
  }

  const progress = state.timeLeftMs / ROUND_MS;
  ctx.fillStyle = colors.timer;
  ctx.fillRect(left, top - 12, size * progress, 4);
}

// ------------------------------------------------------------------ rounds

function play(): void {
  state = start(state, rng);
  bestBefore = state.best;
  scores.setBest(state.best);
  scores.set(0);
  paused = false;
  last = performance.now();
  showClock();
}

function frame(now: number): void {
  const dt = now - last;
  last = now;
  if (!paused) {
    const before = state.phase;
    state = tick(state, dt);
    showClock();
    if (before === 'playing' && state.phase === 'over') void finish();
  }
  draw();
  requestAnimationFrame(frame);
}

async function finish(): Promise<void> {
  const record = state.score > bestBefore;
  sfx.play(record ? 'fanfare' : 'drop');
  shell.gameOver({
    icon: record ? '🏆' : '🟠',
    title: record ? t.record : t.over,
    body: t.result(state.score, state.best),
  });
  try {
    await session.submitScore(state.score);
    await persist();
  } catch (error) {
    session.log('warn', `could not store result: ${String(error)}`);
  }
}

function persist(): Promise<void> {
  return session.save({ best: state.best, tutorialSeen });
}

// ------------------------------------------------------------------ input

canvas.addEventListener('pointerdown', (event) => {
  if (paused || !shell.playing) return;
  const rect = canvas.getBoundingClientRect();
  const { size, left, top } = playfield();
  const point = { x: (event.clientX - rect.left - left) / size, y: (event.clientY - rect.top - top) / size };
  const result = tap(state, point, rng);
  state = result.state;
  if (result.hit) {
    sfx.play('pop', Math.min(state.score, 20));
    scores.set(state.score, true);
  }
});

window.addEventListener('resize', resize);
resize();
showClock();
requestAnimationFrame(frame);
shell.start();
