// The menu stage (ADR 0020) against bots: Tiến Lên's own first screen — title, 🤖 play, 🔄 a new table, 🌐 online,
// ⚙️ (house rules, players and level, the deck), ❓ — with no table running. Play loads stage.ts (fetched in the
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
  icon: '🃏',
  decor: ['🃏', '♠️', '♥️', '♣️', '♦️'],
  title: t.title,
  strings: {
    play: t.playBots,
    newGame: `🔄 ${t.newTable}`,
    newGameShort: t.newTable,
    confirmTitle: t.newTableTitle,
    confirmBody: t.newTableBody,
  },
  inProgress: () => (store.dealt && !store.state.over ? t.handInProgress : null),
  howTo: () => ({ icon: '🃏', title: t.title, content: hintList(t.hints) }),
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
    { label: `📜 ${t.menu.rules}`, when: 'between-games', content: houseRules },
    { label: `🪑 ${t.menu.table}`, when: 'between-games', content: tableSettings },
    { label: `🎴 ${t.menu.deck}`, when: 'any-time', content: deckPicker },
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
