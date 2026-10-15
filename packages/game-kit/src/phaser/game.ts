// A Phaser game that is crisp on phones. Phaser has no global resolution setting, so the canvas is created at
// device pixels (CSS size × DPR) and shown at CSS size (scale.zoom = 1/DPR); every scene's main camera is zoomed by
// DPR with its origin at the top-left, so scenes lay out in CSS pixels and pointer.worldX/Y are CSS pixels too.
// Measured in docs/research/game-tech.md.
import type { Telemetry } from '@tohe/game-sdk';
import Phaser from 'phaser';
import { attachFrameMeter, type FrameMeter } from './frames.ts';
import { createPerfReadout, perfWanted } from './perf.ts';

export interface Size {
  width: number;
  height: number;
}

export interface KitGame<S extends Phaser.Scene> {
  /** The running Phaser game (replaced if the kit had to fall back to the Canvas renderer). */
  readonly game: Phaser.Game;
  /** The running scene instance (replaced together with the game). */
  readonly scene: S;
  readonly renderer: 'webgl' | 'canvas';
  /** Device pixel ratio the canvas renders at (capped at 3). */
  readonly dpr: number;
  /** Current size in CSS pixels. */
  size(): Size;
  /** Called after every resize/rotation with the new CSS size. Returns an unsubscribe function. */
  onResize(listener: (size: Size) => void): () => void;
  /**
   * Called when the game was restarted with a new scene instance (WebGL failed while booting and the kit fell
   * back to Canvas). Redraw the current state on the new scene.
   */
  onRestart(listener: (scene: S) => void): () => void;
  /** Background colour behind every scene, e.g. when the theme changes. */
  setBackground(color: string): void;
  /** Pause / resume every running scene (update loop, tweens, timers). */
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface KitGameOptions<S extends Phaser.Scene> {
  parent: HTMLElement;
  background: string;
  /** Called once, and again if the game has to be restarted with another renderer. */
  createScene(): S;
  /**
   * The session's telemetry (`session.telemetry`, ADR 0015). With it the kit reports the renderer, a WebGL fallback
   * or lost context, how long the first frame took, and a summary of frame times every minute of play.
   */
  telemetry?: Telemetry;
}

const RESIZE = 'tohe-kit-resize';
/** How long after booting a renderer failure still triggers the Canvas fallback. */
const BOOT_WINDOW_MS = 8000;

export function createGame<S extends Phaser.Scene>({
  parent,
  background: initialBackground,
  createScene,
  telemetry,
}: KitGameOptions<S>): KitGame<S> {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let background = initialBackground;
  let size: Size = measure(parent);
  let renderer: 'webgl' | 'canvas' = webglWorks() ? 'webgl' : 'canvas';
  let scene = createScene();
  let game = boot();
  // Telemetry: the renderer each game started with, lost WebGL contexts, the first frame, and frame times.
  let meter: FrameMeter | null = null;
  const watch = (target: Phaser.Game) => {
    if (!telemetry?.enabled) return;
    telemetry.count(`kit.renderer.${renderer}`);
    target.canvas?.addEventListener('webglcontextlost', () => telemetry.count('kit.webgl.context-lost'));
    meter?.detach();
    meter = attachFrameMeter(target, telemetry, renderer);
  };
  watch(game);
  if (telemetry?.enabled) {
    game.events.once(Phaser.Core.Events.POST_RENDER, () =>
      telemetry.metric('kit.first-frame-ms', Math.round(performance.now())),
    );
  }
  // Opened with #perf: a frame-rate readout for testing on phones (perf.ts).
  const perf = perfWanted() ? createPerfReadout(parent, dpr) : null;
  perf?.attach(game, renderer);
  const resizeListeners = new Set<(size: Size) => void>();
  const restartListeners = new Set<(scene: S) => void>();

  function boot(): Phaser.Game {
    const created = new Phaser.Game({
      type: renderer === 'webgl' ? Phaser.WEBGL : Phaser.CANVAS,
      parent,
      backgroundColor: background,
      banner: false,
      disableContextMenu: true,
      audio: { noAudio: true },
      input: { activePointers: 2 },
      render: { antialias: true, roundPixels: false },
      scale: {
        mode: Phaser.Scale.NONE,
        width: Math.round(size.width * dpr),
        height: Math.round(size.height * dpr),
        zoom: 1 / dpr,
      },
      scene,
    });
    created.registry.set('dpr', dpr);
    created.events.once(Phaser.Core.Events.READY, () => applyCameras(created));
    created.events.on(Phaser.Core.Events.POST_STEP, () => {
      // Scenes started later get their camera set up on their first frame.
      for (const active of created.scene.getScenes(true)) {
        if (active.cameras?.main && active.cameras.main.zoom !== dpr) applyCameras(created);
      }
    });
    return created;
  }

  function applyCameras(target: Phaser.Game) {
    for (const active of target.scene.getScenes(false)) {
      const camera = active.cameras?.main;
      if (!camera) continue;
      camera.setSize(Math.round(size.width * dpr), Math.round(size.height * dpr));
      camera.setOrigin(0, 0);
      camera.setZoom(dpr);
      camera.setScroll(0, 0);
      // The camera paints the background, so it can change after boot (the game config cannot).
      camera.setBackgroundColor(background);
    }
  }

  // Phaser 4 recovers from a WebGL context lost mid-game, but not from one lost while it boots (compiling its
  // shaders): it either throws "… Shader failed" or reports the context restored while drawing nothing, and the
  // canvas stays black. Either sign during the first seconds restarts the game once with the Canvas renderer.
  const booted = performance.now();
  const fallBack = () => {
    if (renderer !== 'webgl' || performance.now() - booted > BOOT_WINDOW_MS) return;
    renderer = 'canvas';
    setTimeout(() => {
      // Phaser destroys on its next frame, which a broken game may never reach: stop it and drop its canvas now.
      const broken = game;
      broken.loop.stop();
      broken.canvas?.remove();
      broken.destroy(true);
      scene = createScene();
      game = boot();
      perf?.attach(game, renderer);
      telemetry?.count('kit.renderer.fallback');
      watch(game);
      for (const listener of restartListeners) listener(scene);
    });
  };
  const onBootError = (event: ErrorEvent | PromiseRejectionEvent) => {
    const message = event instanceof ErrorEvent ? event.message : String(event.reason);
    if (renderer !== 'webgl' || !/shader failed|webgl/i.test(message)) return;
    event.preventDefault();
    fallBack();
  };
  window.addEventListener('error', onBootError);
  window.addEventListener('unhandledrejection', onBootError);
  game.canvas?.addEventListener('webglcontextlost', fallBack, { once: true });
  setTimeout(() => {
    window.removeEventListener('error', onBootError);
    window.removeEventListener('unhandledrejection', onBootError);
    game.canvas?.removeEventListener('webglcontextlost', fallBack);
  }, BOOT_WINDOW_MS);

  const observer = new ResizeObserver(() => {
    const next = measure(parent);
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    game.scale.resize(Math.round(size.width * dpr), Math.round(size.height * dpr));
    game.scale.setZoom(1 / dpr);
    applyCameras(game);
    game.events.emit(RESIZE, size);
    for (const listener of resizeListeners) listener(size);
  });
  observer.observe(parent);

  return {
    get game() {
      return game;
    },
    get scene() {
      return scene;
    },
    get renderer() {
      return renderer;
    },
    dpr,
    size: () => size,
    onResize(listener) {
      resizeListeners.add(listener);
      return () => resizeListeners.delete(listener);
    },
    onRestart(listener) {
      restartListeners.add(listener);
      return () => restartListeners.delete(listener);
    },
    setBackground(color) {
      background = color;
      applyCameras(game);
    },
    pause() {
      for (const active of game.scene.getScenes(true)) active.scene.pause();
      meter?.pause();
    },
    resume() {
      for (const active of game.scene.getScenes(false)) if (active.scene.isPaused()) active.scene.resume();
      meter?.resume();
    },
    destroy() {
      meter?.detach();
      observer.disconnect();
      window.removeEventListener('error', onBootError);
      game.destroy(true);
    },
  };
}

/**
 * Compiles and links a tiny shader program in a throwaway context. Some devices expose WebGL but fail on first
 * use (blocklisted GPUs, software rendering that times out — seen with headless Chrome, where the first context
 * of a browser was lost while Phaser compiled its shaders and the game stayed black). Doing this once first both
 * detects a broken WebGL and warms up a slow one; on failure the game uses Phaser's Canvas renderer.
 */
export function webglWorks(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl || gl.isContextLost()) return false;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type) as WebGLShader;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram() as WebGLProgram;
    gl.attachShader(
      program,
      shader(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}'),
    );
    gl.attachShader(
      program,
      shader(gl.FRAGMENT_SHADER, 'precision mediump float;void main(){gl_FragColor=vec4(1.0);}'),
    );
    gl.linkProgram(program);
    const ok = gl.getProgramParameter(program, gl.LINK_STATUS) === true && !gl.isContextLost();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

function measure(element: HTMLElement): Size {
  const rect = element.getBoundingClientRect();
  return { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
}

/** Text rendered at the device pixel ratio, so it stays sharp under the zoomed camera. */
export function crispText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const dpr = (scene.registry.get('dpr') as number | undefined) ?? 1;
  return scene.add.text(x, y, text, { fontFamily: 'system-ui, sans-serif', ...style }).setResolution(dpr);
}
