import type { ShellInfo } from '@tohe/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Overlay, OverlayAction, OverlayCard } from './overlay.ts';
import { createShell, type ShellOptions } from './shell.ts';

/** A session and an overlay that only remember what happened. */
function setup(overrides: Partial<ShellOptions> = {}, can: ShellInfo = { leaderboard: false, rooms: false }) {
  const listeners = new Map<string, () => void>();
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
      listeners.set(event, listener);
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
  const every = (): OverlayAction[] => [
    ...(card?.actions ?? []),
    ...(card?.tools ?? []),
    ...(card?.footer ? [card.footer] : []),
    ...(card?.corner ? [card.corner] : []),
  ];
  const labels = () => card?.actions.map((action) => action.label) ?? [];
  const tools = () => card?.tools?.map((tool) => tool.ariaLabel ?? tool.label) ?? [];
  const tap = (label: string) => {
    const action = every().find((a) => a.label === label || a.ariaLabel === label);
    if (!action) throw new Error(`no "${label}" in ${JSON.stringify(every().map((a) => a.label))}`);
    action.onClick();
  };
  const fire = (event: string) => listeners.get(event)?.();
  const reported = () => session.shell.menuChanged.mock.calls.map(([open]) => open);
  return {
    shell,
    session,
    calls,
    labels,
    tools,
    tap,
    back: () => fire('menu'),
    hidden: () => fire('pause'),
    card: () => card,
    reported,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the game shell (ADR 0019)', () => {
  it('waits for the game to start, then opens on its title screen and tells the hub', () => {
    const { shell, card, labels, tools, reported } = setup();
    expect(card()).toBeNull();
    shell.start();
    expect(card()?.layout).toBe('title');
    expect(card()?.title).toBe('Ghép Khối');
    expect(labels()).toEqual(['▶ Chơi']);
    expect(card()?.actions[0]?.attributes).toEqual({ 'data-tohe-play': '' });
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
    expect(card()?.corner?.attributes).toEqual({ 'data-tohe-exit': '' });
    expect(reported()).toEqual([true]);
    shell.start();
    expect(reported()).toEqual([true]);
  });

  it('offers continue and a new game with a game in progress, online and the board when the hub can', () => {
    const { shell, labels, tools, tap, session, card } = setup(
      { inProgress: () => 'Điểm 1.234', online: true, leaderboard: true },
      { leaderboard: true, rooms: true },
    );
    shell.start();
    expect(card()?.body).toBe('Điểm 1.234');
    expect(labels()).toEqual(['▶ Chơi tiếp', '🔄 Ván mới', '🌐 Chơi online']);
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Bảng xếp hạng', 'Cách chơi']);
    tap('Bảng xếp hạng');
    expect(session.shell.open).toHaveBeenCalledWith('leaderboard');
    tap('🌐 Chơi online');
    expect(session.shell.open).toHaveBeenCalledWith('rooms');
  });

  it('leaves out online play and the board when the hub cannot open them (a guest)', () => {
    const { shell, labels, tools } = setup({ online: true, leaderboard: true });
    shell.start();
    expect(labels()).toEqual(['▶ Chơi']);
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
  });

  it('plays, pauses for the menu, resumes, and Back steps out to Tò He from the title screen', () => {
    const { shell, session, calls, labels, tools, tap, back, card, reported } = setup();
    shell.start();
    tap('▶ Chơi');
    expect(calls).toEqual(['pause', 'resume', 'play']);
    expect(shell.playing).toBe(true);
    back();
    expect(card()?.layout).toBe('menu');
    expect(card()?.title).toBe('Tạm dừng');
    expect(labels()).toEqual(['▶ Tiếp tục', '🔄 Ván mới', '☰ Menu chính']);
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
    expect(card()?.footer?.label).toBe('← Về Tò He');
    expect(calls.at(-1)).toBe('pause');
    back();
    expect(shell.playing).toBe(true);
    expect(calls.at(-1)).toBe('resume');
    back();
    tap('☰ Menu chính');
    expect(card()?.layout).toBe('title');
    expect(session.exit).not.toHaveBeenCalled();
    back();
    expect(session.exit).toHaveBeenCalled();
    // Every step answered the hub's Back.
    expect(reported()).toEqual([true, false, true, false, true, true]);
  });

  it('opens the menu when the hub hides the game, and waits there', () => {
    const { shell, calls, tap, hidden, card } = setup();
    shell.start();
    hidden();
    expect(card()?.layout).toBe('title');
    tap('▶ Chơi');
    hidden();
    expect(card()?.title).toBe('Tạm dừng');
    expect(calls.at(-1)).toBe('pause');
  });

  it('counts 3, 2, 1 before a game against the clock goes on', () => {
    vi.useFakeTimers();
    const { shell, calls, tap, back, card } = setup({ countdown: true });
    shell.start();
    tap('▶ Chơi');
    expect(shell.playing).toBe(true);
    back();
    tap('▶ Tiếp tục');
    expect(card()).toMatchObject({ layout: 'count', title: '3' });
    expect(calls.at(-1)).toBe('pause');
    vi.advanceTimersByTime(650);
    expect(card()?.title).toBe('2');
    // Back while counting: the menu again, and the count stops.
    back();
    expect(card()?.title).toBe('Tạm dừng');
    vi.advanceTimersByTime(5000);
    expect(card()?.title).toBe('Tạm dừng');
    back();
    vi.advanceTimersByTime(650 * 3);
    expect(shell.playing).toBe(true);
    expect(calls.at(-1)).toBe('resume');
  });

  it('shows how to play before the first game, then never again', () => {
    let seen = false;
    const { shell, calls, tap, back, card, labels } = setup({
      tutorial: {
        seen: () => seen,
        done: () => {
          seen = true;
          calls.push('done');
        },
      },
    });
    shell.start();
    tap('▶ Chơi');
    expect(card()?.title).toBe('Cách chơi');
    expect(labels()).toEqual(['▶ Bắt đầu']);
    expect(card()?.actions[0]?.attributes).toEqual({ 'data-tohe-play': '' });
    back();
    expect(card()?.layout).toBe('title');
    tap('▶ Chơi');
    tap('▶ Bắt đầu');
    expect(shell.playing).toBe(true);
    expect(calls.slice(-2)).toEqual(['play', 'done']);
    back();
    tap('☰ Menu chính');
    tap('▶ Chơi');
    expect(shell.playing).toBe(true);
  });

  it("brings the game's own card back when the menu closes", () => {
    const { shell, back, card, tap } = setup();
    shell.start();
    tap('▶ Chơi');
    shell.overlay.show({ title: 'Mẹo', actions: [] });
    expect(card()?.title).toBe('Mẹo');
    back();
    expect(card()?.title).toBe('Tạm dừng');
    back();
    expect(card()?.title).toBe('Mẹo');
    shell.overlay.hide();
    expect(card()).toBeNull();
  });

  it('keeps rules read-only during a game and changeable from the title screen', () => {
    const rule = vi.fn((readOnly: boolean) => ({ title: readOnly ? 'Luật (xem)' : 'Luật (đổi)' }));
    const look = vi.fn(() => ({ title: 'Màu' }));
    const { shell, tap, back, card } = setup({
      settings: [
        { label: 'Luật nhà', when: 'between-games', card: rule },
        { label: 'Màu khối', when: 'any-time', card: look },
      ],
    });
    shell.start();
    tap('Cài đặt');
    tap('Luật nhà');
    expect(card()?.title).toBe('Luật (đổi)');
    expect(card()?.body).toBeUndefined();
    back();
    back();
    expect(card()?.layout).toBe('title');
    tap('▶ Chơi');
    back();
    tap('Cài đặt');
    tap('Luật nhà');
    expect(card()?.title).toBe('Luật (xem)');
    expect(card()?.body).toBe('Đổi ở menu chính, áp dụng từ ván sau.');
    tap('Quay lại');
    tap('Màu khối');
    expect(card()?.body).toBeUndefined();
    tap('Quay lại');
    tap('Quay lại');
    expect(card()?.title).toBe('Tạm dừng');
  });

  it('switches sound from the tools and from the settings', () => {
    const { shell, session, tap, tools, labels } = setup();
    shell.start();
    tap('Âm thanh: bật');
    expect(session.shell.setMuted).toHaveBeenCalledWith(true);
    expect(tools()[0]).toBe('Âm thanh: tắt');
    tap('Cài đặt');
    expect(labels()[0]).toBe('🔇 Âm thanh: tắt');
    tap('🔇 Âm thanh: tắt');
    expect(labels()[0]).toBe('🔊 Âm thanh: bật');
  });

  it('starts a new game from the menu after asking', () => {
    const { shell, calls, tap, back, card } = setup({ inProgress: () => 'Điểm 10' });
    shell.start();
    tap('▶ Chơi tiếp');
    back();
    tap('🔄 Ván mới');
    expect(card()?.title).toBe('Bắt đầu ván mới?');
    tap('Quay lại');
    expect(card()?.title).toBe('Tạm dừng');
    tap('🔄 Ván mới');
    calls.length = 0;
    tap('🔄 Ván mới');
    expect(calls).toEqual(['resume', 'newGame']);
    expect(shell.playing).toBe(true);
  });

  it('ends a game with play again and the main menu; Back goes to the title screen', () => {
    const { shell, calls, tap, labels, back, card } = setup();
    shell.start();
    tap('▶ Chơi');
    shell.gameOver({ title: 'Hết ván' });
    expect(labels()).toEqual(['▶ Chơi lại', '☰ Menu chính']);
    // A finished game is not paused: its celebration keeps playing under the card.
    expect(calls.at(-1)).toBe('play');
    tap('▶ Chơi lại');
    expect(calls.at(-1)).toBe('newGame');
    shell.gameOver({ title: 'Hết ván' });
    back();
    expect(card()?.layout).toBe('title');
  });

  it('shows a game that ended while the menu was open once play would go on', () => {
    const { shell, tap, back, card } = setup();
    shell.start();
    tap('▶ Chơi');
    back();
    shell.gameOver({ title: 'Hết ván' });
    expect(card()?.title).toBe('Tạm dừng');
    tap('▶ Tiếp tục');
    expect(card()?.title).toBe('Hết ván');
  });

  it('starts the next game from the title screen when one ended under the menu', () => {
    const { shell, calls, tap, back } = setup();
    shell.start();
    tap('▶ Chơi');
    back();
    shell.gameOver({ title: 'Hết ván' });
    tap('☰ Menu chính');
    tap('▶ Chơi');
    expect(shell.playing).toBe(true);
    expect(calls.at(-1)).toBe('play');
  });

  it('at an online table: straight into play, the table goes on, and the way out is the seat', () => {
    const { shell, session, calls, labels, tools, tap, back, hidden, card, reported } = setup({
      direct: { exitLabel: 'Rời bàn', goesOn: true },
    });
    shell.start();
    expect(shell.playing).toBe(true);
    expect(reported()).toEqual([false]);
    hidden();
    expect(shell.playing).toBe(true);
    back();
    expect(card()?.title).toBe('Menu');
    expect(card()?.body).toBe('Bàn vẫn tiếp tục khi bạn mở menu.');
    expect(labels()).toEqual(['▶ Tiếp tục']);
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
    tap('Rời bàn');
    expect(session.exit).toHaveBeenCalled();
    expect(calls).toEqual(['pause']);
  });

  it('in a replay: the end card plays it again, and Back opens the menu with the way out', () => {
    const again = vi.fn();
    const { shell, labels, tap, back, card } = setup({ direct: { exitLabel: 'Về sảnh', goesOn: false } });
    shell.start();
    shell.gameOver({ title: 'Hết ván' }, { label: 'Xem lại từ đầu', onClick: again });
    expect(labels()).toEqual(['Xem lại từ đầu', 'Về sảnh']);
    back();
    expect(card()?.title).toBe('Tạm dừng');
    expect(card()?.footer?.label).toBe('Về sảnh');
    tap('▶ Tiếp tục');
    expect(card()?.title).toBe('Hết ván');
    tap('Xem lại từ đầu');
    expect(again).toHaveBeenCalled();
    expect(shell.playing).toBe(true);
  });
});
