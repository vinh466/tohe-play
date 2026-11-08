// The menu stage (ADR 0020): Chạm Ghép's title, its three doors (Vô Tận, Hành Trình, Mỗi Ngày), the game-owned
// Journey/Daily/Notebook screens, settings and how-to, with no board running. Play loads stage.ts. The game's
// screens are DOM inside the shell; the shell owns Back. Shared state lives in app.ts.
import '@tohe/game-kit/overlay.css';
import './style.css';
import {
  choiceList,
  createShell,
  followTheme,
  formatScore,
  haptics,
  hintList,
  type Shell,
  type ShellScreen,
  type Theme,
} from '@tohe/game-kit';
import { activeMode, gameFor, levelLabel, persist, progressLine, session, sfx, store, t } from './app.ts';
import { modeHubContent } from './modes.ts';
import { PALETTE_IDS } from './palette.ts';
import { renderAlbum, renderDaily, renderJourney, type ScreenDeps } from './screens.ts';
import { samples } from './swatches.ts';

document.documentElement.lang = session.locale;
let theme: Theme = session.settings.theme;
followTheme(session, (next) => {
  theme = next;
});

let shell: Shell;

const playLevel = (id: string) => {
  store.pending = { level: id };
  store.lastMode = 'journey';
  void persist();
  shell.play(true);
};

const playDaily = (date: string) => {
  store.pending = { daily: date };
  store.lastMode = 'daily';
  void persist();
  shell.play(true);
};

const resumeMode = (mode: 'journey' | 'daily') => {
  store.lastMode = mode;
  void persist();
  shell.play(false);
};

const screenDeps = (): ScreenDeps => ({
  t,
  locale: session.locale,
  theme,
  palette: store.palette,
  journey: store.journey,
  dailyDates: store.dailyDates,
  album: store.album,
  achievements: store.achievements,
  stats: store.stats,
  best: store.best,
  journeyGame: gameFor('journey'),
  dailyGame: gameFor('daily'),
  onPlayLevel: playLevel,
  onResumeJourney: () => resumeMode('journey'),
  onResumeDaily: () => resumeMode('daily'),
  onPlayDaily: playDaily,
  onOpenScreen: (id) => shell.openScreen(id),
});

const screens: ShellScreen[] = [
  {
    id: 'journey',
    label: t.journey,
    icon: 'target',
    hidden: true,
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
    id: 'album',
    label: t.album,
    icon: 'star',
    hidden: false,
    render: (root) => renderAlbum(root, screenDeps()),
  },
];

const inProgress = (): string | null => {
  const mode = activeMode();
  if (!mode) return null;
  const game = gameFor(mode);
  if (!game) return null;
  if (mode === 'journey' && game.level)
    return t.inProgressLevel(levelLabel(game.level), formatScore(game.score, session.locale));
  if (mode === 'daily') return t.inProgressDaily(formatScore(game.score, session.locale));
  return t.inProgress(formatScore(game.score, session.locale));
};

shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  logo: 'icon.svg',
  // Blocks in the colours of its board (palette.ts) and the sparkle of a merge.
  decor: [
    { shape: 'square', colour: '#fb923c' },
    { shape: 'square', colour: '#9333ea' },
    { shape: 'square', colour: '#14b8a6' },
    { shape: 'sparkle', colour: '#f59e0b' },
  ],
  title: t.title,
  strings: { confirmTitle: t.confirmRestartTitle, confirmBody: t.confirmRestartBody },
  inProgress,
  // With a run waiting, the title's one job is Continue: the hub shows the other doors' progress and records.
  progress: () => (activeMode() ? null : progressLine()),
  best: () => (!activeMode() && store.best > 0 ? t.bestLine(formatScore(store.best, session.locale)) : null),
  howTo: () => ({ icon: { src: 'icon.svg' }, title: t.title, content: hintList(t.hints) }),
  prePlay: ({ choose, show }) => ({
    icon: { src: 'icon.svg' },
    title: t.modesTitle,
    body: t.modesBody,
    content: modeHubContent({
      t,
      locale: session.locale,
      // A choice from the hub replaces any level a screen asked for but never started.
      choose: (id, fresh) => {
        store.pending = {};
        choose(id, fresh);
      },
      show,
      format: (value) => formatScore(value, session.locale),
    }),
    actions: [],
  }),
  tutorial: {
    seen: () => store.tutorialSeen,
    done: () => {
      sfx.play('pop');
      haptics.play('tap');
      store.tutorialSeen = true;
      void persist();
    },
  },
  modes: [
    {
      label: t.classic,
      icon: 'trophy',
      variant: 'secondary',
      attributes: { 'data-mode': 'classic' },
      onClick: () => {
        store.lastMode = 'classic';
        void persist();
        if (gameFor('classic')) shell.play(false);
        else shell.play(true);
      },
    },
    {
      label: t.journey,
      icon: 'target',
      variant: 'secondary',
      attributes: { 'data-mode': 'journey' },
      onClick: () => shell.openScreen('journey'),
    },
    {
      label: t.daily,
      icon: 'timer',
      variant: 'secondary',
      attributes: { 'data-mode': 'daily' },
      onClick: () => shell.openScreen('daily'),
    },
  ],
  screens,
  settings: [
    {
      label: t.colours,
      icon: 'palette',
      when: 'any-time',
      content: () =>
        choiceList(
          PALETTE_IDS.map((id) => ({ id, label: t.palettes[id], preview: samples(id, theme) })),
          store.palette,
          (id) => {
            sfx.play('click');
            store.palette = id;
            void persist();
          },
        ),
    },
  ],
  leaderboard: true,
  stage: () => import('./stage.ts'),
});
shell.start();
