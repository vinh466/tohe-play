// The game's own full screens: Journey, Daily, Stats and Achievements. They are plain DOM inside the shell's screen
// body; the shell owns the header, Back and the title behind them.
import { formatScore, type IconName, icon, prefersReducedMotion } from '@tohe/game-kit';
import { ACHIEVEMENTS, type AchievementGroup } from './content/achievements.ts';
import { CHAPTERS, chapterOf, DAILY_GOALS, LEVEL_BY_ID, LEVELS, type Level } from './content/levels.ts';
import { rankOf } from './content/ranks.ts';
import { type Goal, goalMet, type State } from './logic.ts';
import { recentDays, type Strings, todayId } from './strings.ts';

export interface StatsView {
  games: number;
  totalScore: number;
  lines: number;
  bestCombo: number;
  bestStreak: number;
  perfects: number;
}

export interface ScreenDeps {
  t: Strings;
  locale: string;
  journey: Readonly<Record<string, number>>;
  dailyDates: Readonly<Record<string, number>>;
  stats: StatsView;
  best: number;
  game: State | null;
  achievements: ReadonlySet<string>;
  onPlayLevel(levelId: string, restart?: boolean): void;
  onPlayDaily(date: string, restart?: boolean): void;
  onPracticeDaily(date: string): void;
  onOpenScreen(id: string): void;
  canStreakBoard: boolean;
  onOpenStreakBoard(): void;
  /** The journey run parked when the player changed mode, if it is unfinished. */
  parkedJourney: State | null;
  /** Today's daily run parked when the player changed mode, if it is unfinished. */
  parkedDaily: State | null;
  /** Which goals the best result of each journey level met. */
  journeyGoals: Readonly<Record<string, readonly boolean[]>>;
  /** Which goals today's daily met, when it was stamped. */
  dailyGoals: { date: string; met: readonly boolean[] } | null;
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

const starRow = (count: number, t: Strings): HTMLElement => {
  const row = el('span', 'star-row');
  row.setAttribute('aria-label', t.stars(count));
  for (let i = 0; i < 3; i++) {
    const star = iconSpan('star', i < count ? 'ui-icon star is-on' : 'ui-icon star is-off');
    row.append(star);
  }
  return row;
};

const goalList = (
  goals: readonly Goal[],
  t: Strings,
  met?: readonly boolean[] | State | null,
): HTMLElement => {
  const list = el('ul', 'goal-list');
  const live = met && !Array.isArray(met) ? (met as State) : null;
  goals.forEach((goal, index) => {
    const done = Array.isArray(met) ? met[index] === true : live !== null ? goalMet(live, goal) : false;
    const item = el('li', done ? 'goal is-met' : 'goal');
    item.append(iconSpan(index === 0 ? 'target' : 'star', 'ui-icon'));
    item.append(el('span', 'goal-text', t.goal(goal.kind, goal.value)));
    if (done) item.append(iconSpan('check', 'ui-icon goal-check'));
    list.append(item);
  });
  return list;
};

const chapterTitle = (chapter: { number: number; vi: string; en: string }, locale: string): string =>
  `${locale.startsWith('vi') ? 'Chương' : 'Chapter'} ${chapter.number} · ${locale.startsWith('vi') ? chapter.vi : chapter.en}`;

const totalStars = (journey: Readonly<Record<string, number>>): number =>
  Object.values(journey).reduce((sum, stars) => sum + stars, 0);

/** The four meta screens are tabs of one place; the shell's header keeps the way back to the title. */
const metaTabs = (deps: ScreenDeps, current: string): HTMLElement => {
  const tabs = el('nav', 'meta-tabs');
  tabs.setAttribute('aria-label', deps.t.journey);
  const items = [
    { id: 'journey', label: deps.t.journey, icon: 'cards' as const },
    { id: 'daily', label: deps.t.daily, icon: 'timer' as const },
    { id: 'stats', label: deps.t.stats, icon: 'list' as const },
    { id: 'achievements', label: deps.t.achievements, icon: 'star' as const },
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

const levelStars = (journey: Readonly<Record<string, number>>, level: Level): number =>
  journey[level.id] ?? 0;

/** The Journey screen: the selected level and its goals first, then three paper chapters of stamps. */
export function renderJourney(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'journey');
  page.append(metaTabs(deps, 'journey'));
  const total = totalStars(deps.journey);
  const active = deps.game && deps.game.mode === 'journey' && !deps.game.over ? deps.game : null;
  const live = active ?? deps.parkedJourney;
  const next =
    (live?.level ? LEVEL_BY_ID.get(live.level) : undefined) ??
    LEVELS.find((level) => levelStars(deps.journey, level) === 0) ??
    (LEVELS[0] as Level);
  let selected: Level = next;
  let confirming = false;

  const head = el('div', 'journey-head');
  head.append(el('p', 'screen-note', deps.t.journeyHint));
  const summary = el('span', 'journey-summary', deps.t.progress(total, LEVELS.length * 3));
  head.append(summary);
  page.append(head);

  // The selected level's goals and its button sit above the map: the common case — continue the journey — is one tap,
  // not a scroll past every chapter.
  const detail = el('div', 'level-detail');
  page.append(detail);

  const nameOfLevel = (level: Level): string => {
    const chapter = chapterOf(level);
    const number = LEVELS.filter((item) => item.chapter === level.chapter).findIndex(
      (item) => item.id === level.id,
    );
    return `${chapterTitle(chapter, deps.locale)} · ${deps.t.levelName(number + 1)}`;
  };

  for (const chapter of CHAPTERS) {
    const unlocked = total >= chapter.unlockAt;
    const section = el('section', unlocked ? 'chapter' : 'chapter is-locked');
    const title = el('div', 'chapter-head');
    title.append(el('h3', 'chapter-title', chapterTitle(chapter, deps.locale)));
    const chapterLevels = LEVELS.filter((level) => level.chapter === chapter.number);
    const chapterStars = chapterLevels.reduce((sum, level) => sum + levelStars(deps.journey, level), 0);
    title.append(el('span', 'chapter-stars', deps.t.chapterDone(chapterStars, chapterLevels.length * 3)));
    section.append(title);
    if (!unlocked) section.append(el('p', 'lock-note', deps.t.locked(chapter.unlockAt)));

    const grid = el('div', 'level-grid');
    chapterLevels.forEach((level, index) => {
      const stars = levelStars(deps.journey, level);
      const stamp = el('button', 'level-stamp');
      stamp.type = 'button';
      stamp.disabled = !unlocked;
      stamp.classList.toggle('is-selected', level.id === selected.id);
      stamp.classList.toggle('is-done', stars > 0);
      stamp.setAttribute(
        'aria-label',
        `${deps.t.levelName(index + 1)} · ${deps.t.stars(stars)}${unlocked ? '' : ` · ${deps.t.locked(chapter.unlockAt)}`}`,
      );
      stamp.append(el('span', 'level-number', String(index + 1)));
      stamp.append(starRow(stars, deps.t));
      stamp.addEventListener('click', () => {
        selected = level;
        confirming = false;
        for (const other of grid.querySelectorAll('.level-stamp')) other.classList.remove('is-selected');
        stamp.classList.add('is-selected');
        renderDetail();
        detail.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
      grid.append(stamp);
    });
    section.append(grid);
    page.append(section);
  }

  function renderDetail(): void {
    detail.replaceChildren();
    detail.append(el('h3', 'detail-title', nameOfLevel(selected)));
    const stars = levelStars(deps.journey, selected);
    detail.append(starRow(stars, deps.t));
    const sameLevel = live?.level === selected.id;
    const met =
      sameLevel && active
        ? selected.goals.map((goal) => goalMet(active, goal))
        : (deps.journeyGoals[selected.id] ?? (stars === 3 ? [true, true, true] : undefined));
    detail.append(goalList(selected.goals, deps.t, met));
    if (confirming && live && live.level !== selected.id) {
      detail.append(
        el(
          'p',
          'screen-note switch-note',
          deps.t.switchWarning(nameOfLevel(LEVEL_BY_ID.get(live.level ?? '') ?? selected)),
        ),
      );
    }
    const actions = el('div', 'detail-actions');
    const play = el('button', `tohe-button ${confirming ? 'tohe-button-secondary' : 'tohe-button-primary'}`);
    play.type = 'button';
    play.append(
      icon('play'),
      el(
        'span',
        'tohe-label',
        confirming ? deps.t.startNew : sameLevel ? deps.t.continueLevel : deps.t.playLevel,
      ),
    );
    play.addEventListener('click', () => {
      if (!confirming && live && live.level !== selected.id) {
        confirming = true;
        renderDetail();
        return;
      }
      deps.onPlayLevel(selected.id);
    });
    actions.append(play);
    if (sameLevel && !confirming) {
      const again = el('button', 'tohe-button tohe-button-secondary');
      again.type = 'button';
      again.append(icon('arrow-counter-clockwise'), el('span', 'tohe-label', deps.t.restartLevel));
      again.addEventListener('click', () => deps.onPlayLevel(selected.id, true));
      actions.append(again);
    }
    if (confirming) {
      const back = el('button', 'tohe-button tohe-button-secondary');
      back.type = 'button';
      back.append(icon('arrow-left'), el('span', 'tohe-label', deps.t.back));
      back.addEventListener('click', () => {
        confirming = false;
        renderDetail();
      });
      actions.append(back);
    }
    detail.append(actions);
  }

  renderDetail();
  root.append(page);
}

/** The Daily screen: today's goals, a stamp and the last 28 days. */
export function renderDaily(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'daily');
  page.append(metaTabs(deps, 'daily'));
  const date = todayId();
  const stars = deps.dailyDates[date] ?? 0;
  const played = Object.hasOwn(deps.dailyDates, date);
  const active =
    deps.game && deps.game.mode === 'daily' && !deps.game.over && deps.game.level === `daily-${date}`
      ? deps.game
      : null;
  const live = active ?? deps.parkedDaily;

  page.append(el('h3', 'daily-date', deps.t.dailyToday(deps.t.date(date))));
  if (live) page.append(el('p', 'screen-note', deps.t.inProgressDaily(formatScore(live.score, deps.locale))));
  page.append(el('h4', 'section-label', deps.t.dailyGoal));
  const met = live
    ? DAILY_GOALS.map((goal) => goalMet(live, goal))
    : deps.dailyGoals?.date === date
      ? deps.dailyGoals.met
      : stars === 3
        ? [true, true, true]
        : undefined;
  page.append(goalList(DAILY_GOALS, deps.t, met));

  const actions = el('div', 'detail-actions');
  const play = el(
    'button',
    `tohe-button ${played && !live ? 'tohe-button-secondary' : 'tohe-button-primary'}`,
  );
  play.type = 'button';
  play.append(
    icon('target'),
    el('span', 'tohe-label', live ? deps.t.continueLevel : played ? deps.t.dailyPractice : deps.t.dailyPlay),
  );
  play.addEventListener('click', () => {
    if (played) deps.onPracticeDaily(date);
    else deps.onPlayDaily(date);
  });
  actions.append(play);
  if (live) {
    const again = el('button', 'tohe-button tohe-button-secondary');
    again.type = 'button';
    again.append(icon('arrow-counter-clockwise'), el('span', 'tohe-label', deps.t.restartLevel));
    again.addEventListener('click', () => deps.onPlayDaily(date, true));
    actions.append(again);
  }
  page.append(actions);
  if (played) page.append(starRow(stars, deps.t));

  page.append(el('h4', 'section-label', deps.t.dailyCalendar));
  const calendar = el('div', 'calendar');
  for (const day of recentDays(28)) {
    const cell = el('div', day === date ? 'calendar-day is-today' : 'calendar-day');
    const dayNumber = Number(day.slice(-2));
    cell.append(el('span', 'calendar-number', String(dayNumber)));
    if (Object.hasOwn(deps.dailyDates, day)) {
      cell.classList.add('is-stamped');
      cell.append(iconSpan('star', 'ui-icon calendar-star'));
      cell.setAttribute('aria-label', `${deps.t.date(day)} · ${deps.t.stars(deps.dailyDates[day] ?? 0)}`);
    } else {
      cell.setAttribute('aria-label', deps.t.date(day));
    }
    calendar.append(cell);
  }
  page.append(calendar);
  page.append(el('p', 'screen-note', deps.t.dailyNoStreak));
  root.append(page);
}

/** The Stats screen: totals and the mastery ladder. */
export function renderStats(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'stats');
  page.append(metaTabs(deps, 'stats'));
  const rank = rankOf(deps.best);
  const rankName = deps.locale.startsWith('vi') ? rank.rank.vi : rank.rank.en;
  const nextName = rank.next ? (deps.locale.startsWith('vi') ? rank.next.vi : rank.next.en) : null;
  const panel = el('div', 'rank-panel');
  panel.append(el('span', 'section-label', deps.t.statsRank));
  panel.append(el('strong', 'rank-name', rankName));
  panel.append(el('span', 'rank-score', formatScore(deps.best, deps.locale)));
  if (rank.next && nextName) {
    const start = rank.rank.at;
    const end = rank.next.at;
    const ratio = Math.max(0, Math.min(1, (deps.best - start) / (end - start)));
    const bar = el('div', 'rank-bar');
    const fill = el('div', 'rank-fill');
    fill.style.width = `${Math.round(ratio * 100)}%`;
    bar.append(fill);
    panel.append(bar);
    panel.append(
      el('p', 'screen-note', deps.t.statsNext(formatScore(end - deps.best, deps.locale), nextName)),
    );
  }
  page.append(panel);

  const grid = el('div', 'stat-grid');
  const stat = (label: string, value: string) => {
    const card = el('div', 'stat-card');
    card.append(el('span', 'stat-label', label), el('strong', 'stat-value', value));
    grid.append(card);
  };
  stat(deps.t.statsGames, formatScore(deps.stats.games, deps.locale));
  stat(deps.t.statsScore, formatScore(deps.stats.totalScore, deps.locale));
  stat(deps.t.statsLines, formatScore(deps.stats.lines, deps.locale));
  stat(deps.t.statsCombo, `×${deps.stats.bestCombo}`);
  stat(deps.t.statsStreak, String(deps.stats.bestStreak));
  stat(deps.t.statsPerfects, formatScore(deps.stats.perfects, deps.locale));
  stat(deps.t.statsStars, deps.t.ofTotal(totalStars(deps.journey), LEVELS.length * 3));
  page.append(grid);
  if (deps.canStreakBoard) {
    const button = el('button', 'tohe-button tohe-button-secondary streak-board-button');
    button.type = 'button';
    button.append(icon('trophy'), el('span', 'tohe-label', deps.t.streakBoard));
    button.addEventListener('click', () => deps.onOpenStreakBoard());
    page.append(button);
  }
  root.append(page);
}

const GROUPS: readonly AchievementGroup[] = ['first', 'clears', 'combos', 'journey', 'days'];

/** The Achievements screen: 15 stamps, earned or waiting. */
export function renderAchievements(root: HTMLElement, deps: ScreenDeps): void {
  root.replaceChildren();
  const page = el('div', 'achievements');
  page.append(metaTabs(deps, 'achievements'));
  page.append(el('p', 'screen-note', deps.t.achievementsEarned(deps.achievements.size, ACHIEVEMENTS.length)));
  const groupLabel: Record<AchievementGroup, string> = {
    first: deps.t.groupFirst,
    clears: deps.t.groupClears,
    combos: deps.t.groupCombos,
    journey: deps.t.groupJourney,
    days: deps.t.groupDays,
  };
  for (const group of GROUPS) {
    const items = ACHIEVEMENTS.filter((achievement) => achievement.group === group);
    if (items.length === 0) continue;
    const section = el('section', 'achievement-group');
    section.append(el('h3', 'section-label', groupLabel[group]));
    const list = el('div', 'achievement-list');
    for (const achievement of items) {
      const have = deps.achievements.has(achievement.id);
      const card = el('div', have ? 'achievement is-earned' : 'achievement');
      const words = deps.locale.startsWith('vi') ? achievement.vi : achievement.en;
      card.append(iconSpan(achievement.icon, 'ui-icon achievement-icon'));
      const text = el('div', 'achievement-text');
      text.append(el('strong', 'achievement-title', words.title), el('span', 'achievement-body', words.body));
      card.append(text);
      card.append(iconSpan(have ? 'check' : 'question', have ? 'ui-icon is-earned' : 'ui-icon is-locked'));
      list.append(card);
    }
    section.append(list);
    page.append(section);
  }
  root.append(page);
}
