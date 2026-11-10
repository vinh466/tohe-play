import '@tohe/design-tokens/tokens.css';
import '@tohe/design-tokens/fonts.css';
import '@tohe/game-kit/overlay.css';
import './style.css';
import { createShell, hintList } from '@tohe/game-kit';
import { persist, session, store, t } from './app.ts';

document.documentElement.dataset.theme = 'dark';

const shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  logo: 'icon.svg',
  title: t.title,
  // A world, not a run: the title says Chơi tiếp and the panel has no Ván mới.
  persistent: true,
  inProgress: () => t.progress(store.save),
  howTo: () => ({
    icon: { src: 'icon.svg' },
    title: t.howToTitle,
    content: hintList(t.hints.map((text, index) => ({ icon: ['▸', '◆', '✦', '☾'][index] ?? '▸', text }))),
  }),
  tutorial: {
    seen: () => store.save.tutorial.seen,
    done: () => {
      store.set({ ...store.save, tutorial: { seen: true } });
      void persist();
    },
  },
  settings: [
    {
      label: t.autoCast,
      icon: 'lightbulb',
      when: 'any-time',
      content: () => {
        const row = document.createElement('label');
        row.className = 'setting-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = store.save.settings.autoCast;
        input.addEventListener('change', () => {
          store.set({ ...store.save, settings: { ...store.save.settings, autoCast: input.checked } });
        });
        row.append(input, document.createTextNode(t.autoCastNote));
        return row;
      },
    },
    {
      label: t.reducedMotion,
      icon: 'shield',
      when: 'any-time',
      content: () => {
        const row = document.createElement('label');
        row.className = 'setting-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = store.save.settings.reducedMotion;
        input.addEventListener('change', () => {
          store.set({ ...store.save, settings: { ...store.save.settings, reducedMotion: input.checked } });
        });
        row.append(input, document.createTextNode(t.reducedMotionNote));
        return row;
      },
    },
  ],
  stage: () => import('./stage.ts'),
});

shell.start();
