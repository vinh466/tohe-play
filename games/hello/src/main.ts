// The menu stage (ADR 0020) of the minimal game: Chạm Chấm's title screen, its how-to and 🏆, on the kit's engine-free
// shell like every other game. Play loads stage.ts: a Canvas 2D board and its 20-second rounds.
import '@tohe/game-kit/overlay.css';
import './style.css';
import { createShell, followTheme } from '@tohe/game-kit';
import { persist, session, store, t } from './app.ts';

document.documentElement.lang = session.locale;
followTheme(session);

const shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  icon: '🟠',
  decor: ['🟠', '🟡', '🔴', '⭐'],
  title: t.title,
  // A 20-second round is not worth continuing later: the title screen always starts a fresh one.
  inProgress: () => null,
  best: () => (store.best > 0 ? t.bestLine(store.best) : null),
  howTo: () => ({ icon: '🟠', title: t.title, body: `${t.intro} ${t.hints}` }),
  tutorial: {
    seen: () => store.tutorialSeen,
    done: () => {
      store.tutorialSeen = true;
      void persist();
    },
  },
  leaderboard: true,
  countdown: true,
  stage: () => import('./stage.ts'),
});
shell.start();
