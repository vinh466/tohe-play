// View + wiring: turns pointer input into logic actions, draws state on a canvas, talks to the hub via the SDK.
// The minimal game: no kit, so its main menu and ☰ menu (the game shell, ADR 0018) are drawn here by hand.
import { applyTheme, type Theme } from '@tohe/design-tokens/theme';
import { connect, createRng } from '@tohe/game-sdk';
import { createState, ROUND_MS, type State, start, tap, tick } from './logic.ts';

interface Saved {
  best: number;
}

const text = {
  vi: {
    title: 'Chạm Chấm',
    intro: 'Chạm vào chấm tròn càng nhiều càng tốt trong 20 giây!',
    play: '▶ Chơi',
    again: 'Chơi lại',
    exit: '← Về Tò He',
    paused: 'Tạm dừng',
    resume: '▶ Tiếp tục',
    mainMenu: '☰ Menu chính',
    leaderboard: '🏆 Bảng xếp hạng',
    sound: (muted: boolean) => (muted ? '🔇 Âm thanh: tắt' : '🔊 Âm thanh: bật'),
    over: (score: number, best: number) => `Bạn được ${score} điểm · Kỷ lục ${best}`,
    hud: (score: number, seconds: number) => `${score} điểm · ${seconds}s`,
  },
  en: {
    title: 'Tap the Dot',
    intro: 'Tap the dot as many times as you can in 20 seconds!',
    play: '▶ Play',
    again: 'Play again',
    exit: '← Back to Tò He',
    paused: 'Paused',
    resume: '▶ Resume',
    mainMenu: '☰ Main menu',
    leaderboard: '🏆 Leaderboard',
    sound: (muted: boolean) => (muted ? '🔇 Sound: off' : '🔊 Sound: on'),
    over: (score: number, best: number) => `You scored ${score} · Best ${best}`,
    hud: (score: number, seconds: number) => `${score} pts · ${seconds}s`,
  },
};

const session = await connect<Saved>({ gameId: 'hello' });
const t = session.locale.startsWith('vi') ? text.vi : text.en;
const rng = createRng(session.seed);

const canvas = document.querySelector<HTMLCanvasElement>('#board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const overlay = document.querySelector<HTMLDivElement>('#overlay') as HTMLDivElement;
const overlayTitle = document.querySelector('#overlay-title') as HTMLElement;
const overlayDetail = document.querySelector('#overlay-detail') as HTMLElement;
const actions = document.querySelector('#actions') as HTMLElement;
const menuButton = document.querySelector<HTMLButtonElement>('#menu') as HTMLButtonElement;

let state: State = createState(session.saved?.best ?? 0);
/** What is on screen: the main menu, a round, the ☰ menu, or a finished round. */
let screen: 'main' | 'playing' | 'menu' | 'over' = 'main';
let paused = true;
let last = performance.now();

// ------------------------------------------------------------------ theme

// Light/dark follows the hub (ADR 0013). The page switches through CSS; the canvas reads the same design tokens,
// once per change.
let colors = readColors();
function readColors() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--tohe-${name}`).trim();
  return { arena: token('soft'), hud: token('accent'), dot: token('brand'), timer: token('line-strong') };
}
function showTheme(theme: Theme) {
  applyTheme(theme);
  colors = readColors();
}
showTheme(session.settings.theme);
session.on('settings', (settings) => showTheme(settings.theme));

// ------------------------------------------------------------------ sound

let audio: AudioContext | null = null;
function beep(): void {
  if (session.settings.muted) return;
  audio ??= new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 660 + Math.min(state.score, 30) * 20;
  gain.gain.setValueAtTime(0.15, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.12);
}

// ------------------------------------------------------------------ layout

/** The playfield is the largest centred square that fits; logic works in its 0..1 coordinates. */
function playfield() {
  const size = Math.min(canvas.clientWidth, canvas.clientHeight - 64) * 0.94;
  return { size, left: (canvas.clientWidth - size) / 2, top: 64 + (canvas.clientHeight - 64 - size) / 2 };
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

  ctx.fillStyle = colors.hud;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.hud(state.score, Math.ceil(state.timeLeftMs / 1000)), canvas.clientWidth / 2, 32);

  if (state.dot) {
    ctx.fillStyle = colors.dot;
    ctx.beginPath();
    ctx.arc(left + state.dot.x * size, top + state.dot.y * size, state.dot.r * size, 0, Math.PI * 2);
    ctx.fill();
  }

  const progress = state.timeLeftMs / ROUND_MS;
  ctx.fillStyle = colors.timer;
  ctx.fillRect(left, top - 8, size * progress, 4);
}

interface Action {
  label: string;
  onClick(): void;
  secondary?: boolean;
  /** `data-tohe-play` / `data-tohe-exit`: what conformance looks for (ADR 0018). */
  marker?: 'play' | 'exit';
}

/** A menu card over the board; the hub learns a menu is up (its answer to Back). */
function show(title: string, detail: string, list: Action[]): void {
  overlayTitle.textContent = title;
  overlayDetail.textContent = detail;
  actions.replaceChildren(
    ...list.map((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      if (action.secondary) button.className = 'secondary';
      if (action.marker) button.setAttribute(`data-tohe-${action.marker}`, '');
      button.addEventListener('click', action.onClick);
      return button;
    }),
  );
  overlay.hidden = false;
  menuButton.hidden = true;
  session.shell.menuChanged(true);
}

const leave = (): Action[] =>
  session.mode === 'embedded'
    ? [{ label: t.exit, secondary: true, marker: 'exit', onClick: () => session.exit() }]
    : [];

function mainMenu(): void {
  screen = 'main';
  paused = true;
  show(t.title, t.intro, [
    { label: t.play, marker: 'play', onClick: play },
    ...(session.shell.can.leaderboard
      ? [{ label: t.leaderboard, secondary: true, onClick: () => session.shell.open('leaderboard') }]
      : []),
    ...leave(),
  ]);
}

function backToPlay(): void {
  overlay.hidden = true;
  menuButton.hidden = false;
  screen = 'playing';
  paused = false;
  last = performance.now();
  session.shell.menuChanged(false);
}

function play(): void {
  backToPlay();
  state = start(state, rng);
}

function openMenu(): void {
  if (screen !== 'playing' && screen !== 'menu') return;
  screen = 'menu';
  paused = true;
  show(t.paused, '', [
    { label: t.resume, onClick: backToPlay },
    {
      label: t.sound(session.settings.muted),
      secondary: true,
      onClick: () => {
        session.shell.setMuted(!session.settings.muted);
        openMenu();
      },
    },
    { label: t.mainMenu, secondary: true, onClick: mainMenu },
    ...leave(),
  ]);
}

/** Phone Back and Escape: one step back, and out from the main menu. */
function back(): void {
  if (screen === 'playing') openMenu();
  else if (screen === 'menu') backToPlay();
  else if (screen === 'over') mainMenu();
  else if (session.mode === 'embedded') session.exit();
}

// ------------------------------------------------------------------ loop

function frame(now: number): void {
  const dt = now - last;
  last = now;
  if (!paused) {
    const before = state.phase;
    state = tick(state, dt);
    if (before === 'playing' && state.phase === 'over') void finish();
  }
  draw();
  requestAnimationFrame(frame);
}

async function finish(): Promise<void> {
  screen = 'over';
  paused = true;
  show(t.title, t.over(state.score, state.best), [
    { label: t.again, onClick: play },
    { label: t.mainMenu, secondary: true, onClick: mainMenu },
  ]);
  try {
    await session.submitScore(state.score);
    await session.save({ best: state.best });
  } catch (error) {
    session.log('warn', `could not store result: ${String(error)}`);
  }
}

// ------------------------------------------------------------------ input

canvas.addEventListener('pointerdown', (event) => {
  if (paused) return;
  const { size, left, top } = playfield();
  const result = tap(state, { x: (event.clientX - left) / size, y: (event.clientY - top) / size }, rng);
  state = result.state;
  if (result.hit) beep();
});

menuButton.addEventListener('click', openMenu);
session.on('menu', back);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') back();
});

// The hub hid the game (another app, a locked screen): the round waits in the menu.
session.on('pause', () => {
  if (screen === 'playing') openMenu();
});
session.on('resume', () => {
  // Stay paused until the player taps "resume" so nobody loses time on return.
  last = performance.now();
});

window.addEventListener('resize', resize);
resize();
mainMenu();
requestAnimationFrame(frame);
