// View + wiring: turns pointer input into logic actions, draws state on a canvas, talks to the hub via the SDK.
import { connect, createRng } from '@tohe/game-sdk';
import { createState, ROUND_MS, type State, start, tap, tick } from './logic.ts';

interface Saved {
  best: number;
}

const text = {
  vi: {
    title: 'Chạm Chấm',
    intro: 'Chạm vào chấm tròn càng nhiều càng tốt trong 20 giây!',
    play: 'Chơi',
    again: 'Chơi lại',
    exit: 'Thoát',
    paused: 'Tạm dừng',
    resume: 'Tiếp tục',
    over: (score: number, best: number) => `Bạn được ${score} điểm · Kỷ lục ${best}`,
    hud: (score: number, seconds: number) => `${score} điểm · ${seconds}s`,
  },
  en: {
    title: 'Tap the Dot',
    intro: 'Tap the dot as many times as you can in 20 seconds!',
    play: 'Play',
    again: 'Play again',
    exit: 'Exit',
    paused: 'Paused',
    resume: 'Resume',
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
const primary = document.querySelector<HTMLButtonElement>('#primary') as HTMLButtonElement;
const exit = document.querySelector<HTMLButtonElement>('#exit') as HTMLButtonElement;

let state: State = createState(session.saved?.best ?? 0);
let paused = false;
let last = performance.now();

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

  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.roundRect(left, top, size, size, 24);
  ctx.fill();

  ctx.fillStyle = '#9a3412';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.hud(state.score, Math.ceil(state.timeLeftMs / 1000)), canvas.clientWidth / 2, 32);

  if (state.dot) {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(left + state.dot.x * size, top + state.dot.y * size, state.dot.r * size, 0, Math.PI * 2);
    ctx.fill();
  }

  const progress = state.timeLeftMs / ROUND_MS;
  ctx.fillStyle = '#fdba74';
  ctx.fillRect(left, top - 8, size * progress, 4);
}

function showOverlay(title: string, detail: string, action: string): void {
  overlayTitle.textContent = title;
  overlayDetail.textContent = detail;
  primary.textContent = action;
  exit.textContent = t.exit;
  exit.hidden = session.mode === 'standalone';
  overlay.hidden = false;
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
  showOverlay(t.title, t.over(state.score, state.best), t.again);
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

primary.addEventListener('click', () => {
  overlay.hidden = true;
  if (paused) {
    paused = false;
    return;
  }
  state = start(state, rng);
});

exit.addEventListener('click', () => session.exit());

session.on('pause', () => {
  if (state.phase !== 'playing' || paused) return;
  paused = true;
  showOverlay(t.paused, '', t.resume);
});
session.on('resume', () => {
  // Stay paused until the player taps "resume" so nobody loses time on return.
  last = performance.now();
});

window.addEventListener('resize', resize);
resize();
showOverlay(t.title, t.intro, t.play);
requestAnimationFrame(frame);
