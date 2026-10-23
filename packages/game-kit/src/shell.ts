// The game shell (ADR 0018–0020). Every game has two stages:
//
// - the MENU STAGE, its own first screen: the title, play, its options as full screens, the leaderboard and online
//   play, and the only way back to Tò He. It runs no engine and draws no board;
// - the PLAY STAGE, created when the player presses play (its module is fetched in the background while the menu is
//   up), saved and destroyed when the player goes back to the menu. Over it, one Menu button opens a quick panel with
//   what fits a game in progress — resume, sound and the game's looks applied in place, a new game, how to play, the menu.
//
//   menu stage                                        play stage
//   title ─settings/how-to/new game─▶ full screen      loading ─▶ playing ◀─▶ panel (Menu, Back, the hub hiding it;
//     │ Chơi (the how-to first, the first time) ─────▶   │                    3-2-1 before a timed game goes on)
//     ◀──────────── Menu chính / the end of a game ──────┘
//     └─ Back / Về Tò He ─▶ Tò He
//
// Opened by an entry the game handles (a share link's payload, ADR 0045), play opens at once with the title screen
// behind it, reached from the panel's Menu chính as usual; any other answer opens the title screen.
//
// A game brings its content; the kit owns the stages, their screens, words and look. The words are only words: the kit
// draws each control's icon beside them (icons.ts, ADR 0049), and a game's logo is its own art.
import type { EntryResult, GameSession, SessionEntry } from '@tohe/game-sdk';
import { icon as drawIcon, type IconName } from './icons.ts';
import {
  createOverlay,
  type DecorShape,
  type Overlay,
  type OverlayAction,
  type OverlayCard,
  type OverlayRow,
} from './overlay.ts';

export interface ShellStrings {
  play: string;
  continue: string;
  /** The first-time how-to's button. */
  start: string;
  newGame: string;
  /** The caption of the new-game tool in the in-game panel. */
  newGameShort: string;
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
  /** The caption of the main-menu tool in the in-game panel. */
  mainMenuShort: string;
  again: string;
  loading: string;
  failed: string;
  /** Under a setting that changes how a game plays, while one is in progress. */
  betweenGames: string;
  /** In the menu at an online table, which does not stop for anyone. */
  goesOn: string;
}

const STRINGS: Record<'vi' | 'en', ShellStrings> = {
  vi: {
    play: 'Chơi',
    continue: 'Chơi tiếp',
    start: 'Bắt đầu',
    newGame: 'Ván mới',
    newGameShort: 'Ván mới',
    confirmTitle: 'Bắt đầu ván mới?',
    confirmBody: 'Ván đang chơi sẽ kết thúc. Điểm đã đạt vẫn được tính.',
    back: 'Quay lại',
    online: 'Chơi online',
    settings: 'Cài đặt',
    leaderboard: 'Bảng xếp hạng',
    leaderboardShort: 'Xếp hạng',
    howTo: 'Cách chơi',
    sound: 'Âm thanh',
    soundOn: 'Âm thanh: bật',
    soundOff: 'Âm thanh: tắt',
    exit: 'Về Tò He',
    paused: 'Tạm dừng',
    resume: 'Tiếp tục',
    menu: 'Menu',
    mainMenu: 'Menu chính',
    mainMenuShort: 'Menu chính',
    again: 'Chơi lại',
    loading: 'Đang vào ván…',
    failed: 'Chưa mở được ván chơi. Thử lại nhé.',
    betweenGames: 'Đang có ván dở: áp dụng từ ván sau.',
    goesOn: 'Bàn vẫn tiếp tục khi bạn mở menu.',
  },
  en: {
    play: 'Play',
    continue: 'Continue',
    start: 'Start',
    newGame: 'New game',
    newGameShort: 'New game',
    confirmTitle: 'Start a new game?',
    confirmBody: 'The game in progress will end. The points you scored still count.',
    back: 'Back',
    online: 'Play online',
    settings: 'Settings',
    leaderboard: 'Leaderboard',
    leaderboardShort: 'Scores',
    howTo: 'How to play',
    sound: 'Sound',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    exit: 'Back to Tò He',
    paused: 'Paused',
    resume: 'Resume',
    menu: 'Menu',
    mainMenu: 'Main menu',
    mainMenuShort: 'Main menu',
    again: 'Play again',
    loading: 'Getting the game ready…',
    failed: 'The game could not start. Please try again.',
    betweenGames: 'A game is in progress: this applies from the next one.',
    goesOn: 'The table goes on while your menu is open.',
  },
};

export const shellStrings = (locale: string): ShellStrings =>
  locale.startsWith('vi') ? STRINGS.vi : STRINGS.en;

/** A section of the menu stage's Cài đặt screen. */
export interface ShellSetting {
  label: string;
  /** An icon before the label. */
  icon?: IconName;
  /** `between-games` changes how a game plays: it applies from the next game. `any-time`: looks, at once. */
  when: 'between-games' | 'any-time';
  /** The section's controls (toggles, a `choiceList`), built each time the screen opens. */
  content(): HTMLElement;
}

/** What the shell hands the play stage when it creates it. */
export interface StageContext {
  /** The stage's own element, empty, filling the game's root: the stage builds its HUD and board in it. */
  readonly root: HTMLElement;
  /** The player asked for a fresh game (Ván mới on the title screen); otherwise continue the saved one. */
  readonly fresh: boolean;
  /** The how-to was just shown: point at a first move. */
  readonly firstTime: boolean;
  /**
   * The entry this play was opened for (ADR 0045): the one the game's `entry` handler answered `handled`, for the
   * play the shell opens at once (after the how-to, the first time). Null for every other play, a later one included.
   */
  readonly entry: SessionEntry | null;
  /** The Menu button for the HUD (`createHud` puts it first). */
  menuButton(): HTMLButtonElement;
  /** The game's own cards over play (hints, a hand's results): they come back after the panel closes. */
  readonly overlay: Overlay;
  /**
   * A finished game: its card with Chơi lại (or `again`), the game's `more` actions — which keep the card up, e.g. a
   * share — and Menu chính; Back goes to the menu.
   */
  gameOver(card: Omit<OverlayCard, 'actions'>, again?: OverlayAction, more?: OverlayAction[]): void;
  /** The board is drawn: the loading view lifts. Call it once, after the first frame's state is set. */
  ready(): void;
}

/**
 * A row of the in-game panel from the play stage: a `switch` applied at once, or a `card` that opens over the panel
 * and goes back to it — a list to choose from (block colours, the deck: it applies as the player taps, with the game
 * behind) or something to read (the table's rules). `value` shows the current choice in the row.
 */
export type QuickRow =
  | Extract<OverlayRow, { kind: 'switch' }>
  | { kind: 'card'; label: string; icon?: IconName; value?: string; card(): Omit<OverlayCard, 'actions'> };

/** A running play stage, as the game's `start(ctx)` returns it. */
export interface PlayStage {
  /** Stop what runs (clock, bots, animations): the panel or the hub is over it. */
  pause(): void;
  resume(): void;
  /** Ván mới / Chơi lại: a fresh game in place. */
  newGame(): void;
  /** Back to the menu: save, then stop timers and listeners and free the engine. The shell empties the root after. */
  leave(): void | Promise<void>;
  /** The panel's live rows (the game's looks: block colours, the deck), read each time it opens. */
  quick?(): QuickRow[];
}

export interface StageModule {
  start(ctx: StageContext): PlayStage | Promise<PlayStage>;
}

/** The parts of the session the shell uses; any game's session fits, whatever its save. */
export type ShellSessionLike = Pick<
  GameSession<never>,
  'mode' | 'locale' | 'settings' | 'shell' | 'exit' | 'on' | 'log'
> &
  Partial<Pick<GameSession<never>, 'entry'>>;

export interface ShellOptions {
  session: ShellSessionLike;
  /** The game's root element: the shell puts its two stages and its panels in it. */
  root: HTMLElement;
  title: string;
  /**
   * The game's logo on the title screen and the loading view: its own icon art, the picture the catalog shows, as a URL
   * in the game's folder (`'icon.svg'`, the manifest's `icon`). Never an emoji (ADR 0049).
   */
  logo: string;
  /** A few shapes drifting behind the title screen, in the colours of the game's art (default: none). */
  decor?: DecorShape[];
  /** The icon of the title screen's play button (default `play`; Tiến Lên's "Chơi với máy": `robot`). */
  playIcon?: IconName;
  strings?: Partial<ShellStrings>;
  /** The game in progress in a few words (e.g. "Ván đang chơi dở: 1.234 điểm."), or null: "Chơi" or "Chơi tiếp". */
  inProgress(): string | null;
  /** The best result in a few words (e.g. "Kỷ lục 12.345"), shown under the title. */
  best?(): string | null;
  howTo(): Omit<OverlayCard, 'actions'>;
  /** First-time help: the how-to screen shows before the first game until `seen()`; `done()` when it is passed. */
  tutorial?: { seen(): boolean; done(): void };
  /** The sections of Cài đặt (sound comes first by itself). */
  settings?: ShellSetting[];
  /** The game has online rooms: "Chơi online" when the hub can open the lobby. */
  online?: boolean;
  /** The game keeps scores: the leaderboard when the hub can show it. */
  leaderboard?: boolean;
  /** Play runs against the clock: going on from the panel counts 3, 2, 1 first. */
  countdown?: boolean;
  /** The play stage's module, e.g. `() => import('./stage.ts')`: fetched while the menu is up, started on play. */
  stage(): Promise<StageModule>;
  /**
   * Opened straight into play, with no menu stage: an online table, a replay. `goesOn` when nothing stops for the
   * panel (a table); `exitLabel` names the way out, which the panel keeps (the hub asks before giving a seat up).
   */
  direct?: { exitLabel: string; goesOn: boolean };
  /**
   * The game's entry handler (ADR 0045): whether it opens the entry it was opened by — `handled` (play opens at once,
   * the title screen behind it; the stage gets it as `ctx.entry`), `unsupported` or `invalid` (the title screen). The
   * shell answers the hub with it when `start()` runs. Without one, every entry is answered `unsupported`.
   */
  entry?(entry: SessionEntry): EntryResult;
  /** Tests: the two layers and the play stage's element, instead of real ones in `root`. */
  layers?: { menu: Overlay; play: Overlay; stage: HTMLElement };
}

export interface Shell {
  /** Shows the first screen — the title, or play when opened directly — and tells the hub it is up. Call it once. */
  start(): void;
  /** True while the game is on screen with nothing over it. */
  readonly playing: boolean;
}

type Screen =
  | 'boot'
  | 'title'
  | 'screen'
  | 'loading'
  | 'playing'
  | 'panel'
  | 'card'
  | 'count'
  | 'over'
  | 'failed';

/** One number of the 3-2-1 before play goes on. */
const COUNT_MS = 650;
/** A stage that never says its first frame is ready is shown anyway after this long. */
const READY_MS = 8000;

export function createShell(options: ShellOptions): Shell {
  const { session, direct } = options;
  const t: ShellStrings = { ...shellStrings(session.locale), ...options.strings };
  const embedded = session.mode === 'embedded';
  const logo = { src: options.logo };
  const stageRoot = options.layers?.stage ?? element('div', 'tohe-play-stage');
  if (!options.layers) {
    stageRoot.hidden = true;
    options.root.append(stageRoot);
  }
  const playLayer = options.layers?.play ?? createOverlay(options.root);
  const menuLayer = options.layers?.menu ?? createOverlay(options.root, { stage: true });

  let screen: Screen = 'boot';
  let stage: PlayStage | null = null;
  /** Bumped by every entry into play and every way out of it: a slow load that lost the race is dropped. */
  let entry = 0;
  /** The previous stage still cleaning up: a new one waits for it. */
  let leaving: Promise<void> = Promise.resolve();
  /** Play is stopped for the panel (or a card over it): stage.pause() ran, resume() has not yet. */
  let paused = false;
  /** Where Back goes from a full screen of the menu stage, or from a card opened over the panel. */
  let parent: () => void = () => {};
  /** The game's own card, shown while playing and brought back after the panel. */
  let gameCard: OverlayCard | null = null;
  /** A game that ended while the panel was open: its card shows when play would go on. */
  let ended: OverlayCard | null = null;
  /** The end card on screen, kept while the panel opens over it (a replay's). */
  let shownOver: OverlayCard | null = null;
  let counting: ReturnType<typeof setTimeout> | null = null;
  let warmed = false;

  /** Tells the hub whether a menu or screen is up; every step answers its Back, so the hub knows the game is alive. */
  const report = (open: boolean) => session.shell.menuChanged(open);
  const stopCounting = () => {
    if (counting !== null) clearTimeout(counting);
    counting = null;
  };
  const pauseStage = () => {
    if (paused || !stage) return;
    paused = true;
    stage.pause();
  };
  const resumeStage = () => {
    if (!paused || !stage) return;
    paused = false;
    stage.resume();
  };

  // ------------------------------------------------------------------ menu stage

  const exitAction = (): OverlayAction => ({
    label: direct?.exitLabel ?? t.exit,
    icon: 'arrow-left',
    variant: 'quiet',
    attributes: { 'data-tohe-exit': '' },
    onClick: () => session.exit(),
  });
  const toggleSound = (again: () => void) => {
    session.shell.setMuted(!session.settings.muted);
    again();
  };
  const soundRow = (again: () => void): OverlayRow => ({
    kind: 'switch',
    icon: session.settings.muted ? 'speaker-slash' : 'speaker-high',
    label: t.sound,
    on: !session.settings.muted,
    onChange: () => toggleSound(again),
  });
  /** A full screen of the menu stage, with its way back in its header. */
  const menuScreen = (card: Omit<OverlayCard, 'layout' | 'corner'>, back: () => void) => {
    parent = back;
    screen = 'screen';
    menuLayer.show({
      ...card,
      layout: 'screen',
      corner: { label: t.back, icon: 'arrow-left', onClick: back },
    });
    report(true);
  };
  const howToScreen = (back: () => void) => menuScreen({ ...options.howTo(), actions: [] }, back);
  function settingsScreen() {
    const inProgress = options.inProgress() !== null;
    menuScreen(
      {
        icon: 'gear-six',
        title: t.settings,
        actions: [],
        rows: [soundRow(settingsScreen)],
        sections: (options.settings ?? []).map((setting) => ({
          title: setting.label,
          icon: setting.icon,
          note: setting.when === 'between-games' && inProgress ? t.betweenGames : undefined,
          content: setting.content(),
        })),
      },
      titleScreen,
    );
  }

  /** Fetches the play stage while the player looks at the menu, so play starts without a download (Apple HIG). */
  const warm = () => {
    if (warmed) return;
    warmed = true;
    const fetchStage = () => void options.stage().catch(() => {});
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fetchStage, { timeout: 2000 });
    else setTimeout(fetchStage, 300);
  };

  function titleScreen() {
    screen = 'title';
    ended = null;
    const summary = options.inProgress();
    const can = session.shell.can;
    menuLayer.show({
      layout: 'title',
      icon: logo,
      title: options.title,
      body: [summary, options.best?.()].filter(Boolean).join(' · ') || undefined,
      decor: options.decor,
      footer: embedded ? exitAction() : undefined,
      actions: [
        {
          label: summary ? t.continue : t.play,
          icon: options.playIcon ?? 'play',
          attributes: { 'data-tohe-play': '' },
          onClick: () => begin(false),
        },
        ...(summary
          ? [
              {
                label: t.newGame,
                icon: 'arrow-counter-clockwise' as const,
                variant: 'secondary' as const,
                onClick: () => confirmFromTitle(),
              },
            ]
          : []),
        ...(options.online && can.rooms
          ? [
              {
                label: t.online,
                icon: 'users-three' as const,
                variant: 'secondary' as const,
                onClick: () => session.shell.open('rooms'),
              },
            ]
          : []),
      ],
      tools: [
        {
          icon: session.settings.muted ? 'speaker-slash' : 'speaker-high',
          label: t.sound,
          ariaLabel: session.settings.muted ? t.soundOff : t.soundOn,
          onClick: () => toggleSound(titleScreen),
        },
        { icon: 'gear-six', label: t.settings, onClick: settingsScreen },
        ...(options.leaderboard && can.leaderboard
          ? [
              {
                icon: 'trophy' as const,
                label: t.leaderboardShort,
                ariaLabel: t.leaderboard,
                onClick: () => session.shell.open('leaderboard'),
              },
            ]
          : []),
        { icon: 'question', label: t.howTo, onClick: () => howToScreen(titleScreen) },
      ],
    });
    report(true);
    warm();
  }

  const confirmFromTitle = () =>
    menuScreen(
      {
        icon: 'arrow-counter-clockwise',
        title: t.confirmTitle,
        body: t.confirmBody,
        actions: [
          { label: t.back, onClick: titleScreen },
          {
            label: t.newGame,
            icon: 'arrow-counter-clockwise',
            variant: 'secondary',
            onClick: () => begin(true),
          },
        ],
      },
      titleScreen,
    );

  /** Play from the title screen — or for an entry the game handles — the how-to first, the first time. */
  function begin(fresh: boolean, opened: SessionEntry | null = null) {
    const tutorial = options.tutorial;
    if (tutorial && !tutorial.seen()) {
      menuScreen(
        {
          ...options.howTo(),
          actions: [
            {
              label: t.start,
              icon: 'play',
              attributes: { 'data-tohe-play': '' },
              onClick: () => {
                tutorial.done();
                void enterPlay(fresh, true, opened);
              },
            },
          ],
        },
        titleScreen,
      );
      return;
    }
    void enterPlay(fresh, false, opened);
  }

  // ------------------------------------------------------------------ play stage

  const gameOverlay: Overlay = {
    show(card) {
      gameCard = card;
      if (screen === 'playing') playLayer.show(card);
    },
    hide() {
      gameCard = null;
      if (screen === 'playing') playLayer.hide();
    },
    get visible() {
      return playLayer.visible;
    },
  };

  const menuButton = () => {
    // Its picture with its name under it, like every control of the kit: the name is the button's accessible name.
    const button = element('button', 'tohe-icon-button tohe-menu-button');
    button.type = 'button';
    button.append(drawIcon('list'), element('span', 'tohe-menu-button-label', t.menu));
    button.dataset.toheMenu = '';
    button.addEventListener('click', () => {
      if (screen === 'playing' || screen === 'count') panel();
    });
    return button;
  };

  async function enterPlay(fresh: boolean, firstTime: boolean, opened: SessionEntry | null = null) {
    const mine = ++entry;
    screen = 'loading';
    menuLayer.hide();
    playLayer.show({ layout: 'loading', icon: logo, title: t.loading, actions: [] });
    report(true);
    // The previous stage may still be cleaning up its element.
    await leaving;
    if (mine !== entry) return;
    stageRoot.hidden = false;
    let markReady = () => {};
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
      setTimeout(resolve, READY_MS);
    });
    try {
      const module = await options.stage();
      if (mine !== entry) return;
      const created = await module.start({
        root: stageRoot,
        fresh,
        firstTime,
        entry: opened,
        menuButton,
        overlay: gameOverlay,
        gameOver,
        ready: () => markReady(),
      });
      if (mine !== entry) {
        // Back while it loaded: the player is on the menu already.
        await created.leave();
        return;
      }
      stage = created;
      paused = false;
      await ready;
      if (mine !== entry) return;
      enterPlaying();
    } catch (error) {
      if (mine !== entry) return;
      session.log('error', `play stage failed: ${String(error)}`);
      screen = 'failed';
      playLayer.show({
        icon: 'smiley-sad',
        title: options.title,
        body: t.failed,
        actions: [{ label: t.back, onClick: () => void leavePlay() }],
      });
      report(true);
    }
  }

  /** Back to the menu stage: the title shows at once, the stage saves and frees itself under it. */
  async function leavePlay() {
    entry++;
    stopCounting();
    const leavingStage = stage;
    stage = null;
    paused = false;
    gameCard = null;
    ended = null;
    shownOver = null;
    playLayer.hide();
    if (direct) {
      session.exit();
      return;
    }
    titleScreen();
    leaving = (async () => {
      try {
        await leavingStage?.leave();
      } catch (error) {
        session.log('warn', `play stage did not leave cleanly: ${String(error)}`);
      }
      stageRoot.replaceChildren();
      stageRoot.hidden = true;
    })();
    await leaving;
  }

  const showOver = (card: OverlayCard) => {
    stopCounting();
    shownOver = card;
    screen = 'over';
    playLayer.show(card);
    report(true);
  };

  function enterPlaying() {
    stopCounting();
    if (ended) {
      const card = ended;
      ended = null;
      resumeStage();
      showOver(card);
      return;
    }
    screen = 'playing';
    if (gameCard) playLayer.show(gameCard);
    else playLayer.hide();
    report(false);
    resumeStage();
  }

  /** From the panel back to play: 3, 2, 1 first for a game against the clock. */
  function goOn() {
    if (!options.countdown || ended || gameCard || !paused) return enterPlaying();
    const count = (n: number) => {
      screen = 'count';
      playLayer.show({ layout: 'count', title: String(n), actions: [] });
      report(false);
      counting = setTimeout(() => (n > 1 ? count(n - 1) : enterPlaying()), COUNT_MS);
    };
    count(3);
  }

  /** A card over the panel (how to play, a new game?), whose Back returns to the panel. */
  const panelCard = (card: OverlayCard) => {
    parent = panel;
    screen = 'card';
    playLayer.show(card);
    report(true);
  };

  /** The quick panel over play (ADR 0020): resume, what changes in place, a new game, how to play, the menu. */
  function panel() {
    if (screen === 'over' && shownOver) ended = shownOver;
    stopCounting();
    pauseStage();
    screen = 'panel';
    const goesOn = direct?.goesOn ?? false;
    const quick = (stage?.quick?.() ?? []).map(
      (row): OverlayRow =>
        row.kind === 'switch'
          ? {
              ...row,
              onChange: (on) => {
                row.onChange(on);
                panel();
              },
            }
          : {
              kind: 'link',
              label: row.label,
              icon: row.icon,
              value: row.value,
              onClick: () => panelCard({ ...row.card(), actions: [{ label: t.back, onClick: panel }] }),
            },
    );
    playLayer.show({
      layout: 'menu',
      icon: goesOn ? 'list' : 'pause',
      title: goesOn ? t.menu : t.paused,
      body: goesOn ? t.goesOn : undefined,
      actions: [{ label: t.resume, icon: 'play', onClick: goOn }],
      rows: [soundRow(panel), ...quick],
      tools: [
        ...(direct
          ? []
          : [
              {
                icon: 'arrow-counter-clockwise' as const,
                label: t.newGameShort,
                onClick: () =>
                  panelCard({
                    icon: 'arrow-counter-clockwise',
                    title: t.confirmTitle,
                    body: t.confirmBody,
                    actions: [
                      { label: t.back, onClick: panel },
                      {
                        label: t.newGame,
                        icon: 'arrow-counter-clockwise',
                        variant: 'secondary',
                        onClick: () => {
                          gameCard = null;
                          ended = null;
                          enterPlaying();
                          stage?.newGame();
                        },
                      },
                    ],
                  }),
              },
            ]),
        {
          icon: 'question',
          label: t.howTo,
          onClick: () => panelCard({ ...options.howTo(), actions: [{ label: t.back, onClick: panel }] }),
        },
        ...(direct
          ? []
          : [
              {
                icon: 'house' as const,
                label: t.mainMenuShort,
                attributes: { 'data-tohe-main-menu': '' },
                onClick: () => void leavePlay(),
              },
            ]),
      ],
      footer: direct ? exitAction() : undefined,
    });
    report(true);
  }

  function gameOver(card: Omit<OverlayCard, 'actions'>, again?: OverlayAction, more: OverlayAction[] = []) {
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
          : {
              label: t.again,
              icon: 'play',
              onClick: () => {
                enterPlaying();
                stage?.newGame();
              },
            },
        // The game's own: a share, a challenge back. The card stays while they run.
        ...more.map((action) => ({ variant: 'secondary' as const, ...action })),
        direct
          ? { ...exitAction(), variant: 'secondary' }
          : {
              label: t.mainMenu,
              icon: 'house',
              variant: 'secondary',
              attributes: { 'data-tohe-main-menu': '' },
              onClick: () => void leavePlay(),
            },
      ],
    };
    if (screen === 'playing' || screen === 'count') showOver(over);
    else ended = over;
  }

  // ------------------------------------------------------------------ Back, the hub hiding the game, Escape

  /** One level back: play → the panel → play; a screen → the menu; the menu → Tò He. */
  const back = () => {
    switch (screen) {
      case 'title':
        if (embedded) session.exit();
        break;
      case 'screen':
      case 'card':
        parent();
        break;
      case 'loading':
      case 'failed':
        void leavePlay();
        break;
      case 'playing':
      case 'count':
        panel();
        break;
      case 'panel':
        goOn();
        break;
      case 'over':
        if (direct) panel();
        else void leavePlay();
        break;
    }
  };
  session.on('menu', back);
  // The hub hid the game (another app, a locked phone): play waits in the panel, like any game. A table goes on.
  session.on('pause', () => {
    if ((screen === 'playing' && !direct?.goesOn) || screen === 'count') panel();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      back();
    });
  }

  /** The answer to the entry the game was opened by (ADR 0045), sent once; `handled` opens play. */
  const answerEntry = (): SessionEntry | null => {
    const opened = session.entry;
    if (!opened) return null;
    let result: EntryResult = 'unsupported';
    if (options.entry && !direct) {
      try {
        result = options.entry(opened);
      } catch (error) {
        session.log('warn', `entry handler failed: ${String(error)}`);
        result = 'invalid';
      }
    }
    opened.answer(result);
    return result === 'handled' ? opened : null;
  };

  return {
    start() {
      if (screen !== 'boot') return;
      const opened = answerEntry();
      if (direct) void enterPlay(false, false);
      // Opened by an entry the game handles: play at once — after the how-to, the first time — the title screen behind.
      else if (opened) begin(false, opened);
      else titleScreen();
    },
    get playing() {
      return screen === 'playing' && !playLayer.visible;
    },
  };
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
