// Layout helpers for a game that plays in portrait, in landscape and on a desktop (plans/asset-studio D-04). The game
// decides its own layout (`orientation` in game.json); the kit tells it the layout it is in — orientation, phone,
// tablet or desktop, the safe area — whenever it changes, and gives pure helpers to split the screen into a world
// view and a panel and to fit a camera to a world. Everything is in CSS pixels, like the kit's scenes.
import type Phaser from 'phaser';
import type { KitGame, Size } from './game.ts';

/** Space at each edge the game should keep its touch targets out of (notch, rounded corners, home bar). CSS pixels. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  /** The game's size in CSS pixels. */
  width: number;
  height: number;
  /** Landscape when wider than high; a square counts as portrait. */
  orientation: 'portrait' | 'landscape';
  form: 'phone' | 'tablet' | 'desktop';
  safe: Insets;
  /** The shorter and the longer side. */
  short: number;
  long: number;
}

/**
 * The short side from which a screen is a tablet (touch) or a desktop (mouse): 600 CSS pixels, the usual line
 * between a phone and a small tablet (a phone held sideways is still under it). Below it every screen is a phone,
 * a desktop window made small included — it has a phone's room.
 */
const WIDE_SHORT_SIDE = 600;

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The layout of a game of the given size. `pointer` is the primary pointer (`(pointer: fine)` is a mouse); without
 * it the screen counts as a touch screen.
 */
export function layoutOf(size: Size, safe: Insets, pointer: 'coarse' | 'fine' = 'coarse'): Layout {
  const { width, height } = size;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const wide = short >= WIDE_SHORT_SIDE;
  const form = !wide ? 'phone' : pointer === 'fine' ? 'desktop' : 'tablet';
  return { width, height, orientation: width > height ? 'landscape' : 'portrait', form, safe, short, long };
}

let probe: HTMLElement | null = null;

/** The safe area's insets now, read through a hidden element padded by `env(safe-area-inset-*)`. Zeros without one. */
export function readSafeArea(): Insets {
  if (typeof document === 'undefined' || !document.body) return { ...NO_INSETS };
  if (!probe || !probe.isConnected) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
      'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
}

function primaryPointer(): 'coarse' | 'fine' {
  return typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches ? 'fine' : 'coarse';
}

/**
 * Calls `listener` with the game's layout at once and again after every resize or rotation. Returns the unsubscribe
 * function.
 */
export function onLayout<S extends Phaser.Scene>(
  game: KitGame<S>,
  listener: (layout: Layout) => void,
): () => void {
  const emit = (size: Size) => listener(layoutOf(size, readSafeArea(), primaryPointer()));
  const off = game.onResize(emit);
  emit(game.size());
  return off;
}

export interface Split {
  world: Rect;
  panel: Rect;
  side: 'bottom' | 'right';
}

/**
 * Splits the safe area into a world view and a panel: the panel takes `panel` CSS pixels at the bottom in portrait
 * and at the right in landscape — no more than `maxPanel` and than half the side — and the world gets the rest.
 */
export function splitLayout(layout: Layout, options: { panel: number; maxPanel?: number }): Split {
  const { safe } = layout;
  const inner: Rect = {
    x: safe.left,
    y: safe.top,
    width: Math.max(0, layout.width - safe.left - safe.right),
    height: Math.max(0, layout.height - safe.top - safe.bottom),
  };
  const landscape = layout.orientation === 'landscape';
  const side = landscape ? inner.width : inner.height;
  const size = Math.max(0, Math.min(options.panel, options.maxPanel ?? Number.POSITIVE_INFINITY, side / 2));
  if (landscape) {
    return {
      world: { ...inner, width: inner.width - size },
      panel: { x: inner.x + inner.width - size, y: inner.y, width: size, height: inner.height },
      side: 'right',
    };
  }
  return {
    world: { ...inner, height: inner.height - size },
    panel: { x: inner.x, y: inner.y + inner.height - size, width: inner.width, height: size },
    side: 'bottom',
  };
}

export interface Fit {
  zoom: number;
  scrollX: number;
  scrollY: number;
}

/**
 * How to set a camera so that `world` (in world units) shows centred in `view` (CSS pixels): `contain` shows all of
 * it, `cover` fills the view and crops the rest; the zoom is clamped to `zoom.min` / `zoom.max`.
 *
 * The values are for a camera with its origin at (0, 0) and its viewport on `view`, so a world point x shows at
 * `view.x + (x - scrollX) × zoom`. The kit owns each scene's main camera (it keeps it at the device pixel ratio), so
 * use a camera of your own: `scene.cameras.add(view.x × dpr, view.y × dpr, view.width × dpr, view.height × dpr)`,
 * `setOrigin(0, 0)`, `setZoom(zoom × dpr)`, `setScroll(scrollX, scrollY)`.
 */
export function fitWorld(
  world: Rect,
  view: Rect,
  mode: 'contain' | 'cover',
  zoom: { min?: number; max?: number } = {},
): Fit {
  let fit = 1;
  if (world.width > 0 && world.height > 0) {
    const across = view.width / world.width;
    const down = view.height / world.height;
    fit = mode === 'contain' ? Math.min(across, down) : Math.max(across, down);
  }
  if (zoom.max !== undefined) fit = Math.min(fit, zoom.max);
  if (zoom.min !== undefined) fit = Math.max(fit, zoom.min);
  if (!(fit > 0)) fit = 1;
  return {
    zoom: fit,
    scrollX: world.x + world.width / 2 - view.width / fit / 2,
    scrollY: world.y + world.height / 2 - view.height / fit / 2,
  };
}
