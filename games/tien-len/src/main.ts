// The menu stage (ADR 0020) against bots: Tiến Lên's own first screen — title, play against the bots, a new table,
// online, settings (house rules, players and level, the deck), how to play — with no table running. Play loads stage.ts (fetched in the
// background meanwhile). At an online table or in a replay there is no menu stage: the game opens straight into play.
import '@tohe/game-kit/overlay.css';
import './style.css';
import { createShell, followTheme, haptics, hintList } from '@tohe/game-kit';
import { persist, replay, room, session, sfx, store, t } from './app.ts';
import { deckPicker, houseRules, tableSettings } from './settings.ts';

document.documentElement.lang = session.locale;
followTheme(session);

const shell = createShell({
  session,
  root: document.querySelector<HTMLElement>('#app') as HTMLElement,
  logo: 'icon.svg',
  // The four suits of its cards (cardArt.ts): black ones in the page's ink, so they show in light and dark.
  decor: [
    { shape: 'spade', colour: 'var(--tohe-ink)' },
    { shape: 'heart', colour: '#dc2626' },
    { shape: 'club', colour: 'var(--tohe-ink)' },
    { shape: 'diamond', colour: '#dc2626' },
  ],
  playIcon: 'robot',
  title: t.title,
  strings: {
    play: t.playBots,
    newGame: t.newTable,
    newGameShort: t.newTable,
    confirmTitle: t.newTableTitle,
    confirmBody: t.newTableBody,
  },
  inProgress: () => (store.dealt && !store.state.over ? t.handInProgress : null),
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
    { label: t.menu.rules, icon: 'scroll', when: 'between-games', content: houseRules },
    { label: t.menu.table, icon: 'chair', when: 'between-games', content: tableSettings },
    { label: t.menu.deck, icon: 'cards', when: 'any-time', content: deckPicker },
  ],
  online: true,
  stage: () => import('./stage.ts'),
  direct: room
    ? { exitLabel: room.seat < 0 ? t.stopWatching : t.leaveTable, goesOn: true }
    : replay
      ? { exitLabel: t.replay.leave, goesOn: false }
      : undefined,
});
shell.start();
