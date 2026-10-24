// The menu stage (ADR 0020): Vườn Rau's first screen — title, play, how to play, the pack's credits (the shell adds
// Ghi công by itself for a game with assets, ADR 0053) — with no engine running. Play loads stage.ts. One look
// (SPEC.md, "Themes"): the pixel world keeps its colours; the page follows the hub through the kit's tokens.
import '@tohe/game-kit/overlay.css';
import './style.css';
import { createShell, formatScore, haptics, hintList } from '@tohe/game-kit';
import { persist, session, sfx, store, t } from './app.ts';

document.documentElement.lang = session.locale;

const shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  logo: 'icon.svg',
  // Leaves and sunflowers, in the colours of the pack.
  decor: [
    { shape: 'circle', colour: '#84c669' },
    { shape: 'circle', colour: '#4e974c' },
    { shape: 'star', colour: '#fdbe53' },
    { shape: 'circle', colour: '#eaa56c' },
    { shape: 'star', colour: '#e38628' },
  ],
  title: t.title,
  inProgress: () => {
    const farm = store.farm;
    const started = farm.plots.some((plot) => plot.s !== 'grass') || farm.harvested.length > 0;
    return started ? t.inProgress(formatScore(farm.coins, session.locale)) : null;
  },
  best: () => null,
  howTo: () => ({ icon: { src: 'icon.svg' }, title: t.title, content: hintList([...t.hints]) }),
  tutorial: {
    seen: () => store.seenHowTo,
    done: () => {
      sfx.play('pop');
      haptics.play('tap');
      store.seenHowTo = true;
      void persist();
    },
  },
  stage: () => import('./stage.ts'),
});
shell.start();
