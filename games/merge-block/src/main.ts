// The menu stage (ADR 0020): Ghép Khối's own first screen — title, play, settings (block colours and the Workshop),
// how to play, the leaderboard — with no engine running. Play loads stage.ts (fetched in the background meanwhile).
// Shared state lives in app.ts. Watching a ranked run (ADR 0032) has no menu stage: the game opens straight into
// replay.ts. A challenge link ("Thách bạn", ADR 0045) opens play at once, the title screen behind it.
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
import { localDate, persist, rankedReplay, session, sfx, store, t } from './app.ts';
import { readEntry } from './challenge.ts';
import type { Mode } from './logic.ts';
import { PALETTE_IDS } from './palette.ts';
import { samples } from './swatches.ts';
import { workshopContent } from './workshop.ts';

document.documentElement.lang = session.locale;
let theme: Theme = session.settings.theme;
followTheme(session, (next) => {
  theme = next;
});

/** The run Chơi tiếp resumes: the last mode played, or any run still in progress. */
function runInProgress(): { mode: Mode; score: number } | null {
  const order: Mode[] = [store.last, 'classic', 'orders', 'daily'];
  for (const mode of order) {
    if (mode === 'classic' && store.game && !store.game.over) {
      return { mode, score: store.game.score };
    }
    if (mode === 'orders' && store.orders && !store.orders.over) {
      return { mode, score: store.orders.score };
    }
    if (mode === 'daily' && store.daily?.game && !store.daily.game.over && store.daily.date === localDate()) {
      return { mode, score: store.daily.game.score };
    }
  }
  return null;
}

const shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  logo: 'icon.svg',
  // Blocks in the colours of its board (palette.ts).
  decor: [
    { shape: 'square', colour: '#fb923c' },
    { shape: 'square', colour: '#dc2626' },
    { shape: 'square', colour: '#9333ea' },
    { shape: 'square', colour: '#2563eb' },
    { shape: 'square', colour: '#14b8a6' },
  ],
  title: t.title,
  inProgress: () => {
    const run = runInProgress();
    return run ? t.inProgress(t.modeNames[run.mode], formatScore(run.score, session.locale)) : null;
  },
  best: () => {
    const best = store.best > 0 ? t.bestLine(formatScore(store.best, session.locale)) : null;
    const scrap = store.workshop.scrap > 0 ? t.scrapLine(String(store.workshop.scrap)) : null;
    return [best, scrap].filter(Boolean).join(' · ') || null;
  },
  howTo: () => ({ icon: { src: 'icon.svg' }, title: t.title, content: hintList(t.hints) }),
  tutorial: {
    seen: () => store.tutorialSeen,
    done: () => {
      sfx.play('pop');
      haptics.play('tap');
      store.tutorialSeen = true;
      session.telemetry.count('tutorial.beat.4');
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
    {
      label: t.workshop.title,
      icon: 'gear-six',
      when: 'any-time',
      content: () =>
        workshopContent({
          t,
          theme,
          palette: store.palette,
          onPalette: (id) => {
            store.palette = id;
            void persist();
          },
        }),
    },
  ],
  leaderboard: true,
  // A challenge it opens: the stage plays it from the payload's seed (stage.ts reads it again from ctx.entry).
  entry: (entry) => readEntry(entry.kind, entry.payload).result,
  stage: () => (rankedReplay ? import('./replay.ts') : import('./stage.ts')),
  direct: rankedReplay ? { exitLabel: t.replay.leave, goesOn: false } : undefined,
});
shell.start();
