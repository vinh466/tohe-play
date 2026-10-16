// The play stage (ADR 0020): a Canvas 2D playfield, the kit's HUD and 20-second rounds. Pointer input becomes logic
// actions; the state is drawn every frame. leave() stops the frame loop and the listeners start() added.
import { createHud, type PlayStage, type StageContext } from '@tohe/game-kit';
import { persist, rng, session, sfx, store, t } from './app.ts';
import { createState, ROUND_MS, type State, start as startRound, tap, tick } from './logic.ts';

export function start(ctx: StageContext): PlayStage {
  const template = document.querySelector<HTMLTemplateElement>('#play-stage') as HTMLTemplateElement;
  ctx.root.append(template.content.cloneNode(true));
  const canvas = ctx.root.querySelector<HTMLCanvasElement>('#board') as HTMLCanvasElement;
  const draw2d = canvas.getContext('2d') as CanvasRenderingContext2D;

  let state: State = createState(store.best);
  /** The best score when the round began: beating it is a record. */
  let bestBefore = state.best;
  /** The round's clock stops while the panel is over it. */
  let paused = false;
  let last = performance.now();
  let frameId = 0;

  // ☰ | score | seconds left | best.
  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale: session.locale });
  const scores = hud.score({ score: t.score, best: t.best });
  scores.setBest(state.best);
  const clock = document.createElement('span');
  clock.className = 'clock';
  hud.center.append(clock);
  function showClock() {
    clock.textContent = `⏱ ${Math.ceil(state.timeLeftMs / 1000)}`;
    clock.classList.toggle('is-low', state.phase === 'playing' && state.timeLeftMs <= 5000);
  }

  // The canvas reads the design tokens (light/dark, ADR 0013) after every theme change.
  let colors = readColors();
  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(`--tohe-${name}`).trim();
    return { arena: token('soft'), dot: token('brand'), timer: token('line-strong') };
  }
  const offTheme = session.on('settings', () => {
    colors = readColors();
  });

  /** The playfield is the largest centred square that fits; logic works in its 0..1 coordinates. */
  function playfield() {
    const size = Math.min(canvas.clientWidth, canvas.clientHeight - 24) * 0.94;
    return { size, left: (canvas.clientWidth - size) / 2, top: 24 + (canvas.clientHeight - 24 - size) / 2 };
  }
  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    draw2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(): void {
    const { size, left, top } = playfield();
    draw2d.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    draw2d.fillStyle = colors.arena;
    draw2d.beginPath();
    draw2d.roundRect(left, top, size, size, 24);
    draw2d.fill();
    if (state.dot) {
      draw2d.fillStyle = colors.dot;
      draw2d.beginPath();
      draw2d.arc(left + state.dot.x * size, top + state.dot.y * size, state.dot.r * size, 0, Math.PI * 2);
      draw2d.fill();
    }
    draw2d.fillStyle = colors.timer;
    draw2d.fillRect(left, top - 12, size * (state.timeLeftMs / ROUND_MS), 4);
  }

  function newRound(): void {
    state = startRound(state, rng);
    bestBefore = state.best;
    scores.setBest(state.best);
    scores.set(0);
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
    frameId = requestAnimationFrame(frame);
  }

  async function finish(): Promise<void> {
    const record = state.score > bestBefore;
    store.best = state.best;
    sfx.play(record ? 'fanfare' : 'drop');
    ctx.gameOver({
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

  canvas.addEventListener('pointerdown', (event) => {
    if (paused || ctx.overlay.visible) return;
    const rect = canvas.getBoundingClientRect();
    const { size, left, top } = playfield();
    const point = {
      x: (event.clientX - rect.left - left) / size,
      y: (event.clientY - rect.top - top) / size,
    };
    const result = tap(state, point, rng);
    state = result.state;
    if (result.hit) {
      sfx.play('pop', Math.min(state.score, 20));
      scores.set(state.score, true);
    }
  });
  window.addEventListener('resize', resize);

  resize();
  newRound();
  draw();
  frameId = requestAnimationFrame(frame);
  ctx.ready();

  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      // The time behind the panel is not the round's.
      last = performance.now();
    },
    newGame: newRound,
    leave() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      offTheme();
    },
  };
}
