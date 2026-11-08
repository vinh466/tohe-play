// The pre-play screen (the shell's prePlay hook): the four modes and the Workshop, shown before a game from the
// title screen or the in-game panel. The shell owns the screen's Back — the title or the panel — so phone Back,
// Escape and the corner all do the same thing. A mode with a saved run leads with "Chơi tiếp"; its "Ván mới" is a
// small second action behind a confirmation, so a family can hold several runs without losing one by accident.
import { icon as kitIcon, type OverlayCard, type Theme } from '@tohe/game-kit';
import { levelFor, localDate, savedRun, store } from './app.ts';
import type { Mode } from './logic.ts';
import type { PaletteId } from './palette.ts';
import type { Strings } from './strings.ts';
import { workshopContent } from './workshop.ts';

export interface ModeSelectOptions {
  t: Strings;
  choose(id: string, fresh?: boolean): void;
  inProgress: boolean;
  show(card: Omit<OverlayCard, 'layout' | 'corner'>): void;
  theme: Theme;
  onPalette(id: PaletteId): void;
  /** A number in the player's digits (the shell's formatter). */
  format(value: number): string;
}

const MODE_ICONS: Record<Mode, string> = {
  // A little trophy for the ranked classic.
  classic:
    '<path d="M8 4h8v3a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3" fill="none"/><path d="M12 11v4M9 19h6M10 15h4v4h-4z"/>',
  // A shift's order rail: three lines and a check.
  orders:
    '<path d="M5 5h14v14H5z" fill="none"/><path d="M8 9h8M8 12h6M8 15h3"/><path d="M15 15l2 2 3-3" fill="none"/>',
  // Today: a sun over a calendar.
  daily:
    '<circle cx="12" cy="10" r="4"/><path d="M12 2v2M12 16v2M4 10H2M22 10h-2M5.6 3.6 7 5M17 5l1.4-1.4M5.6 16.4 7 15M17 15l1.4 1.4" fill="none"/><path d="M4 18h16v4H4z"/>',
  // A leaf for the pressure-free round.
  zen: '<path d="M20 4C10 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z"/><path d="M5 20c2-5 6-8 11-10" fill="none"/>',
};

const DISPLAY_MODES: readonly Mode[] = ['orders', 'classic', 'daily', 'zen'];

const MODE_CLASS: Record<Mode, string> = {
  classic: 'is-classic',
  orders: 'is-orders',
  daily: 'is-daily',
  zen: 'is-zen',
};

function icon(name: Mode): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('mode-choice-icon');
  svg.innerHTML = `<g fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${MODE_ICONS[name]}</g>`;
  return svg;
}

function gearIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('mode-choice-icon');
  svg.innerHTML =
    '<g fill="currentColor"><path d="M12 2l1.2 2.1 2.4-.5.6 2.4 2.4.6-.5 2.4L20 12l-1.9 1.9.5 2.4-2.4.6-.6 2.4-2.4-.4L12 22l-1.2-2.1-2.4.5-.6-2.4-2.4-.6.5-2.4L4 12l1.9-1.9-.5-2.4 2.4-.6.6-2.4 2.4.4L12 2Z"/><circle cx="12" cy="12" r="3.4" fill="var(--tohe-soft)"/></g>';
  return svg;
}

function modeLine(t: Strings, mode: Mode): string {
  if (mode === 'orders') return t.modes.ordersLine;
  if (mode === 'classic') return t.modes.classicLine;
  if (mode === 'daily') return t.modes.dailyLine;
  return t.modes.zenLine;
}

function modeMeta(t: Strings, mode: Mode, format: (value: number) => string): string {
  const live = savedRun(mode);
  if (live) return t.modes.inProgress(format(live.score));
  if (mode === 'orders') {
    const best = store.bests.orders;
    return best > 0 ? t.modes.bestLine(format(best)) : t.modes.freshLine;
  }
  if (mode === 'classic') {
    return store.best > 0 ? t.modes.bestLine(format(store.best)) : t.modes.freshLine;
  }
  if (mode === 'daily') {
    const daily = store.daily;
    const today = localDate();
    if (daily && daily.date === today) {
      return t.daily.card(today, daily.streak, daily.best > 0 ? format(daily.best) : null);
    }
    return t.modes.dailyMeta;
  }
  return t.modes.zenMeta;
}

function freshLabel(t: Strings, mode: Mode): string {
  return mode === 'daily' ? t.modes.freshDaily : t.modes.fresh;
}

/** The small "Ván mới" under a saved run, behind a confirmation that names the run it replaces. */
function confirmFresh(
  t: Strings,
  mode: Mode,
  choose: (id: string, fresh?: boolean) => void,
  show: (card: Omit<OverlayCard, 'layout' | 'corner'>) => void,
): void {
  show({
    icon: 'arrow-counter-clockwise',
    title: t.modes.freshTitle,
    body: t.modes.freshBody(t.modeNames[mode]),
    actions: [
      {
        label: freshLabel(t, mode),
        icon: 'arrow-counter-clockwise',
        variant: 'primary',
        onClick: () => choose(mode, true),
      },
    ],
  });
}

function headBadges(t: Strings, mode: Mode, saved: boolean): HTMLElement[] {
  const badges: HTMLElement[] = [];
  if (mode === 'classic') badges.push(badge(t.modes.ranked, 'is-ranked'));
  if (saved) badges.push(badge(t.modes.resume, 'is-resume'));
  else if (mode === 'orders' && store.bests.orders === 0) badges.push(badge(t.modes.startHere, 'is-start'));
  return badges;
}

function badge(label: string, className: string): HTMLElement {
  const node = document.createElement('span');
  node.className = `mode-choice-badge ${className}`;
  node.textContent = label;
  return node;
}

function choiceButton(
  t: Strings,
  mode: Mode,
  choose: (id: string, fresh?: boolean) => void,
  format: (value: number) => string,
  show: (card: Omit<OverlayCard, 'layout' | 'corner'>) => void,
): { card: HTMLElement; saved: boolean } {
  const savedState = savedRun(mode);
  const saved = savedState !== null;
  const card = document.createElement('div');
  card.className = `mode-choice ${MODE_CLASS[mode]}`;
  if (saved) card.dataset.saved = 'true';

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'mode-choice-main';
  // The first card is the first run's default, so the shell's Play marker leads there from the how-to.
  if (mode === 'orders') main.dataset.tohePlay = '';

  const mark = document.createElement('span');
  mark.className = 'mode-choice-mark';
  mark.append(icon(mode));

  const words = document.createElement('span');
  words.className = 'mode-choice-words';
  const head = document.createElement('span');
  head.className = 'mode-choice-head';
  const name = document.createElement('strong');
  name.textContent = t.modeNames[mode];
  head.append(name, ...headBadges(t, mode, saved));
  const line = document.createElement('span');
  line.className = 'mode-choice-line';
  line.textContent = modeLine(t, mode);
  const meta = document.createElement('span');
  meta.className = 'mode-choice-meta';
  const live = savedState ? t.modes.inProgress(format(savedState.score)) : null;
  meta.textContent =
    mode === 'daily' && live && store.daily
      ? `${live} · ${t.daily.streak(store.daily.streak)}`
      : (live ?? modeMeta(t, mode, format));
  words.append(head, line, meta);

  main.append(mark, words, kitIcon('caret-right', 'tohe-svg mode-choice-chevron'));
  main.addEventListener('click', () => choose(mode, !saved));
  card.append(main);

  if (saved) {
    const foot = document.createElement('div');
    foot.className = 'mode-choice-foot';
    const fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.className = 'mode-choice-fresh';
    fresh.append(
      kitIcon('arrow-counter-clockwise', 'tohe-svg'),
      document.createTextNode(freshLabel(t, mode)),
    );
    fresh.addEventListener('click', () => confirmFresh(t, mode, choose, show));
    foot.append(fresh);
    card.append(foot);
  }
  return { card, saved };
}

/** The pre-play content: the four modes, then the Workshop; `show` opens the Workshop or a fresh-run question. */
export function modeSelectContent(options: ModeSelectOptions): HTMLElement {
  const { t } = options;
  const root = document.createElement('div');
  root.className = 'mode-choice-list';

  if (options.inProgress) {
    const note = document.createElement('p');
    note.className = 'mode-choice-note';
    note.textContent = t.modes.busy;
    root.append(note);
  }

  for (const mode of DISPLAY_MODES) {
    root.append(choiceButton(t, mode, options.choose, options.format, options.show).card);
  }

  const workshop = document.createElement('div');
  workshop.className = 'mode-choice is-workshop';
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'mode-choice-main';
  const mark = document.createElement('span');
  mark.className = 'mode-choice-mark';
  mark.append(gearIcon());
  const words = document.createElement('span');
  words.className = 'mode-choice-words';
  const head = document.createElement('span');
  head.className = 'mode-choice-head';
  const name = document.createElement('strong');
  name.textContent = t.workshop.title;
  head.append(name);
  const line = document.createElement('span');
  line.className = 'mode-choice-line';
  line.textContent = t.modes.workshopLine;
  const meta = document.createElement('span');
  meta.className = 'mode-choice-meta';
  meta.textContent = t.modes.workshopMeta(
    String(store.workshop.scrap),
    t.workshop.levelName(levelFor(store.workshop.xp)),
  );
  words.append(head, line, meta);
  main.append(mark, words, kitIcon('caret-right', 'tohe-svg mode-choice-chevron'));
  main.addEventListener('click', () => {
    options.show({
      icon: 'gear-six',
      title: t.workshop.title,
      content: workshopContent({
        t,
        theme: options.theme,
        palette: store.palette,
        onPalette: options.onPalette,
      }),
      actions: [],
    });
  });
  workshop.append(main);
  root.append(workshop);
  return root;
}
