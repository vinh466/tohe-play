// The menu stage (ADR 0020): Ghép Khối's own first screen — title, play, ⚙️ (block colours), ❓, 🏆 — with no engine
// running. Play loads stage.ts (fetched in the background meanwhile). Shared state lives in app.ts. Watching a ranked
// run (ADR 0032) has no menu stage: the game opens straight into replay.ts. A challenge link ("Thách bạn", ADR 0045)
// opens play at once, the title screen behind it.
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
import { persist, rankedReplay, session, sfx, store, t } from './app.ts';
import { readEntry } from './challenge.ts';
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
  icon: '🧱',
  decor: ['🧱', '🟧', '🟨', '🟩', '🟦'],
  title: t.title,
  inProgress: () => {
    const game = store.game;
    return game && game.moves > 0 && !game.over
      ? t.inProgress(formatScore(game.score, session.locale))
      : null;
  },
  best: () => (store.best > 0 ? t.bestLine(formatScore(store.best, session.locale)) : null),
  howTo: () => ({ icon: '🧱', title: t.title, content: hintList(t.hints) }),
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
      label: `🎨 ${t.colours}`,
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
  // A challenge it opens: the stage plays it from the payload's seed (stage.ts reads it again from ctx.entry).
  entry: (entry) => readEntry(entry.kind, entry.payload).result,
  stage: () => (rankedReplay ? import('./replay.ts') : import('./stage.ts')),
  direct: rankedReplay ? { exitLabel: t.replay.leave, goesOn: false } : undefined,
});
shell.start();
