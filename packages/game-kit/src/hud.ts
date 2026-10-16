// The HUD at the top of every game (ADR 0019): ☰ first, always in the same place and look, then the game's numbers.
// A game fills the start (its score), the centre (its own: the next block, a rescue button) and the end (the best
// score, a button); the kit draws the boxes, counts scores up, shortens one that does not fit and lights up a record.
// The sides share the row equally; a game whose sides differ in width (a score on one, buttons on the other) sets its
// own `grid-template-columns` on `.tohe-hud` (Tiến Lên does).
import { formatCompact, formatScore } from './format.ts';
import type { Shell } from './shell.ts';

export interface StatOptions {
  /** Where the box goes: the start (after ☰) or the end. Default: the start. */
  place?: 'start' | 'end';
  /** Writes the value (e.g. "+3"); by default the locale's digits, shortened ("56,4M") when the box is too narrow. */
  format?(value: number): string;
}

export interface Stat {
  readonly element: HTMLElement;
  /** The value on screen, which trails the real one while it counts up. */
  readonly shown: number;
  /** Shows a value; `animate` counts up to it (and pops the box when it grows). */
  set(value: number, animate?: boolean): void;
  setLabel(label: string): void;
}

export interface ScoreBoard {
  readonly score: Stat;
  readonly best: Stat;
  /** The score now: the best box follows it once it passes the best score, and lights up (a record). */
  set(score: number, animate?: boolean): void;
  /** The best score before this game (saved with the player). */
  setBest(best: number): void;
}

export interface Hud {
  readonly element: HTMLElement;
  readonly start: HTMLElement;
  readonly center: HTMLElement;
  readonly end: HTMLElement;
  /** A number in a box. */
  stat(label: string, options?: StatOptions): Stat;
  /** The score at the start and the best score at the end, the pair most games show. */
  score(labels: { score: string; best: string }): ScoreBoard;
}

export interface HudOptions {
  /** The shell, for its ☰. */
  shell: Pick<Shell, 'menuButton'>;
  /** The game's root: the HUD goes first in it. */
  parent: HTMLElement;
  locale: string;
}

/** How long a value counts up. */
const COUNT_MS = 380;

export function createHud({ shell, parent, locale }: HudOptions): Hud {
  const element = node('header', 'tohe-hud');
  const start = node('div', 'tohe-hud-start');
  const center = node('div', 'tohe-hud-center');
  const end = node('div', 'tohe-hud-end');
  element.append(shell.menuButton(), start, center, end);
  parent.prepend(element);

  const stat = (label: string, options: StatOptions = {}, best = false): Stat => {
    const zone = options.place === 'end' ? end : start;
    const box = node('div', best ? 'tohe-stat tohe-stat-best' : 'tohe-stat');
    const labelNode = node('span', 'tohe-stat-label');
    const text = node('span', 'tohe-stat-label-text', label);
    if (best) {
      const crown = node('span', 'tohe-stat-crown', '👑');
      crown.setAttribute('aria-hidden', 'true');
      labelNode.append(crown);
    }
    labelNode.append(text);
    const value = node('span', 'tohe-stat-value', '0');
    box.append(labelNode, value);
    zone.append(box);

    const fit = fitter(zone, box, value);
    const write = (n: number) => {
      value.textContent = options.format ? options.format(n) : fitScore(n, locale, fit.fits);
    };
    let shown = 0;
    let target = 0;
    let frame = 0;
    fit.onChange(() => write(shown));
    const result: Stat & { onFrame?: (n: number) => void } = {
      element: box,
      get shown() {
        return shown;
      },
      set(next, animate = false) {
        cancelAnimationFrame(frame);
        const from = shown;
        target = next;
        if (!animate || from === next) {
          shown = next;
          write(shown);
          result.onFrame?.(shown);
          return;
        }
        if (next > from) bump(box);
        const began = performance.now();
        const step = (now: number) => {
          shown = countUp(from, target, (now - began) / COUNT_MS);
          write(shown);
          result.onFrame?.(shown);
          if (shown !== target) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      setLabel(next) {
        text.textContent = next;
      },
    };
    return result;
  };

  return {
    element,
    start,
    center,
    end,
    stat: (label, options) => stat(label, options),
    score(labels) {
      const score = stat(labels.score) as Stat & { onFrame?: (n: number) => void };
      const best = stat(labels.best, { place: 'end' }, true);
      let before = 0;
      const follow = (shown: number) => {
        best.set(Math.max(before, shown));
        best.element.classList.toggle('is-record', shown > before && before > 0);
      };
      score.onFrame = follow;
      return {
        score,
        best,
        set: (value, animate) => score.set(value, animate),
        setBest(value) {
          before = value;
          follow(score.shown);
        },
      };
    },
  };
}

/** A short pop of an element (a HUD box, a button), restarted if it is already popping. */
export function bump(element: HTMLElement): void {
  element.classList.remove('tohe-bump');
  void element.offsetWidth; // restart the CSS animation
  element.classList.add('tohe-bump');
}

/** Where a value counting from `from` to `to` is after `progress` (0…1) of the time: fast first, then settling. */
export function countUp(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * (1 - (1 - p) ** 3));
}

/** The longest form of a score that fits: in full ("1.234.567") while it does, then shortened ("1,23M"). */
export function fitScore(value: number, locale: string, fits: (text: string) => boolean): string {
  const full = formatScore(value, locale);
  if (fits(full)) return full;
  for (let chars = full.length - 1; chars > 3; chars--) {
    const text = formatCompact(value, locale, chars);
    if (fits(text)) return text;
  }
  return formatCompact(value, locale, 3);
}

/** A fresh id for a game's run on the leaderboard (ADR 0014). `crypto.randomUUID` needs a secure context, which a
 * home server on plain HTTP is not. */
export function newRunId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Whether a text fits a stat's box: the box may take its whole column (the zone) minus its padding, measured in the
 * value's own font. Measured again when the column changes size or the fonts arrive.
 */
function fitter(zone: HTMLElement, box: HTMLElement, value: HTMLElement) {
  const measure = document.createElement('canvas').getContext('2d');
  let room = Number.POSITIVE_INFINITY;
  const listeners: (() => void)[] = [];
  const update = () => {
    if (!measure || !zone.isConnected) return;
    const boxStyle = getComputedStyle(box);
    const font = getComputedStyle(value);
    measure.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    // A little margin: the canvas measures proportional digits, the HUD shows tabular ones.
    const next =
      (zone.clientWidth -
        Number.parseFloat(boxStyle.paddingLeft) -
        Number.parseFloat(boxStyle.paddingRight)) *
      0.95;
    if (next === room || !Number.isFinite(next) || next <= 0) return;
    room = next;
    for (const listener of listeners) listener();
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(zone);
  void document.fonts?.ready.then(update);
  return {
    fits: (text: string) => !measure || measure.measureText(text).width <= room,
    onChange: (listener: () => void) => listeners.push(listener),
  };
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
