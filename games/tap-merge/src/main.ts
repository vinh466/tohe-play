// The menu stage (ADR 0020): Chạm Ghép's own first screen — title, play, settings (block colours), how to play, the
// leaderboard — with no engine
// running. Play loads stage.ts (fetched in the background meanwhile). Shared state lives in app.ts.
import '@tohe/game-kit/overlay.css';
import './style.css';
import {
  choiceList,
  createShell,
  followTheme,
  formatScore,
  haptics,
  hintList,
  type Theme,
} from '@tohe/game-kit';
import { persist, session, sfx, store, t } from './app.ts';
import { PALETTE_IDS } from './palette.ts';
import { samples } from './swatches.ts';

document.documentElement.lang = session.locale;
let theme: Theme = session.settings.theme;
followTheme(session, (next) => {
  theme = next;
});

const shell = createShell({
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
  inProgress: () => {
    const game = store.game;
    return game && game.moves > 0 && !game.over
      ? t.inProgress(formatScore(game.score, session.locale))
      : null;
  },
  best: () => (store.best > 0 ? t.bestLine(formatScore(store.best, session.locale)) : null),
  howTo: () => ({ icon: { src: 'icon.svg' }, title: t.title, content: hintList(t.hints) }),
  tutorial: {
    seen: () => store.tutorialSeen,
    done: () => {
      sfx.play('pop');
      haptics.play('tap');
      store.tutorialSeen = true;
      void persist();
    },
  },
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
