// The game's own full screens: Hành Trình, Mỗi Ngày and Sổ Tay Khối (SPEC.md, "Screens"). Plain DOM inside the
// shell's screen body; the shell owns the header, Back and the title behind them. No engine, no board.
import { formatScore, formatValue, type IconName, icon, type Theme } from '@tohe/game-kit';
import type { Stats } from './app.ts';
import { ALBUM_CARDS, BADGES } from './content/album.ts';
import {
  CHAPTERS,
  chapterLevels,
  chapterOf,
  chapterUnlocked,
  dailyMoves,
  LEVEL_BY_ID,
  LEVELS,
  type Level,
} from './content/levels.ts';
import { dateLabel, monthOf, recentDays, stampedInMonth, todayId } from './date.ts';
import type { State } from './logic.ts';
import { blockStyle, type PaletteId } from './palette.ts';
import type { Strings } from './strings.ts';

export interface AlbumView {
  seen: ReadonlySet<number>;
  firstSeen: Readonly<Record<string, string>>;
  counts: Readonly<Record<string, number>>;
}

export interface ScreenDeps {
  t: Strings;
  locale: string;
  theme: Theme;
  palette: PaletteId;
  journey: Readonly<Record<string, number>>;
  dailyDates: Readonly<Record<string, number>>;
  album: AlbumView;
  achievements: ReadonlySet<string>;
  stats: Stats;
  best: number;
  /** The active run of each door, if any: a screen offers Continue for its own, never a restart by accident. */
  journeyGame: State | null;
  dailyGame: State | null;
  onPlayLevel(levelId: string): void;
  onResumeJourney(): void;
  onResumeDaily(): void;
  onPlayDaily(date: string): void;
  onOpenScreen(id: string): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const iconSpan = (name: IconName, className = 'ui-icon') => {
  const span = el('span', className);
  span.setAttribute('aria-hidden', 'true');
  span.append(icon(name));
  return span;
};

const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

/** A small block in the player's colours, for the target, the starting top and the album. */
const miniBlock = (exp: number, deps: ScreenDeps): HTMLElement => {
  const style = blockStyle(exp, deps.theme, deps.palette);
  const node = el('span', 'mini-block', formatValue(2 ** exp));
  node.style.background = hex(style.fill);
  node.style.color = style.text;
  node.style.boxShadow = `inset 0 -0.16rem 0 ${hex(style.edge)}`;
  if (style.outline) node.style.border = `2px solid ${hex(style.outline)}`;
  return node;
};

const starRow = (count: number, t: Strings): HTMLElement => {
  const row = el('span', 'star-row');
  row.setAttribute('aria-label', t.stars(count));
  for (let i = 0; i < 3; i++)
    row.append(iconSpan('star', i < count ? 'ui-icon star is-on' : 'ui-icon star is-off'));
  return row;
};

const totalStars = (journey: Readonly<Record<string, number>>): number =>
  Object.values(journey).reduce((sum, stars) => sum + stars, 0);

const metaTabs = (deps: ScreenDeps, current: string): HTMLElement => {
  const tabs = el('nav', 'meta-tabs');
  tabs.setAttribute('aria-label', deps.t.journey);
  const items = [
    { id: 'journey', label: deps.t.journey, icon: 'target' as const },
    { id: 'daily', label: deps.t.daily, icon: 'timer' as const },
    { id: 'album', label: deps.t.album, icon: 'cards' as const },
  ];
  for (const item of items) {
    const tab = el('button', item.id === current ? 'meta-tab is-current' : 'meta-tab');
    tab.type = 'button';
    tab.append(iconSpan(item.icon), el('span', 'meta-tab-label', item.label));
    if (item.id === current) tab.setAttribute('aria-current', 'page');
    else tab.addEventListener('click', () => deps.onOpenScreen(item.id));
    tabs.append(tab);
  }
  return tabs;
};

const chapterTitle = (chapter: { number: number; vi: string; en: string }, locale: string): string =>
  `${locale.startsWith('vi') ? 'Chặng' : 'Chapter'} ${chapter.number} · ${locale.startsWith('vi') ? chapter.vi : chapter.en}`;

const levelStars = (journey: Readonly<Record<string, number>>, level: Level): number =>
  journey[level.id] ?? 0;

const levelLabelFor = (id: string, t: Strings): string => {
  const level = LEVEL_BY_ID.get(id);
  return level ? t.levelLabel(level.chapter, level.index) : id;
};

/** A two-step confirmation inside a screen: the run in progress is only replaced after a second, explicit tap. */
const confirmPanel = (
  t: Strings,
  body: string,
  confirmLabel: string,
  onConfirm: () => void,
  onCancel: () => void,
): HTMLElement => {
  const box = el('div', 'confirm-inline');
  box.append(el('p', 'screen-note', body));
  const actions = el('div', 'detail-actions');
  const cancel = el('button', 'tohe-button tohe-button-secondary');
  cancel.type = 'button';
  cancel.append(icon('arrow-left'), el('span', 'tohe-label', t.cancel));
  cancel.addEventListener('click', onCancel);
  const confirm = el('button', 'tohe-button tohe-button-primary');
  confirm.type = 'button';
  confirm.append(icon('play'), el('span', 'tohe-label', confirmLabel));
  confirm.addEventListener('click', onConfirm);
  actions.append(cancel, confirm);
  box.append(actions);
  return box;
};

/** Hành Trình: three chapter sections, eight level stamps each, and the selected level's goal and par. */
export function renderJourney(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'journey');
  page.append(metaTabs(deps, 'journey'));
  const total = totalStars(deps.journey);
  const next = LEVELS.find((level) => levelStars(deps.journey, level) === 0) ?? (LEVELS[0] as Level);
  let selected: Level = next;
  const active = deps.journeyGame;
  const activeLevel = active?.level ?? null;

  const head = el('div', 'journey-head');
  head.append(el('p', 'screen-note', deps.t.journeyHint));
  head.append(el('span', 'journey-summary', deps.t.chapterDone(total, LEVELS.length * 3)));
  page.append(head);

  if (active?.level) {
    const banner = el('div', 'active-run');
    banner.append(
      el(
        'p',
        'screen-note',
        deps.t.inProgressLevel(levelLabelFor(active.level, deps.t), formatScore(active.score, deps.locale)),
      ),
    );
    const resume = el('button', 'tohe-button tohe-button-primary');
    resume.type = 'button';
    resume.append(icon('play'), el('span', 'tohe-label', deps.t.continueLevel));
    resume.addEventListener('click', () => deps.onResumeJourney());
    banner.append(resume);
    page.append(banner);
  }

  const detail = el('div', 'level-detail');
  page.append(detail);

  for (const chapter of CHAPTERS) {
    const unlocked = chapterUnlocked(chapter, deps.journey);
    const section = el('section', unlocked ? 'chapter' : 'chapter is-locked');
    const header = el('div', 'chapter-head');
    header.append(el('h3', 'chapter-title', chapterTitle(chapter, deps.locale)));
    const chapterLevelsOf = chapterLevels(chapter.number);
    const chapterStars = chapterLevelsOf.reduce((sum, level) => sum + levelStars(deps.journey, level), 0);
    header.append(el('span', 'chapter-stars', deps.t.chapterDone(chapterStars, chapterLevelsOf.length * 3)));
    section.append(header);
    if (!unlocked) section.append(el('p', 'lock-note', deps.t.locked(chapter.unlockAt)));

    const grid = el('div', 'level-grid');
    chapterLevelsOf.forEach((level) => {
      const stars = levelStars(deps.journey, level);
      const stamp = el('button', 'level-stamp');
      stamp.type = 'button';
      stamp.disabled = !unlocked;
      stamp.classList.toggle('is-selected', level.id === selected.id);
      stamp.classList.toggle('is-done', stars > 0);
      stamp.classList.toggle('is-active', level.id === activeLevel);
      stamp.setAttribute(
        'aria-label',
        `${deps.t.levelName(level.index)} · ${deps.t.stars(stars)}${
          level.id === activeLevel ? ` · ${deps.t.activeLevelTag}` : ''
        }${unlocked ? '' : ` · ${deps.t.locked(chapter.unlockAt)}`}`,
      );
      stamp.append(el('span', 'level-number', String(level.index)));
      stamp.append(starRow(stars, deps.t));
      stamp.addEventListener('click', () => {
        selected = level;
        for (const other of grid.querySelectorAll('.level-stamp')) other.classList.remove('is-selected');
        stamp.classList.add('is-selected');
        renderDetail();
        detail.scrollIntoView({ block: 'nearest' });
      });
      grid.append(stamp);
    });
    section.append(grid);
    page.append(section);
  }

  function renderDetail(confirm: 'restart' | 'switch' | null = null): void {
    detail.replaceChildren();
    const chapter = chapterOf(selected);
    const title = el(
      'h3',
      'detail-title',
      `${chapterTitle(chapter, deps.locale)} · ${deps.t.levelName(selected.index)}`,
    );
    detail.append(title);
    const intro = deps.locale.startsWith('vi') ? selected.intro.vi : selected.intro.en;
    detail.append(el('p', 'screen-note level-intro', intro));
    const goal = el('div', 'level-goal');
    goal.append(
      miniBlock(selected.target, deps),
      el('span', 'goal-text', deps.t.target(formatValue(2 ** selected.target))),
    );
    detail.append(goal);
    detail.append(el('p', 'screen-note', deps.t.boardTop(formatValue(2 ** selected.top))));
    detail.append(el('p', 'screen-note', deps.t.parLine(selected.par.three, selected.par.two)));
    const stars = levelStars(deps.journey, selected);
    detail.append(starRow(stars, deps.t));
    const isActive = activeLevel === selected.id;

    if (confirm === 'restart') {
      detail.append(
        confirmPanel(
          deps.t,
          deps.t.confirmRestartLevel,
          deps.t.startOver,
          () => deps.onPlayLevel(selected.id),
          () => renderDetail(),
        ),
      );
      return;
    }
    if (confirm === 'switch') {
      detail.append(
        confirmPanel(
          deps.t,
          deps.t.confirmSwitchLevel(deps.t.levelName(selected.index)),
          deps.t.playLevel,
          () => deps.onPlayLevel(selected.id),
          () => renderDetail(),
        ),
      );
      return;
    }

    const actions = el('div', 'detail-actions');
    const play = el('button', 'tohe-button tohe-button-primary');
    play.type = 'button';
    play.append(
      icon('play'),
      el(
        'span',
        'tohe-label',
        isActive ? deps.t.continueLevel : stars > 0 ? deps.t.replayLevel : deps.t.playLevel,
      ),
    );
    play.addEventListener('click', () => {
      if (isActive) deps.onResumeJourney();
      else if (activeLevel) renderDetail('switch');
      else deps.onPlayLevel(selected.id);
    });
    actions.append(play);
    if (isActive) {
      const again = el('button', 'tohe-button tohe-button-secondary');
      again.type = 'button';
      again.append(icon('arrow-counter-clockwise'), el('span', 'tohe-label', deps.t.replayLevel));
      again.addEventListener('click', () => renderDetail('restart'));
      actions.append(again);
    } else if (activeLevel) {
      const resume = el('button', 'tohe-button tohe-button-secondary');
      resume.type = 'button';
      resume.append(
        icon('play'),
        el('span', 'tohe-label', deps.t.continueLevelRun(levelLabelFor(activeLevel, deps.t))),
      );
      resume.addEventListener('click', () => deps.onResumeJourney());
      actions.append(resume);
    }
    detail.append(actions);
  }

  renderDetail();
  root.append(page);
}

/** Mỗi Ngày: today's card, the last 28 days, and the monthly badge's progress. */
export function renderDaily(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'daily');
  page.append(metaTabs(deps, 'daily'));
  const date = todayId();
  const stars = deps.dailyDates[date] ?? 0;
  const played = Object.hasOwn(deps.dailyDates, date);
  const active = deps.dailyGame;
  const month = monthOf(date);
  const monthDays = stampedInMonth(deps.dailyDates, month);

  page.append(el('p', 'screen-note', deps.t.dailyHint));
  const today = el('div', 'daily-today');
  const top = el('div', 'daily-today-top');
  top.append(miniBlock(12, deps));
  top.append(el('strong', 'daily-date', deps.t.dailyToday(dateLabel(date))));
  top.append(el('span', 'daily-budget', deps.t.dailyBudget(dailyMoves)));
  today.append(top);
  today.append(
    el(
      'p',
      'screen-note daily-status',
      active
        ? deps.t.dailyInProgress(active.moves, dailyMoves)
        : played
          ? deps.t.dailyStampedStars(stars)
          : deps.t.dailyNotPlayed,
    ),
  );
  today.append(el('p', 'screen-note', deps.t.dailyStars));
  if (played) today.append(starRow(stars, deps.t));

  const actions = el('div', 'detail-actions');
  const renderActions = (confirming = false): void => {
    actions.replaceChildren();
    if (confirming) {
      actions.append(
        confirmPanel(
          deps.t,
          deps.t.confirmRestartDaily,
          deps.t.dailyPractice,
          () => deps.onPlayDaily(date),
          () => renderActions(),
        ),
      );
      return;
    }
    const primary = el('button', 'tohe-button tohe-button-primary');
    primary.type = 'button';
    primary.append(
      icon(active ? 'play' : 'target'),
      el(
        'span',
        'tohe-label',
        active ? deps.t.continueLevel : played ? deps.t.dailyPractice : deps.t.dailyPlay,
      ),
    );
    primary.addEventListener('click', () => {
      if (active) deps.onResumeDaily();
      else deps.onPlayDaily(date);
    });
    actions.append(primary);
    if (active) {
      const again = el('button', 'tohe-button tohe-button-secondary');
      again.type = 'button';
      again.append(icon('arrow-counter-clockwise'), el('span', 'tohe-label', deps.t.dailyPractice));
      again.addEventListener('click', () => renderActions(true));
      actions.append(again);
    }
  };
  renderActions();
  today.append(actions);
  page.append(today);

  page.append(el('h4', 'section-label', deps.t.dailyCalendar));
  const calendar = el('div', 'calendar');
  for (const day of recentDays(28)) {
    const cell = el('div', day === date ? 'calendar-day is-today' : 'calendar-day');
    cell.append(el('span', 'calendar-number', String(Number(day.slice(-2)))));
    const stamped = deps.dailyDates[day] ?? 0;
    if (stamped > 0) {
      cell.classList.add('is-stamped');
      const stars = el('span', 'calendar-stars');
      for (let i = 0; i < stamped; i++) stars.append(iconSpan('star', 'ui-icon'));
      cell.append(stars);
      cell.setAttribute('aria-label', `${deps.t.dailyToday(dateLabel(day))} · ${deps.t.stars(stamped)}`);
    } else {
      cell.setAttribute('aria-label', deps.t.dailyToday(dateLabel(day)));
    }
    calendar.append(cell);
  }
  page.append(calendar);
  page.append(el('p', 'screen-note', deps.t.dailyNoStreak));
  const badge = el('div', 'month-badge');
  badge.append(iconSpan('trophy', 'ui-icon month-icon'));
  badge.append(el('span', 'month-text', `${deps.t.badges} ${monthDays}/20`));
  const bar = el('span', 'month-bar');
  const fill = el('i', 'month-fill');
  fill.style.width = `${Math.min(100, Math.round((monthDays / 20) * 100))}%`;
  bar.append(fill);
  badge.append(bar);
  page.append(badge);
  root.append(page);
}

/** Sổ Tay Khối: the 20 cards and the 11 badges. */
export function renderAlbum(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'album');
  page.append(metaTabs(deps, 'album'));
  page.append(el('p', 'screen-note', deps.t.albumHint));
  page.append(el('span', 'album-summary', deps.t.ofTotal(deps.album.seen.size, ALBUM_CARDS.length)));

  const selected =
    ALBUM_CARDS.filter((card) => deps.album.seen.has(card.exp)).at(-1) ??
    (ALBUM_CARDS[0] as (typeof ALBUM_CARDS)[number]);
  let chosen = selected;

  const grid = el('div', 'album-grid');
  const detail = el('div', 'album-detail');
  page.append(grid, detail);

  function renderDetail(): void {
    detail.replaceChildren();
    const seen = deps.album.seen.has(chosen.exp);
    detail.append(miniBlock(chosen.exp, deps));
    const text = el('div', 'album-detail-text');
    text.append(el('strong', 'album-detail-name', deps.locale.startsWith('vi') ? chosen.vi : chosen.en));
    if (seen) {
      const first = deps.album.firstSeen[String(chosen.exp)];
      if (first) text.append(el('span', 'screen-note', deps.t.albumFirstSeen(dateLabel(first))));
      const count = deps.album.counts[String(chosen.exp)] ?? 1;
      text.append(el('span', 'screen-note', deps.t.albumSeenTimes(count)));
      text.append(el('span', 'screen-note', deps.locale.startsWith('vi') ? chosen.factVi : chosen.factEn));
    } else {
      text.append(el('span', 'screen-note', deps.t.albumLocked(formatValue(2 ** chosen.exp))));
    }
    detail.append(text);
  }

  for (const card of ALBUM_CARDS) {
    const unlocked = deps.album.seen.has(card.exp);
    const node = el('button', unlocked ? 'album-card is-unlocked' : 'album-card is-locked');
    node.type = 'button';
    node.classList.toggle('is-selected', card.exp === chosen.exp);
    node.setAttribute(
      'aria-label',
      unlocked
        ? `${formatValue(2 ** card.exp)} · ${deps.locale.startsWith('vi') ? card.vi : card.en}`
        : deps.t.albumLocked(formatValue(2 ** card.exp)),
    );
    node.append(el('span', 'album-value', formatValue(2 ** card.exp)));
    if (unlocked) {
      const style = blockStyle(card.exp, deps.theme, deps.palette);
      node.style.background = hex(style.fill);
      node.style.color = style.text;
      node.style.boxShadow = `inset 0 -0.18rem 0 ${hex(style.edge)}`;
      if (style.outline) node.style.border = `2px solid ${hex(style.outline)}`;
      node.append(el('span', 'album-name', deps.locale.startsWith('vi') ? card.vi : card.en));
    } else {
      node.append(iconSpan('question', 'ui-icon album-lock'));
    }
    node.addEventListener('click', () => {
      chosen = card;
      for (const other of grid.querySelectorAll('.album-card')) other.classList.remove('is-selected');
      node.classList.add('is-selected');
      renderDetail();
    });
    grid.append(node);
  }
  renderDetail();

  page.append(el('h4', 'section-label', deps.t.badges));
  page.append(el('p', 'screen-note', deps.t.allBadges(deps.achievements.size, BADGES.length)));
  const badges = el('div', 'badge-list');
  for (const badge of BADGES) {
    const earned = deps.achievements.has(badge.id);
    const card = el('div', earned ? 'badge is-earned' : 'badge');
    card.append(iconSpan(badge.icon, 'ui-icon badge-icon'));
    const text = el('div', 'badge-text');
    const words = deps.locale.startsWith('vi') ? badge.vi : badge.en;
    text.append(el('strong', 'badge-title', words.title), el('span', 'badge-body', words.body));
    card.append(text);
    card.append(iconSpan(earned ? 'check' : 'question', earned ? 'ui-icon is-earned' : 'ui-icon is-locked'));
    badges.append(card);
  }
  page.append(badges);
  root.append(page);
}
