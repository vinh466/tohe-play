// The game shell (ADR 0018, ADR 0019): every game opens on its title screen, plays with one ☰ button whose menu
// pauses what can pause and holds the way back to Tò He, and comes back to the title screen. A game brings its
// content (name, picture, how to play, settings, scores or rooms); the kit owns the screens, their order, words and
// look, so every game behaves the same and a new game inherits all of it.
//
//   start() ─▶ title ──Chơi──▶ (how to play, the first time) ──▶ playing ──☰ / Back / hidden──▶ menu ─┐
//                ▲                                                  │  ▲                                │
//                │                                                  │  └──── Tiếp tục (3-2-1 if timed) ┘
//                └────── Menu chính / Back ◀── game over ◀──────────┘
//   Back steps back one screen; from the title screen it leaves Tò He's game (session.exit()).
import type { GameSession } from '@tohe/game-sdk';
import { createOverlay, type Overlay, type OverlayAction, type OverlayCard } from './overlay.ts';

export interface ShellStrings {
  play: string;
  continue: string;
  /** The first-time how-to's button. */
  start: string;
  newGame: string;
  confirmTitle: string;
  confirmBody: string;
  back: string;
  online: string;
  settings: string;
  leaderboard: string;
  /** The leaderboard's caption under its picture. */
  leaderboardShort: string;
  howTo: string;
  sound: string;
  soundOn: string;
  soundOff: string;
  exit: string;
  paused: string;
  resume: string;
  menu: string;
  mainMenu: string;
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
    start: '▶ Bắt đầu',
    newGame: '🔄 Ván mới',
    confirmTitle: 'Bắt đầu ván mới?',
    confirmBody: 'Ván đang chơi sẽ kết thúc. Điểm đã đạt vẫn được tính.',
    back: 'Quay lại',
    online: '🌐 Chơi online',
    settings: 'Cài đặt',
    leaderboard: 'Bảng xếp hạng',
    leaderboardShort: 'Xếp hạng',
    howTo: 'Cách chơi',
    sound: 'Âm thanh',
    soundOn: 'Âm thanh: bật',
    soundOff: 'Âm thanh: tắt',
    exit: '← Về Tò He',
    paused: 'Tạm dừng',
    resume: '▶ Tiếp tục',
    menu: 'Menu',
    mainMenu: '☰ Menu chính',
    again: '▶ Chơi lại',
    betweenGames: 'Đổi ở menu chính, áp dụng từ ván sau.',
    goesOn: 'Bàn vẫn tiếp tục khi bạn mở menu.',
  },
  en: {
    play: '▶ Play',
    continue: '▶ Continue',
    start: '▶ Start',
    newGame: '🔄 New game',
    confirmTitle: 'Start a new game?',
    confirmBody: 'The game in progress will end. The points you scored still count.',
    back: 'Back',
    online: '🌐 Play online',
    settings: 'Settings',
    leaderboard: 'Leaderboard',
    leaderboardShort: 'Scores',
    howTo: 'How to play',
    sound: 'Sound',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    exit: '← Back to Tò He',
    paused: 'Paused',
    resume: '▶ Resume',
    menu: 'Menu',
    mainMenu: '☰ Main menu',
    again: '▶ Play again',
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
  /** Emoji shown large on the title screen. */
  icon: string;
  strings?: Partial<ShellStrings>;
  /** The game in progress in a few words (e.g. "Điểm 1.234"), or null: decides "Chơi" or "Chơi tiếp". */
  inProgress(): string | null;
  /** Leave the title screen and play: continue the game in progress, or start one when there is none. */
  play(): void;
  /** The player chose a fresh game over the one in progress (or after a game ended): start it. */
  newGame(): void;
  howTo(): Omit<OverlayCard, 'actions'>;
  /**
   * First-time help: the how-to card shows before the first play until `seen()`; `done()` runs once play has
   * started from it (remember it in the save, point at a first move).
   */
  tutorial?: { seen(): boolean; done(): void };
  settings?: ShellSetting[];
  /** The game has online rooms: "Chơi online" when the hub can open the lobby. */
  online?: boolean;
  /** The game keeps scores: the leaderboard when the hub can show it. */
  leaderboard?: boolean;
  /** Play stops (clock, bots, animations) while a shell screen covers it; `onResume` when play goes on. */
  onPause?(): void;
  onResume?(): void;
  /** Play runs against the clock: going on from the menu counts 3, 2, 1 first. */
  countdown?: boolean;
  /**
   * Opened straight into play, with no title screen: an online table, a replay. `goesOn` when nothing stops for the
   * menu (a table); `exitLabel` names the way out (the hub asks before giving a seat up).
   */
  direct?: { exitLabel: string; goesOn: boolean };
  /** Draws the cards; by default the kit's overlay in `root`. Tests pass their own. */
  overlay?: Overlay;
}

export interface Shell {
  /** For the game's own cards (first-time hints, results): they come back when a menu over them closes. */
  readonly overlay: Overlay;
  /** True while the game is on screen with nothing over it. */
  readonly playing: boolean;
  /**
   * The game's first frame is ready: show the title screen (or play, when opened directly). This is also the hub's
   * sign to lift its loading screen, so call it once the board is drawn, not before.
   */
  start(): void;
  /** The title screen (the game in progress stays: "Chơi tiếp"). */
  mainMenu(): void;
  /** The in-game menu (☰, phone Back, Escape, the hub hiding the game). */
  menu(): void;
  /** ☰ for the game's HUD (createHud puts it first). */
  menuButton(): HTMLButtonElement;
  /** A finished game: its card with "Chơi lại" (or `again`) and "Menu chính"; Back goes to the title screen. */
  gameOver(card: Omit<OverlayCard, 'actions'>, again?: OverlayAction): void;
}

type Screen = 'boot' | 'title' | 'intro' | 'playing' | 'menu' | 'sub' | 'count' | 'over';

/** One number of the 3-2-1 before play goes on. */
const COUNT_MS = 650;

export function createShell(options: ShellOptions): Shell {
  const { session, direct } = options;
  const t: ShellStrings = { ...shellStrings(session.locale), ...options.strings };
  const raw = options.overlay ?? createOverlay(options.root);
  const embedded = session.mode === 'embedded';
  let screen: Screen = 'boot';
  /** Play is stopped for a shell screen: onPause ran, onResume has not yet. */
  let paused = false;
  /** Where a card opened from a menu goes back to. */
  let parent: () => void = () => {};
  /** The game's own card, shown while playing and brought back after a menu. */
  let gameCard: OverlayCard | null = null;
  /** A game that ended while a menu was open: its card shows when play would go on. */
  let ended: OverlayCard | null = null;
  /** The end card on screen, kept while a menu opens over it (a replay's). */
  let shownOver: OverlayCard | null = null;
  let counting: ReturnType<typeof setTimeout> | null = null;

  /** Tells the hub whether a shell screen is up; every step answers its Back, so the hub knows the game is alive. */
  const report = (open: boolean) => session.shell.menuChanged(open);
  const pause = () => {
    if (paused) return;
    paused = true;
    options.onPause?.();
  };
  const resume = () => {
    if (!paused) return;
    paused = false;
    options.onResume?.();
  };
  const stopCounting = () => {
    if (counting !== null) clearTimeout(counting);
    counting = null;
  };

  /** A shell screen: play stops under it. */
  const show = (next: Screen, card: OverlayCard) => {
    stopCounting();
    pause();
    screen = next;
    raw.show(card);
    report(true);
  };
  const showOver = (card: OverlayCard) => {
    stopCounting();
    shownOver = card;
    screen = 'over';
    raw.show(card);
    report(true);
  };
  const enterPlaying = () => {
    stopCounting();
    if (ended) {
      const card = ended;
      ended = null;
      resume();
      showOver(card);
      return;
    }
    screen = 'playing';
    if (gameCard) raw.show(gameCard);
    else raw.hide();
    report(false);
    resume();
  };
  /** From the menu back to play: 3, 2, 1 first for a game against the clock. */
  const goOn = () => {
    if (!options.countdown || ended || gameCard || !paused) return enterPlaying();
    const count = (n: number) => {
      screen = 'count';
      raw.show({ layout: 'count', title: String(n), actions: [] });
      report(false);
      counting = setTimeout(() => (n > 1 ? count(n - 1) : enterPlaying()), COUNT_MS);
    };
    count(3);
  };
  /** Play from the title screen (or a new game): the how-to first, the first time. */
  const begin = (startPlay: () => void) => {
    const tutorial = options.tutorial;
    if (tutorial && !tutorial.seen()) {
      parent = titleScreen;
      show('intro', {
        ...options.howTo(),
        actions: [
          {
            label: t.start,
            attributes: { 'data-tohe-play': '' },
            onClick: () => {
              enterPlaying();
              startPlay();
              tutorial.done();
            },
          },
        ],
      });
      return;
    }
    enterPlaying();
    startPlay();
  };

  const exitAction = (): OverlayAction => ({
    label: direct?.exitLabel ?? t.exit,
    variant: 'quiet',
    attributes: { 'data-tohe-exit': '' },
    onClick: () => session.exit(),
  });
  const sub = (card: Omit<OverlayCard, 'actions'>, back: () => void) => {
    parent = back;
    show('sub', { ...card, actions: [{ label: t.back, onClick: back }] });
  };
  const toggleSound = (again: () => void) => {
    session.shell.setMuted(!session.settings.muted);
    again();
  };
  const soundTool = (again: () => void): OverlayAction => ({
    icon: session.settings.muted ? '🔇' : '🔊',
    label: t.sound,
    ariaLabel: session.settings.muted ? t.soundOff : t.soundOn,
    onClick: () => toggleSound(again),
  });
  const settingsTool = (from: () => void, during: boolean): OverlayAction => ({
    icon: '⚙️',
    label: t.settings,
    onClick: () => settingsCard(from, during),
  });
  const howToTool = (from: () => void): OverlayAction => ({
    icon: '❓',
    label: t.howTo,
    onClick: () => sub(options.howTo(), from),
  });

  /** `during`: opened from the in-game menu, so settings that change how a game plays are read-only. */
  const settingsCard = (from: () => void, during: boolean) => {
    const open = () => settingsCard(from, during);
    parent = from;
    const muted = session.settings.muted;
    show('sub', {
      icon: '⚙️',
      title: t.settings,
      layout: 'menu',
      actions: [
        {
          label: `${muted ? '🔇' : '🔊'} ${muted ? t.soundOff : t.soundOn}`,
          variant: 'secondary',
          onClick: () => toggleSound(open),
        },
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
            ended = null;
            begin(options.newGame);
          },
        },
      ],
    });
  };

  function titleScreen() {
    if (direct) return pauseMenu();
    // A game that ended under the menu is behind the player now: Chơi starts the next one.
    ended = null;
    const summary = options.inProgress();
    const can = session.shell.can;
    show('title', {
      layout: 'title',
      icon: options.icon,
      title: options.title,
      body: summary ?? undefined,
      corner: embedded ? { ...exitAction(), ariaLabel: t.exit.replace(/^←\s*/, '') } : undefined,
      actions: [
        {
          label: summary ? t.continue : t.play,
          attributes: { 'data-tohe-play': '' },
          onClick: () => begin(options.play),
        },
        ...(summary
          ? [{ label: t.newGame, variant: 'secondary' as const, onClick: () => confirmNew(titleScreen) }]
          : []),
        ...(options.online && can.rooms
          ? [{ label: t.online, variant: 'secondary' as const, onClick: () => session.shell.open('rooms') }]
          : []),
      ],
      tools: [
        soundTool(titleScreen),
        settingsTool(titleScreen, false),
        ...(options.leaderboard && can.leaderboard
          ? [
              {
                icon: '🏆',
                label: t.leaderboardShort,
                ariaLabel: t.leaderboard,
                onClick: () => session.shell.open('leaderboard'),
              },
            ]
          : []),
        howToTool(titleScreen),
      ],
    });
  }

  function pauseMenu() {
    // Over an end card (a replay's), the menu goes back to it.
    if (screen === 'over' && shownOver) ended = shownOver;
    const goesOn = direct?.goesOn ?? false;
    show('menu', {
      layout: 'menu',
      icon: goesOn ? '☰' : '⏸️',
      title: goesOn ? t.menu : t.paused,
      body: goesOn ? t.goesOn : undefined,
      actions: [
        { label: t.resume, onClick: goOn },
        ...(direct
          ? []
          : [
              { label: t.newGame, variant: 'secondary' as const, onClick: () => confirmNew(pauseMenu) },
              { label: t.mainMenu, variant: 'secondary' as const, onClick: titleScreen },
            ]),
      ],
      tools: [soundTool(pauseMenu), settingsTool(pauseMenu, true), howToTool(pauseMenu)],
      footer: embedded || direct ? exitAction() : undefined,
    });
  }

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
    start() {
      if (screen !== 'boot') return;
      if (direct) enterPlaying();
      else titleScreen();
    },
    mainMenu() {
      if (screen === 'boot') return shell.start();
      titleScreen();
    },
    menu() {
      if (screen === 'playing' || screen === 'menu' || screen === 'count' || (screen === 'over' && direct)) {
        pauseMenu();
      }
    },
    menuButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tohe-icon-button tohe-menu-button';
      button.setAttribute('aria-label', t.menu);
      button.dataset.toheMenu = '';
      button.textContent = '☰';
      button.addEventListener('click', () => shell.menu());
      return button;
    },
    gameOver(card, again) {
      gameCard = null;
      const over: OverlayCard = {
        ...card,
        actions: [
          again
            ? {
                ...again,
                onClick: () => {
                  enterPlaying();
                  again.onClick();
                },
              }
            : { label: t.again, onClick: () => begin(options.newGame) },
          direct ? exitAction() : { label: t.mainMenu, variant: 'secondary', onClick: titleScreen },
        ],
      };
      if (screen === 'playing' || screen === 'count') showOver(over);
      else ended = over;
    },
  };

  /** Phone Back and Escape: one step back, and out from the title screen. */
  const back = () => {
    if (screen === 'playing' || screen === 'count') pauseMenu();
    else if (screen === 'menu') goOn();
    else if (screen === 'sub' || screen === 'intro') parent();
    else if (screen === 'over') {
      if (direct) pauseMenu();
      else titleScreen();
    } else if (screen === 'title' && embedded) session.exit();
  };
  session.on('menu', back);
  // The hub hid the game (another app, a locked phone): play waits in the menu, like any game. A table goes on.
  session.on('pause', () => {
    if ((screen === 'playing' && !direct?.goesOn) || screen === 'count') pauseMenu();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      back();
    });
  }
  return shell;
}
