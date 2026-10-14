// The standard life of a game with long runs: when it opens with a run in progress the player chooses to continue
// or start over, and a ⏸ button opens a menu while playing. Built on the overlay, so every game looks and behaves
// the same; starting over always asks first, with the safe choice first. Games with short rounds skip all this.
import type { Overlay, OverlayCard } from './overlay.ts';

export interface LifecycleStrings {
  continue: string;
  newGame: string;
  confirmTitle: string;
  confirmBody: string;
  back: string;
  paused: string;
  resume: string;
  howTo: string;
  menu: string;
}

const STRINGS: Record<'vi' | 'en', LifecycleStrings> = {
  vi: {
    continue: 'Chơi tiếp',
    newGame: 'Ván mới',
    confirmTitle: 'Bắt đầu ván mới?',
    confirmBody: 'Ván đang chơi sẽ kết thúc. Điểm đã đạt vẫn được tính.',
    back: 'Quay lại',
    paused: 'Tạm dừng',
    resume: 'Tiếp tục',
    howTo: 'Cách chơi',
    menu: 'Menu',
  },
  en: {
    continue: 'Continue',
    newGame: 'New game',
    confirmTitle: 'Start a new game?',
    confirmBody: 'The game in progress will end. The points you scored still count.',
    back: 'Back',
    paused: 'Paused',
    resume: 'Resume',
    howTo: 'How to play',
    menu: 'Menu',
  },
};

export const lifecycleStrings = (locale: string): LifecycleStrings =>
  locale.startsWith('vi') ? STRINGS.vi : STRINGS.en;

export interface LifecycleOptions {
  overlay: Overlay;
  strings: LifecycleStrings;
  /** Shown on the "continue" card, e.g. the game's icon. */
  icon: string;
  title: string;
  /** Start a fresh run (the player confirmed). */
  onNewGame(): void;
  /** The "how to play" card; its buttons are replaced by one that returns to the menu. */
  howTo(): Omit<OverlayCard, 'actions'>;
  /** Called whenever a lifecycle card closes and play goes on. */
  onResume?(): void;
}

export interface Lifecycle {
  /** On open with a run in progress: "continue" (the default) or "new game". */
  offerContinue(summary: string): void;
  /** The ⏸ menu: resume, new game, how to play. */
  openMenu(): void;
  /** A round ⏸ button that opens the menu, to put in the game's HUD. */
  menuButton(): HTMLButtonElement;
}

export function createLifecycle(options: LifecycleOptions): Lifecycle {
  const { overlay, strings: t } = options;
  const play = () => {
    overlay.hide();
    options.onResume?.();
  };
  const confirmNew = (back: () => void) =>
    overlay.show({
      icon: '🔄',
      title: t.confirmTitle,
      body: t.confirmBody,
      actions: [
        { label: t.back, onClick: back },
        {
          label: t.newGame,
          variant: 'secondary',
          onClick: () => {
            overlay.hide();
            options.onNewGame();
          },
        },
      ],
    });

  const lifecycle: Lifecycle = {
    offerContinue(summary) {
      overlay.show({
        icon: options.icon,
        title: options.title,
        body: summary,
        actions: [
          { label: t.continue, onClick: play },
          {
            label: t.newGame,
            variant: 'secondary',
            onClick: () => confirmNew(() => lifecycle.offerContinue(summary)),
          },
        ],
      });
    },
    openMenu() {
      overlay.show({
        icon: '⏸️',
        title: t.paused,
        actions: [
          { label: t.resume, onClick: play },
          { label: t.newGame, variant: 'secondary', onClick: () => confirmNew(lifecycle.openMenu) },
          {
            label: t.howTo,
            variant: 'secondary',
            onClick: () =>
              overlay.show({ ...options.howTo(), actions: [{ label: t.back, onClick: lifecycle.openMenu }] }),
          },
        ],
      });
    },
    menuButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tohe-icon-button';
      button.setAttribute('aria-label', t.menu);
      button.textContent = '⏸';
      button.addEventListener('click', () => {
        if (!overlay.visible) lifecycle.openMenu();
      });
      return button;
    },
  };
  return lifecycle;
}
