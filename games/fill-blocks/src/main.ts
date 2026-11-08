// The menu stage (ADR 0020): Lấp Ô's title, its journey/daily/stats/achievements screens, settings and how-to, with no
// board running. Play loads stage.ts. The game's own screens are DOM inside the shell; the shell owns Back.
import '@tohe/game-kit/overlay.css';
import './style.css';
import { choiceList, createShell, followTheme, hintList, type Shell, type ShellScreen } from '@tohe/game-kit';
import { journeyStars, parkedRun, persist, rankLabel, scoreText, session, store, t } from './app.ts';
import { chapterOf, LEVEL_BY_ID, LEVELS, type Level } from './content/levels.ts';
import { SKINS, skinById } from './content/skins.ts';
import { modeSelectContent } from './modes.ts';
import { PALETTE_COLOURS, PALETTE_IDS, type PaletteId } from './palette.ts';
import { renderAchievements, renderDaily, renderJourney, renderStats, type ScreenDeps } from './screens.ts';
import { paletteLabel } from './strings.ts';

document.documentElement.lang = session.locale;
followTheme(session);

let shell: Shell;

const levelNumber = (level: Level): number =>
  LEVELS.filter((item) => item.chapter === level.chapter).findIndex((item) => item.id === level.id) + 1;

const levelLabel = (id: string): string => {
  const level = LEVEL_BY_ID.get(id);
  if (!level) return id;
  const chapter = chapterOf(level);
  return `${session.locale.startsWith('vi') ? 'Chương' : 'Chapter'} ${chapter.number} · ${t.levelName(levelNumber(level))}`;
};

const playLevel = (id: string, restart = false) => {
  store.pending = { level: id, restart };
  void persist();
  shell.play(true);
};

const playDaily = (date: string, restart = false) => {
  store.pending = { daily: date, restart };
  void persist();
  shell.play(true);
};

const screenDeps = (): ScreenDeps => ({
  t,
  locale: session.locale,
  journey: store.journey,
  dailyDates: store.dailyDates,
  stats: store.stats,
  best: store.best,
  game: store.game,
  achievements: store.achievements,
  onPlayLevel: playLevel,
  onPlayDaily: playDaily,
  onPracticeDaily: playDaily,
  onOpenScreen: (id) => shell.openScreen(id),
  canStreakBoard: session.shell.can.leaderboard,
  onOpenStreakBoard: () => session.shell.open('leaderboard', { board: 'streak', label: t.streakBoard }),
  parkedJourney: parkedRun('journey'),
  parkedDaily: parkedRun('daily'),
  journeyGoals: store.journeyGoals,
  dailyGoals: store.dailyGoals,
});

const screens: ShellScreen[] = [
  {
    id: 'journey',
    label: t.journey,
    icon: 'cards',
    hidden: false,
    render: (root) => renderJourney(root, screenDeps()),
  },
  {
    id: 'daily',
    label: t.daily,
    icon: 'timer',
    hidden: true,
    render: (root) => renderDaily(root, screenDeps()),
  },
  {
    id: 'stats',
    label: t.stats,
    icon: 'list',
    hidden: true,
    render: (root) => renderStats(root, screenDeps()),
  },
  {
    id: 'achievements',
    label: t.achievements,
    icon: 'star',
    hidden: true,
    render: (root) => renderAchievements(root, screenDeps()),
  },
];

const skinChoices = () => {
  const stars = journeyStars();
  const unlocked = SKINS.filter((skin) => skin.at <= stars);
  return choiceList(
    unlocked.map((skin) => ({
      id: skin.id,
      label: session.locale.startsWith('vi') ? skin.vi : skin.en,
      preview: skinPreview(skin.id),
    })),
    skinById(store.settings.skin) && (skinById(store.settings.skin)?.at ?? 0) <= stars
      ? store.settings.skin
      : 'paper',
    (id) => {
      store.settings.skin = id;
      void persist();
    },
  );
};

const skinPreview = (id: string): HTMLElement => {
  const preview = document.createElement('span');
  preview.className = `skin-preview skin-${id}`;
  preview.setAttribute('aria-hidden', 'true');
  return preview;
};

const palettePreview = (palette: PaletteId): HTMLElement => {
  const preview = document.createElement('span');
  preview.className = `palette-preview palette-${palette}`;
  preview.setAttribute('aria-hidden', 'true');
  for (const colour of PALETTE_COLOURS[palette]) {
    const chip = document.createElement('i');
    chip.style.background = colour;
    preview.append(chip);
  }
  return preview;
};

const inProgress = (): string | null => {
  const game = store.game;
  if (!game || game.over) return null;
  if (game.mode === 'journey' && game.level)
    return t.inProgressLevel(levelLabel(game.level), scoreText(game.score));
  if (game.mode === 'daily') return t.inProgressDaily(scoreText(game.score));
  return t.inProgress(scoreText(game.score));
};

shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  logo: 'icon.svg',
  prePlay: ({ choose, inProgress, show }) => ({
    icon: { src: 'icon.svg' },
    title: t.modes,
    body:
      inProgress || Object.values(store.parked).some((run) => run !== undefined && !run.over)
        ? t.modesBody
        : t.modesChoose,
    content: modeSelectContent({ t, choose, show, levelLabel, format: scoreText }),
    actions: [],
  }),
  decor: [
    { shape: 'square', colour: '#ff5a5f' },
    { shape: 'square', colour: '#ffb703' },
    { shape: 'square', colour: '#38b000' },
    { shape: 'square', colour: '#2196f3' },
  ],
  title: t.title,
  inProgress,
  progress: () => (journeyStars() > 0 ? t.progress(journeyStars(), LEVELS.length * 3) : null),
  best: () => t.bestLine(scoreText(store.best), rankLabel()),
  howTo: () => ({ icon: { src: 'icon.svg' }, title: t.title, content: hintList(t.hints) }),
  tutorial: {
    seen: () => store.tutorialSeen,
    done: () => {
      store.tutorialSeen = true;
      void persist();
    },
  },
  screens,
  settings: [
    {
      label: t.palette,
      icon: 'palette',
      when: 'any-time',
      content: () =>
        choiceList(
          PALETTE_IDS.map((id) => ({
            id,
            label: paletteLabel(id, t),
            preview: palettePreview(id),
          })),
          store.settings.palette,
          (id) => {
            store.settings.palette = id;
            store.settings.palettePicked = true;
            void persist();
          },
        ),
    },
    {
      label: t.board,
      icon: 'cards',
      when: 'any-time',
      content: skinChoices,
    },
    {
      label: t.hintsSetting,
      icon: 'lightbulb',
      when: 'any-time',
      content: () =>
        choiceList(
          [
            { id: 'on', label: t.on },
            { id: 'off', label: t.off },
          ],
          store.settings.hints ? 'on' : 'off',
          (id) => {
            store.settings.hints = id === 'on';
            void persist();
          },
        ),
    },
  ],
  leaderboard: false,
  stage: () => import('./stage.ts'),
});

shell.start();
