import type { ShellInfo } from '@tohe/game-sdk';
import { describe, expect, it, vi } from 'vitest';
import type { Overlay, OverlayCard } from './overlay.ts';
import { createShell, type ShellOptions } from './shell.ts';

/** A session and an overlay that only remember what happened. */
function setup(overrides: Partial<ShellOptions> = {}, can: ShellInfo = { leaderboard: false, rooms: false }) {
  let back = () => {};
  let card: OverlayCard | null = null;
  const settings = { muted: false, theme: 'light' as const };
  const session = {
    mode: 'embedded' as const,
    locale: 'vi',
    settings,
    shell: {
      can,
      menuChanged: vi.fn(),
      open: vi.fn(),
      setMuted: vi.fn((muted: boolean) => {
        settings.muted = muted;
      }),
    },
    exit: vi.fn(),
    on: ((event: string, listener: () => void) => {
      if (event === 'menu') back = listener;
      return () => {};
    }) as ShellOptions['session']['on'],
  };
  const overlay: Overlay = {
    show: (next) => {
      card = next;
    },
    hide: () => {
      card = null;
    },
    get visible() {
      return card !== null;
    },
  };
  const calls: string[] = [];
  const shell = createShell({
    session,
    root: {} as HTMLElement,
    overlay,
    title: 'Ghép Khối',
    icon: '🧱',
    inProgress: () => null,
    play: () => calls.push('play'),
    newGame: () => calls.push('newGame'),
    howTo: () => ({ title: 'Cách chơi' }),
    onPause: () => calls.push('pause'),
    onResume: () => calls.push('resume'),
    ...overrides,
  });
  const labels = () => card?.actions.map((action) => action.label) ?? [];
  const tap = (label: string) => {
    const action = card?.actions.find((a) => a.label === label);
    if (!action) throw new Error(`no "${label}" in ${JSON.stringify(labels())}`);
    action.onClick();
  };
  return { shell, session, calls, labels, tap, back: () => back(), card: () => card };
}

describe('the game shell (ADR 0018)', () => {
  it('opens on the main menu: play, settings, how to play, the way back to Tò He', () => {
    const { shell, labels } = setup();
    shell.mainMenu();
    expect(labels()).toEqual(['▶ Chơi', '⚙️ Cài đặt', '❓ Cách chơi', '← Về Tò He']);
  });

  it('offers continue and a new game with a game in progress, online and the board when the hub can', () => {
    const { shell, labels } = setup(
      { inProgress: () => 'Điểm 120', online: true, leaderboard: true },
      { leaderboard: true, rooms: true },
    );
    shell.mainMenu();
    expect(labels()).toEqual([
      '▶ Chơi tiếp',
      'Ván mới',
      '🌐 Chơi online',
      '⚙️ Cài đặt',
      '🏆 Bảng xếp hạng',
      '❓ Cách chơi',
      '← Về Tò He',
    ]);
  });

  it('leaves out online play and the board when the hub cannot open them (a guest)', () => {
    const { shell, labels } = setup({ online: true, leaderboard: true });
    shell.mainMenu();
    expect(labels()).not.toContain('🌐 Chơi online');
    expect(labels()).not.toContain('🏆 Bảng xếp hạng');
  });

  it('plays, pauses for the menu, resumes, and Back steps out to Tò He from the main menu', () => {
    const { shell, session, calls, labels, tap, back } = setup();
    shell.mainMenu();
    tap('▶ Chơi');
    expect(calls).toEqual(['resume', 'play']);
    expect(shell.playing).toBe(true);
    back();
    expect(labels()[0]).toBe('▶ Tiếp tục');
    expect(labels()).toContain('☰ Menu chính');
    back();
    expect(shell.playing).toBe(true);
    shell.menu();
    tap('☰ Menu chính');
    back();
    expect(session.exit).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['resume', 'play', 'pause', 'resume', 'pause']);
    // Every step answered the hub's Back.
    expect(session.shell.menuChanged.mock.calls.map(([open]) => open)).toEqual([
      true,
      false,
      true,
      false,
      true,
      true,
    ]);
  });

  it("brings the game's own card back when the menu closes", () => {
    const { shell, back, card, tap } = setup();
    shell.mainMenu();
    shell.overlay.show({ title: 'Kết quả ván', actions: [] });
    expect(card()?.title).toBe('Ghép Khối');
    tap('▶ Chơi');
    expect(card()?.title).toBe('Kết quả ván');
    back();
    expect(card()?.title).toBe('Tạm dừng');
    back();
    expect(card()?.title).toBe('Kết quả ván');
  });

  it('keeps rules read-only during a game and changeable from the main menu', () => {
    const seen: boolean[] = [];
    const { shell, tap, card } = setup({
      settings: [
        {
          label: 'Luật nhà',
          when: 'between-games',
          card: (readOnly) => {
            seen.push(readOnly);
            return { title: 'Luật nhà' };
          },
        },
        {
          label: 'Bộ bài',
          when: 'any-time',
          card: (readOnly) => {
            seen.push(readOnly);
            return { title: 'Bộ bài' };
          },
        },
      ],
    });
    shell.mainMenu();
    tap('⚙️ Cài đặt');
    tap('Luật nhà');
    tap('Quay lại');
    tap('Quay lại');
    tap('▶ Chơi');
    shell.menu();
    tap('⚙️ Cài đặt');
    tap('Luật nhà');
    expect(card()?.body).toBe('Đổi ở menu chính, áp dụng từ ván sau.');
    tap('Quay lại');
    tap('Bộ bài');
    expect(seen).toEqual([false, true, false]);
  });

  it('switches sound from the menu', () => {
    const { shell, session, tap, labels } = setup();
    shell.mainMenu();
    tap('▶ Chơi');
    shell.menu();
    tap('🔊 Âm thanh: bật');
    expect(session.shell.setMuted).toHaveBeenCalledWith(true);
    expect(labels()).toContain('🔇 Âm thanh: tắt');
  });

  it('at an online table: no main menu, the table goes on, and the way out is the seat', () => {
    const { shell, calls, labels, card, tap, session } = setup({
      direct: { exitLabel: 'Rời bàn', goesOn: true },
    });
    shell.mainMenu();
    expect(card()).toBeNull();
    shell.menu();
    expect(card()?.body).toBe('Bàn vẫn tiếp tục khi bạn mở menu.');
    expect(labels()).not.toContain('☰ Menu chính');
    tap('Rời bàn');
    expect(session.exit).toHaveBeenCalled();
    expect(calls).toEqual(['pause']);
  });

  it('ends a game with play again and the main menu', () => {
    const { shell, calls, tap, labels } = setup();
    shell.mainMenu();
    tap('▶ Chơi');
    shell.gameOver({ title: 'Hết ván' });
    expect(labels()).toEqual(['Chơi lại', '☰ Menu chính']);
    tap('Chơi lại');
    expect(calls.at(-1)).toBe('newGame');
  });
});
