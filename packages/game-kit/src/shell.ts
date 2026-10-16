// The game shell (ADR 0018): every game opens on its main menu, plays with one ☰ button whose menu pauses what can
// pause and holds the way back to Tò He, and returns to the main menu. Built on the overlay, so every game looks and
// behaves the same; the hub draws nothing over a game that uses it (the `shell` capability).
//
//   main menu ──▶ playing ──☰ / Back──▶ menu ──▶ playing
//       ▲            │                    │
//       └── game over┴──── Menu chính ────┘          Back on the main menu leaves (session.exit()).
import type { GameSession } from '@tohe/game-sdk';
import { createOverlay, type Overlay, type OverlayAction, type OverlayCard } from './overlay.ts';

export interface ShellStrings {
  play: string;
  continue: string;
  newGame: string;
  confirmTitle: string;
  confirmBody: string;
  back: string;
  online: string;
  settings: string;
  settingsTitle: string;
  leaderboard: string;
  howTo: string;
  exit: string;
  paused: string;
  resume: string;
  menu: string;
  mainMenu: string;
  soundOn: string;
  soundOff: string;
  again: string;
  /** Under a setting that changes how a game plays, opened during one. */
  betweenGames: string;
  /** In the menu at an online table, which does not stop for anyone. */
  goesOn: string;
}

const STRINGS: Record<'vi' | 'en', ShellStrings> = {
  vi: {
    play: '▶ Chơi',
    continue: '▶ Chơi tiếp',
    newGame: 'Ván mới',
    confirmTitle: 'Bắt đầu ván mới?',
    confirmBody: 'Ván đang chơi sẽ kết thúc. Điểm đã đạt vẫn được tính.',
    back: 'Quay lại',
    online: '🌐 Chơi online',
    settings: '⚙️ Cài đặt',
    settingsTitle: 'Cài đặt',
    leaderboard: '🏆 Bảng xếp hạng',
    howTo: '❓ Cách chơi',
    exit: '← Về Tò He',
    paused: 'Tạm dừng',
    resume: '▶ Tiếp tục',
    menu: 'Menu',
    mainMenu: '☰ Menu chính',
    soundOn: '🔊 Âm thanh: bật',
    soundOff: '🔇 Âm thanh: tắt',
    again: 'Chơi lại',
    betweenGames: 'Đổi ở menu chính, áp dụng từ ván sau.',
    goesOn: 'Bàn vẫn tiếp tục khi bạn mở menu.',
  },
  en: {
    play: '▶ Play',
    continue: '▶ Continue',
    newGame: 'New game',
    confirmTitle: 'Start a new game?',
    confirmBody: 'The game in progress will end. The points you scored still count.',
    back: 'Back',
    online: '🌐 Play online',
    settings: '⚙️ Settings',
    settingsTitle: 'Settings',
    leaderboard: '🏆 Leaderboard',
    howTo: '❓ How to play',
    exit: '← Back to Tò He',
    paused: 'Paused',
    resume: '▶ Resume',
    menu: 'Menu',
    mainMenu: '☰ Main menu',
    soundOn: '🔊 Sound: on',
    soundOff: '🔇 Sound: off',
    again: 'Play again',
    betweenGames: 'Change it from the main menu; it applies from the next game.',
    goesOn: 'The table goes on while your menu is open.',
  },
};

export const shellStrings = (locale: string): ShellStrings =>
  locale.startsWith('vi') ? STRINGS.vi : STRINGS.en;

export interface ShellSetting {
  label: string;
  /** `between-games` changes how a game plays: read-only while one is on. `any-time`: looks, at once. */
  when: 'between-games' | 'any-time';
  /** The setting's card; `readOnly` when it cannot change now. Its buttons are the shell's. */
  card(readOnly: boolean): Omit<OverlayCard, 'actions'>;
}

/** The parts of the session the shell uses; any game's session fits, whatever its save. */
export type ShellSessionLike = Pick<
  GameSession<never>,
  'mode' | 'locale' | 'settings' | 'shell' | 'exit' | 'on'
>;

export interface ShellOptions {
  session: ShellSessionLike;
  /** Where the shell's overlay goes (usually the game's root element). */
  root: HTMLElement;
  title: string;
  /** Emoji shown large on the main menu. */
  icon: string;
  strings?: Partial<ShellStrings>;
  /** The game in progress in a few words (e.g. "Điểm 1.234"), or null: decides "Chơi" or "Chơi tiếp". */
  inProgress(): string | null;
  /** Leave the main menu and play: continue the game in progress, or start one when there is none. */
  play(): void;
  /** The player chose a fresh game over the one in progress (or after a game ended): start it. */
  newGame(): void;
  howTo(): Omit<OverlayCard, 'actions'>;
  settings?: ShellSetting[];
  /** The game has online rooms: "Chơi online" when the hub can open the lobby. */
  online?: boolean;
  /** The game keeps scores: "Bảng xếp hạng" when the hub can show it. */
  leaderboard?: boolean;
  /** Play stops (clock, bots) while the game is not on screen: a menu or the main menu is open. */
  onPause?(): void;
  onResume?(): void;
  /**
   * Opened straight into play, with no main menu: an online table, a replay. `goesOn` when nothing stops for the
   * menu (a table); `exitLabel` names the way out (the hub asks before giving a seat up).
   */
  direct?: { exitLabel: string; goesOn: boolean };
  /** Draws the cards; by default the kit's overlay in `root`. Tests pass their own. */
  overlay?: Overlay;
}

export interface Shell {
  /** For the game's own cards (first-time hints, results): they come back when the menu closes. */
  readonly overlay: Overlay;
  /** True while the game is on screen with no shell menu over it. */
  readonly playing: boolean;
  mainMenu(): void;
  /** The in-game menu (☰, phone Back, Escape). */
  menu(): void;
  /** ☰ for the game's HUD. */
  menuButton(): HTMLButtonElement;
  /** A finished game: its card with "Chơi lại" (or `again`) and "Menu chính". */
  gameOver(card: Omit<OverlayCard, 'actions'>, again?: OverlayAction): void;
}

type Screen = 'main' | 'playing' | 'menu' | 'sub';

export function createShell(options: ShellOptions): Shell {
  const { session } = options;
  const t: ShellStrings = { ...shellStrings(session.locale), ...options.strings };
  const raw = options.overlay ?? createOverlay(options.root);
  const embedded = session.mode === 'embedded';
  let screen: Screen = options.direct ? 'playing' : 'main';
  /** Where a card opened from a menu goes back to. */
  let parent: () => void = () => {};
  /** The game's own card, shown while playing and brought back after a menu. */
  let gameCard: OverlayCard | null = null;

  /** Tells the hub whether a menu is up; every step answers its Back, so the hub knows the game is alive. */
  const report = (open: boolean) => session.shell.menuChanged(open);
  const show = (next: Screen, card: OverlayCard) => {
    if (screen === 'playing' && next !== 'playing') options.onPause?.();
    screen = next;
    raw.show(card);
    report(true);
  };
  const enterPlaying = () => {
    const was = screen;
    screen = 'playing';
    if (gameCard) raw.show(gameCard);
    else raw.hide();
    report(false);
    if (was !== 'playing') options.onResume?.();
  };

  const exitAction = (): OverlayAction => ({
    label: options.direct?.exitLabel ?? t.exit,
    variant: 'secondary',
    attributes: { 'data-tohe-exit': '' },
    onClick: () => session.exit(),
  });
  const sub = (card: Omit<OverlayCard, 'actions'>, back: () => void) => {
    parent = back;
    show('sub', { ...card, actions: [{ label: t.back, onClick: back }] });
  };
  const soundAction = (again: () => void): OverlayAction => ({
    label: session.settings.muted ? t.soundOff : t.soundOn,
    variant: 'secondary',
    onClick: () => {
      session.shell.setMuted(!session.settings.muted);
      again();
    },
  });

  /** `during`: opened from the in-game menu, so settings that change how a game plays are read-only. */
  const settingsCard = (from: () => void, during: boolean) => {
    const open = () => settingsCard(from, during);
    parent = from;
    show('sub', {
      icon: '⚙️',
      title: t.settingsTitle,
      actions: [
        soundAction(open),
        ...(options.settings ?? []).map(
          (setting): OverlayAction => ({
            label: setting.label,
            variant: 'secondary',
            onClick: () => {
              const readOnly = during && setting.when === 'between-games';
              const card = setting.card(readOnly);
              const body = card.body ? `${card.body} ${t.betweenGames}` : t.betweenGames;
              sub(readOnly ? { ...card, body } : card, open);
            },
          }),
        ),
        { label: t.back, onClick: from },
      ],
    });
  };

  const confirmNew = (back: () => void) => {
    parent = back;
    show('sub', {
      icon: '🔄',
      title: t.confirmTitle,
      body: t.confirmBody,
      actions: [
        { label: t.back, onClick: back },
        {
          label: t.newGame,
          variant: 'secondary',
          onClick: () => {
            gameCard = null;
            enterPlaying();
            options.newGame();
          },
        },
      ],
    });
  };

  const shell: Shell = {
    overlay: {
      show(card) {
        gameCard = card;
        if (screen === 'playing') raw.show(card);
      },
      hide() {
        gameCard = null;
        if (screen === 'playing') raw.hide();
      },
      get visible() {
        return raw.visible;
      },
    },
    get playing() {
      return screen === 'playing' && !raw.visible;
    },
    mainMenu() {
      if (options.direct) return;
      const summary = options.inProgress();
      const can = session.shell.can;
      show('main', {
        icon: options.icon,
        title: options.title,
        body: summary ?? undefined,
        menu: true,
        actions: [
          {
            label: summary ? t.continue : t.play,
            attributes: { 'data-tohe-play': '' },
            onClick: () => {
              enterPlaying();
              options.play();
            },
          },
          ...(summary
            ? [{ label: t.newGame, variant: 'secondary' as const, onClick: () => confirmNew(shell.mainMenu) }]
            : []),
          ...(options.online && can.rooms
            ? [{ label: t.online, variant: 'secondary' as const, onClick: () => session.shell.open('rooms') }]
            : []),
          { label: t.settings, variant: 'secondary', onClick: () => settingsCard(shell.mainMenu, false) },
          ...(options.leaderboard && can.leaderboard
            ? [
                {
                  label: t.leaderboard,
                  variant: 'secondary' as const,
                  onClick: () => session.shell.open('leaderboard'),
                },
              ]
            : []),
          { label: t.howTo, variant: 'secondary', onClick: () => sub(options.howTo(), shell.mainMenu) },
          ...(embedded ? [exitAction()] : []),
        ],
      });
    },
    menu() {
      if (screen !== 'playing' && screen !== 'menu') return;
      const again = () => {
        screen = 'menu';
        shell.menu();
      };
      const direct = options.direct;
      show('menu', {
        icon: direct?.goesOn ? '☰' : '⏸️',
        title: direct?.goesOn ? t.menu : t.paused,
        body: direct?.goesOn ? t.goesOn : undefined,
        menu: true,
        actions: [
          { label: t.resume, onClick: enterPlaying },
          soundAction(again),
          { label: t.howTo, variant: 'secondary', onClick: () => sub(options.howTo(), again) },
          { label: t.settings, variant: 'secondary', onClick: () => settingsCard(again, true) },
          ...(direct ? [] : [{ label: t.mainMenu, variant: 'secondary' as const, onClick: shell.mainMenu }]),
          ...(embedded || direct ? [exitAction()] : []),
        ],
      });
    },
    menuButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tohe-icon-button';
      button.setAttribute('aria-label', t.menu);
      button.dataset.toheMenu = '';
      button.textContent = '☰';
      button.addEventListener('click', () => shell.menu());
      return button;
    },
    gameOver(card, again) {
      shell.overlay.show({
        ...card,
        actions: [
          again ?? {
            label: t.again,
            onClick: () => {
              gameCard = null;
              enterPlaying();
              options.newGame();
            },
          },
          ...(options.direct
            ? [exitAction()]
            : [
                {
                  label: t.mainMenu,
                  variant: 'secondary' as const,
                  onClick: () => {
                    gameCard = null;
                    shell.mainMenu();
                  },
                },
              ]),
        ],
      });
    },
  };

  /** Phone Back and Escape: one step back, and out from the main menu. */
  const back = () => {
    if (screen === 'playing') shell.menu();
    else if (screen === 'menu') enterPlaying();
    else if (screen === 'sub') parent();
    else if (embedded) session.exit();
  };
  session.on('menu', back);
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      back();
    });
  }
  return shell;
}
