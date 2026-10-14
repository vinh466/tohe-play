// A frame-rate readout for testing on real phones, where there are no dev tools: open a game with `#perf` at the
// end of its address (in the hub: add `?perf` to the play page's address, the hub passes it on). Every second it
// shows the frame rate, the slowest frame, the time Phaser itself needs per frame, and what draws the game.
// Only types from Phaser, so the rules here can be tested without a browser.
import type Phaser from 'phaser';

/** Phaser's game events around one frame (Phaser.Core.Events.PRE_STEP and POST_RENDER). */
const PRE_STEP = 'prestep';
const POST_RENDER = 'postrender';

/** The address ends in `#perf` (or has `perf` among `&`-separated hash words). */
export function perfWanted(hash = window.location.hash): boolean {
  return /(^#|&)perf(&|$)/.test(hash);
}

export interface PerfReadout {
  /** Measure this game (again after the kit restarted it with another renderer). */
  attach(game: Phaser.Game, renderer: 'webgl' | 'canvas'): void;
}

export function createPerfReadout(parent: HTMLElement, dpr: number): PerfReadout {
  const box = document.createElement('div');
  box.className = 'tohe-perf';
  parent.append(box);

  let frames: number[] = [];
  let steps: number[] = [];
  let stepStart = 0;
  let detach = () => {};

  return {
    attach(game, renderer) {
      detach();
      frames = [];
      steps = [];
      const gpu = renderer === 'webgl' ? gpuName(game) : '';
      const onPreStep = () => {
        stepStart = performance.now();
      };
      const onPostRender = () => {
        const now = performance.now();
        frames.push(now);
        steps.push(now - stepStart);
      };
      game.events.on(PRE_STEP, onPreStep);
      game.events.on(POST_RENDER, onPostRender);
      const timer = window.setInterval(() => {
        const gaps = frames.slice(1).map((t, i) => t - (frames[i] as number));
        const span = (frames[frames.length - 1] ?? 0) - (frames[0] ?? 0);
        const fps = span > 0 ? (1000 * gaps.length) / span : 0;
        const typical = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
        // A frame that took over 1.5× the usual time is one the player sees as a hitch.
        const hitches = gaps.filter((g) => g > typical * 1.5).length;
        const mean = steps.reduce((a, b) => a + b, 0) / Math.max(1, steps.length);
        const canvas = game.canvas;
        box.textContent = [
          `${fps.toFixed(0)} fps · slowest ${Math.max(0, ...gaps).toFixed(0)} ms · hitches ${hitches}`,
          `phaser ${mean.toFixed(1)} ms (max ${Math.max(0, ...steps).toFixed(1)}) · ${renderer} · dpr ${dpr.toFixed(2)} · ${canvas?.width}×${canvas?.height}`,
          ...(gpu ? [gpu] : []),
        ].join('\n');
        frames = frames.slice(-1);
        steps = [];
      }, 1000);
      detach = () => {
        window.clearInterval(timer);
        game.events.off(PRE_STEP, onPreStep);
        game.events.off(POST_RENDER, onPostRender);
      };
    },
  };
}

function gpuName(game: Phaser.Game): string {
  const gl = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | null)?.gl;
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
}
