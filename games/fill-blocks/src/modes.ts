// The pre-play screen (the shell's `prePlay` hook): the three ways to play, with the state of each run, so changing
// mode is a choice and not a loss — a run of another mode is parked and shown here until the player comes back to it.
import { type IconName, icon as kitIcon, type OverlayCard } from '@tohe/game-kit';
import { journeyStars, parkedRun, store } from './app.ts';
import { LEVELS } from './content/levels.ts';
import { dailyDateOf, isLive, type ModeSlot } from './runs.ts';
import { type Strings, todayId } from './strings.ts';

export interface ModeSelectOptions {
  t: Strings;
  choose(id: string): void;
  show(card: Omit<OverlayCard, 'actions'>): void;
  /** "Chương 1 · Màn 4" for a journey run. */
  levelLabel(id: string): string;
  format(value: number): string;
}

interface ModeRow {
  slot: ModeSlot;
  icon: IconName;
  name: string;
  line: string;
  meta: string;
  live: boolean;
  /** The small action at the row's end: a new run of this mode; the journey picks its level in its screen. */
  fresh: boolean;
}

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

const note = (text: string): HTMLParagraphElement => {
  const node = element('p', 'mode-choice-note');
  node.textContent = text;
  return node;
};

/** The mode list: free play, journey, today's daily, each with what is waiting in it. */
export function modeSelectContent(options: ModeSelectOptions): HTMLElement {
  const { t } = options;
  const root = element('div', 'mode-choice-list');
  const today = todayId();
  const active = isLive(store.game) ? store.game : null;
  const endless = active?.mode === 'endless' ? active : parkedRun('endless');
  const journey = active?.mode === 'journey' ? active : parkedRun('journey');
  const daily = active?.mode === 'daily' && dailyDateOf(active) === today ? active : parkedRun('daily');
  const dailyStars = store.dailyDates[today];
  const journeyTotal = LEVELS.length * 3;

  const rows: ModeRow[] = [
    {
      slot: 'endless',
      icon: 'play',
      name: t.modeEndless,
      line: t.modeEndlessLine,
      meta: endless ? t.modeScore(options.format(endless.score)) : t.modeBest(options.format(store.best)),
      live: endless !== null && endless !== undefined,
      fresh: endless !== null && endless !== undefined,
    },
    {
      slot: 'journey',
      icon: 'cards',
      name: t.modeJourney,
      line: t.modeJourneyLine,
      meta: journey
        ? t.modeLevel(options.levelLabel(journey.level ?? ''), options.format(journey.score))
        : t.modeStars(journeyStars(), journeyTotal),
      live: journey !== null && journey !== undefined,
      fresh: false,
    },
    {
      slot: 'daily',
      icon: 'timer',
      name: t.modeDaily,
      line: t.modeDailyLine,
      meta: daily
        ? t.modeScore(options.format(daily.score))
        : dailyStars !== undefined
          ? t.modeTodayDone(dailyStars)
          : t.modeTodayFresh,
      live: daily !== null && daily !== undefined,
      fresh: daily !== null && daily !== undefined,
    },
  ];

  for (const row of rows) {
    const line = element('div', 'mode-choice-row');
    const button = element('button', `mode-choice is-${row.slot}`);
    button.type = 'button';
    if (row.slot === 'endless') button.dataset.tohePlay = '';
    if (row.live) button.dataset.saved = 'true';

    const mark = element('span', 'mode-choice-mark');
    mark.append(kitIcon(row.icon, 'mode-choice-icon'));
    const words = element('span', 'mode-choice-words');
    const head = element('span', 'mode-choice-head');
    const name = element('strong', '');
    name.textContent = row.name;
    head.append(name);
    if (row.live) {
      const badge = element('span', 'mode-choice-badge is-live');
      badge.textContent = t.modeLive;
      head.append(badge);
    }
    const chip = element('span', 'mode-choice-line');
    chip.textContent = row.line;
    const meta = element('span', 'mode-choice-meta');
    meta.textContent = row.meta;
    words.append(head, chip, meta);
    button.append(mark, words, kitIcon('caret-right', 'tohe-svg mode-choice-chevron'));
    button.addEventListener('click', () => options.choose(row.slot));
    line.append(button);

    if (row.fresh) {
      const fresh = element('button', 'mode-choice-new');
      fresh.type = 'button';
      fresh.setAttribute('aria-label', `${t.modeNew} · ${row.name}`);
      fresh.append(kitIcon('arrow-counter-clockwise', 'tohe-svg'));
      fresh.addEventListener('click', () => confirmNew(row.slot, row.name));
      line.append(fresh);
    }
    root.append(line);
  }

  return root;

  function confirmNew(slot: ModeSlot, name: string): void {
    const body = element('div', 'mode-confirm');
    body.append(note(t.modeNewBody));
    const start = element('button', 'tohe-button tohe-button-primary');
    start.type = 'button';
    start.append(kitIcon('arrow-counter-clockwise', 'tohe-svg'), element('span', 'tohe-label'));
    const label = start.querySelector('.tohe-label');
    if (label) label.textContent = t.modeNewStart;
    start.addEventListener('click', () => options.choose(`new:${slot}`));
    body.append(start);
    options.show({ icon: 'arrow-counter-clockwise', title: `${t.modeNew} · ${name}`, content: body });
  }
}
