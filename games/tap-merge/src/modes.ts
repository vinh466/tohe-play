// The mode hub: one card per door, each showing its own state and the one action that follows from it — Continue
// when a run is waiting, Play when there is nothing to lose, and a guarded New game when there is. It is the shell's
// pre-play screen, so it opens from the title's Chế độ button, the in-game panel, and a result card's Đổi chế độ.
// The hub is plain DOM in the menu stage: no engine, no board.
import { type IconName, icon, type OverlayCard } from '@tohe/game-kit';
import { gameFor, levelLabel, store } from './app.ts';
import { CHAPTERS, chapterLevels, chapterUnlocked, LEVEL_BY_ID, nextJourneyLevel } from './content/levels.ts';
import { todayId } from './date.ts';
import { levelChoice, newChoice, resumeChoice } from './flow.ts';
import { DAILY_TAPS, type Mode } from './logic.ts';
import type { Strings } from './strings.ts';

export interface ModeHubOptions {
  t: Strings;
  locale: string;
  choose(id: string): void;
  show(card: Omit<OverlayCard, 'actions'>): void;
  /** A number in the player's digits (the shell's formatter). */
  format(value: number): string;
}

const MODE_ICON: Record<Mode, IconName> = { classic: 'trophy', journey: 'target', daily: 'timer' };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const iconSpan = (name: IconName, className: string): HTMLElement => {
  const span = el('span', className);
  span.setAttribute('aria-hidden', 'true');
  span.append(icon(name));
  return span;
};

const action = (
  label: string,
  name: IconName,
  variant: 'primary' | 'secondary',
  onClick: () => void,
): HTMLButtonElement => {
  const button = el('button', `tohe-button tohe-button-${variant}`);
  button.type = 'button';
  button.append(icon(name), el('span', 'tohe-label', label));
  button.addEventListener('click', onClick);
  return button;
};

const totalStars = (): number => Object.values(store.journey).reduce((sum, stars) => sum + stars, 0);

const modeName = (mode: Mode, t: Strings): string =>
  mode === 'classic' ? t.classic : mode === 'journey' ? t.journey : t.daily;

/** A card's header: its icon and name, and the one fact that changes how a player reads the rest — ranked or not. */
function cardHead(mode: Mode, t: Strings): { head: HTMLElement; status: HTMLElement; actions: HTMLElement } {
  const card = el('section', `mode-card is-${mode}`);
  const head = el('div', 'mode-card-head');
  head.append(
    iconSpan(MODE_ICON[mode], 'mode-card-icon'),
    el('strong', 'mode-card-name', modeName(mode, t)),
    el(
      'span',
      mode === 'classic' ? 'mode-card-tag is-ranked' : 'mode-card-tag',
      mode === 'classic' ? t.ranked : t.notRanked,
    ),
  );
  const status = el('p', 'mode-card-status');
  const actions = el('div', 'mode-card-actions');
  card.append(head, status, actions);
  return { head: card, status, actions };
}

/** The inline confirmation under a card's actions: a card, not a new screen, so Back is never the only way out. */
function confirmRow(
  t: Strings,
  body: string,
  confirmLabel: string,
  onConfirm: () => void,
  onCancel: () => void,
): HTMLElement {
  const box = el('div', 'mode-confirm');
  box.append(el('p', 'screen-note', body));
  const actions = el('div', 'mode-confirm-actions');
  actions.append(
    action(t.cancel, 'arrow-left', 'secondary', onCancel),
    action(confirmLabel, 'arrow-counter-clockwise', 'primary', onConfirm),
  );
  box.append(actions);
  return box;
}

function classicCard(o: ModeHubOptions): HTMLElement {
  const active = gameFor('classic');
  const { head, status, actions } = cardHead('classic', o.t);
  status.textContent = active
    ? o.t.classicActive(o.format(active.score))
    : store.best > 0
      ? o.t.bestLine(o.format(store.best))
      : o.t.classicFresh;
  let confirming = false;

  const render = () => {
    actions.replaceChildren();
    if (confirming) {
      actions.append(
        confirmRow(
          o.t,
          o.t.confirmClassicNew,
          o.t.newGame,
          () => o.choose(newChoice('classic')),
          () => {
            confirming = false;
            render();
          },
        ),
      );
      return;
    }
    const primary = action(active ? o.t.continue : o.t.play, 'play', 'primary', () =>
      o.choose(active ? resumeChoice('classic') : newChoice('classic')),
    );
    // The shell's first-time hand follows the first card: this is the classic door's play.
    primary.dataset.tohePlay = '';
    actions.append(primary);
    if (active) {
      actions.append(
        action(o.t.newGame, 'arrow-counter-clockwise', 'secondary', () => {
          confirming = true;
          render();
        }),
      );
    }
  };
  render();
  return head;
}

function journeyCard(o: ModeHubOptions): HTMLElement {
  const active = gameFor('journey');
  const stars = totalStars();
  const { head, status, actions } = cardHead('journey', o.t);
  status.textContent = active?.level
    ? o.t.inProgressLevel(levelLabel(active.level), o.format(active.score))
    : stars > 0
      ? o.t.journeyProgress(stars)
      : o.t.journeyFresh;
  actions.append(
    action(active ? o.t.continue : stars > 0 ? o.t.playNextLevel : o.t.play, 'play', 'primary', () =>
      o.choose(active ? resumeChoice('journey') : newChoice('journey')),
    ),
    action(o.t.chooseLevel, 'cards', 'secondary', () =>
      o.show({ icon: 'target', title: o.t.journey, content: journeyPicker(o) }),
    ),
  );
  return head;
}

function dailyCard(o: ModeHubOptions): HTMLElement {
  const active = gameFor('daily');
  const date = todayId();
  const stars = store.dailyDates[date] ?? 0;
  const played = Object.hasOwn(store.dailyDates, date);
  const { head, status, actions } = cardHead('daily', o.t);
  status.textContent = active
    ? o.t.dailyInProgress(active.moves, DAILY_TAPS)
    : played
      ? o.t.dailyStampedStars(stars)
      : o.t.dailyNotPlayed;
  let confirming = false;

  const render = () => {
    actions.replaceChildren();
    if (confirming) {
      actions.append(
        confirmRow(
          o.t,
          o.t.confirmDailyNew,
          o.t.dailyPractice,
          () => o.choose(newChoice('daily')),
          () => {
            confirming = false;
            render();
          },
        ),
      );
      return;
    }
    actions.append(
      action(active ? o.t.continue : played ? o.t.dailyPractice : o.t.dailyPlay, 'play', 'primary', () =>
        o.choose(active ? resumeChoice('daily') : newChoice('daily')),
      ),
    );
    if (active) {
      actions.append(
        action(o.t.dailyPractice, 'arrow-counter-clockwise', 'secondary', () => {
          confirming = true;
          render();
        }),
      );
    }
  };
  render();
  return head;
}

/** The Journey picker over the hub: a level grid with the active level marked and a two-step switch, so a tap on a
 *  different level never silently throws away the run in progress. */
export function journeyPicker(o: ModeHubOptions): HTMLElement {
  const root = el('div', 'mode-picker');
  const active = gameFor('journey');
  const activeLevel = active?.level ?? null;
  const next = nextJourneyLevel(store.journey);
  let picked = activeLevel && LEVEL_BY_ID.has(activeLevel) ? activeLevel : next.id;
  const sections = el('div', 'mode-picker-sections');
  const footer = el('div', 'mode-picker-footer');

  const render = () => {
    sections.replaceChildren();
    for (const chapter of CHAPTERS) {
      const unlocked = chapterUnlocked(chapter, store.journey);
      const section = el('section', unlocked ? 'mode-picker-chapter' : 'mode-picker-chapter is-locked');
      const name = o.locale.startsWith('vi') ? chapter.vi : chapter.en;
      section.append(
        el(
          'h3',
          'mode-picker-title',
          `${o.locale.startsWith('vi') ? 'Chặng' : 'Chapter'} ${chapter.number} · ${name}`,
        ),
      );
      if (!unlocked) section.append(el('p', 'screen-note', o.t.locked(chapter.unlockAt)));
      const grid = el('div', 'mode-picker-grid');
      for (const level of chapterLevels(chapter.number)) {
        const stars = store.journey[level.id] ?? 0;
        const button = el('button', 'mode-picker-level');
        button.type = 'button';
        button.disabled = !unlocked;
        button.classList.toggle('is-picked', level.id === picked);
        button.classList.toggle('is-active', level.id === activeLevel);
        button.classList.toggle('is-done', stars > 0);
        button.setAttribute(
          'aria-label',
          `${o.t.levelName(level.index)} · ${o.t.stars(stars)}${level.id === activeLevel ? ` · ${o.t.activeLevelTag}` : ''}`,
        );
        button.append(el('span', 'mode-picker-number', String(level.index)));
        if (stars > 0) {
          const row = el('span', 'mode-picker-stars');
          for (let i = 0; i < stars; i++) row.append(iconSpan('star', 'ui-icon'));
          button.append(row);
        }
        button.addEventListener('click', () => {
          picked = level.id;
          render();
        });
        grid.append(button);
      }
      section.append(grid);
      sections.append(section);
    }

    footer.replaceChildren();
    const same = activeLevel === picked;
    if (activeLevel && !same) {
      footer.append(el('p', 'screen-note', o.t.pickerBusy(levelLabel(activeLevel))));
      footer.append(
        action(o.t.continueLevelRun(levelLabel(activeLevel)), 'play', 'secondary', () =>
          o.choose(resumeChoice('journey')),
        ),
      );
    } else {
      footer.append(el('p', 'screen-note', o.t.pickerHint));
    }
    footer.append(
      action(same ? o.t.continue : o.t.playLevel, 'play', 'primary', () =>
        o.choose(same ? resumeChoice('journey') : levelChoice(picked)),
      ),
    );
  };

  render();
  root.append(sections, footer);
  return root;
}

/** The pre-play screen's content: the three doors, classic first. */
export function modeHubContent(o: ModeHubOptions): HTMLElement {
  const root = el('div', 'mode-hub');
  root.append(classicCard(o), journeyCard(o), dailyCard(o));
  return root;
}
