import type { ShellInfo } from '@tohe/game-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Overlay, OverlayAction, OverlayCard, OverlayRow } from './overlay.ts';
import { createShell, type ShellOptions, type StageContext, type StageModule } from './shell.ts';

function layer() {
  let card: OverlayCard | null = null;
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
  return { overlay, card: () => card };
}

/** A session, two layers and a play stage that only remember what happened. */
function setup(overrides: Partial<ShellOptions> = {}, can: ShellInfo = { leaderboard: false, rooms: false }) {
  const listeners = new Map<string, () => void>();
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
    log: vi.fn(),
    on: ((event: string, listener: () => void) => {
      listeners.set(event, listener);
      return () => {};
    }) as ShellOptions['session']['on'],
  };
  const menu = layer();
  const play = layer();
  const stageElement = { hidden: true, replaceChildren: vi.fn() } as unknown as HTMLElement;
  const calls: string[] = [];
  let context: StageContext | null = null;
  let colour = 'a';
  const module: StageModule = {
    start(ctx) {
      context = ctx;
      calls.push(`start${ctx.fresh ? ' fresh' : ''}${ctx.firstTime ? ' first' : ''}`);
      ctx.ready();
      return {
        pause: () => calls.push('pause'),
        resume: () => calls.push('resume'),
        newGame: () => calls.push('newGame'),
        leave: () => void calls.push('leave'),
        quick: (): OverlayRow[] => [
          {
            kind: 'choices',
            label: 'Màu khối',
            choices: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            chosen: colour,
            onChoose: (id) => {
              colour = id;
              calls.push(`colour ${id}`);
            },
          },
        ],
      };
    },
  };
  const shell = createShell({
    session,
    root: {} as HTMLElement,
    layers: { menu: menu.overlay, play: play.overlay, stage: stageElement },
    title: 'Ghép Khối',
    icon: '🧱',
    inProgress: () => null,
    howTo: () => ({ title: 'Cách chơi' }),
    stage: async () => module,
    ...overrides,
  });
  /** The screen on top: a panel over play, else the menu stage. */
  const top = () => play.card() ?? menu.card();
  const every = (card = top()): OverlayAction[] => [
    ...(card?.actions ?? []),
    ...(card?.tools ?? []),
    ...(card?.footer ? [card.footer] : []),
    ...(card?.corner ? [card.corner] : []),
  ];
  const tap = (label: string) => {
    const action = every().find((a) => a.label === label || a.ariaLabel === label);
    if (!action) throw new Error(`no "${label}" in ${JSON.stringify(every().map((a) => a.label))}`);
    action.onClick();
  };
  const fire = (event: string) => listeners.get(event)?.();
  return {
    shell,
    session,
    calls,
    menu: menu.card,
    play: play.card,
    labels: () => top()?.actions.map((action) => action.label) ?? [],
    tools: () => top()?.tools?.map((tool) => tool.ariaLabel ?? tool.label) ?? [],
    rows: () => top()?.rows ?? [],
    every,
    tap,
    back: () => fire('menu'),
    hidden: () => fire('pause'),
    reported: () => session.shell.menuChanged.mock.calls.map(([open]) => open),
    ctx: () => context as unknown as StageContext,
    stageElement,
  };
}

/** Lets the play stage's loading (a few awaits) run through. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe('the menu stage (ADR 0020)', () => {
  it('opens on the title screen, with no play stage yet, and tells the hub', () => {
    const { shell, menu, play, labels, tools, calls, reported } = setup();
    expect(menu()).toBeNull();
    shell.start();
    expect(menu()?.layout).toBe('title');
    expect(play()).toBeNull();
    expect(labels()).toEqual(['▶ Chơi']);
    expect(menu()?.actions[0]?.attributes).toEqual({ 'data-tohe-play': '' });
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
    expect(menu()?.corner?.attributes).toEqual({ 'data-tohe-exit': '' });
    expect(calls).toEqual([]);
    expect(reported()).toEqual([true]);
  });

  it('offers continue and a new game with a game in progress, online and the board when the hub can', () => {
    const { shell, menu, labels, tools, tap, session } = setup(
      {
        inProgress: () => 'Ván đang chơi dở: 1.234 điểm.',
        best: () => '👑 Kỷ lục 5.678',
        online: true,
        leaderboard: true,
      },
      { leaderboard: true, rooms: true },
    );
    shell.start();
    expect(menu()?.body).toBe('Ván đang chơi dở: 1.234 điểm. · 👑 Kỷ lục 5.678');
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

  it('shows settings and how to play as full screens; Back returns to the title, and from there to Tò He', () => {
    const { shell, session, menu, tap, back, rows } = setup({
      inProgress: () => 'Ván dở',
      settings: [
        { label: 'Luật nhà', when: 'between-games', content: () => ({}) as HTMLElement },
        { label: 'Màu khối', when: 'any-time', content: () => ({}) as HTMLElement },
      ],
    });
    shell.start();
    tap('Cài đặt');
    expect(menu()?.layout).toBe('screen');
    expect(rows().map((row) => row.label)).toEqual(['Âm thanh']);
    expect(menu()?.sections?.map((s) => [s.title, s.note])).toEqual([
      ['Luật nhà', 'Đang có ván dở: áp dụng từ ván sau.'],
      ['Màu khối', undefined],
    ]);
    const sound = rows()[0] as Extract<OverlayRow, { kind: 'switch' }>;
    sound.onChange(false);
    expect(session.shell.setMuted).toHaveBeenCalledWith(true);
    expect((rows()[0] as Extract<OverlayRow, { kind: 'switch' }>).on).toBe(false);
    back();
    expect(menu()?.layout).toBe('title');
    tap('Cách chơi');
    expect(menu()?.title).toBe('Cách chơi');
    tap('Quay lại');
    expect(menu()?.layout).toBe('title');
    back();
    expect(session.exit).toHaveBeenCalled();
  });

  it('asks before a new game over the one in progress, then starts the play stage fresh', async () => {
    const { shell, menu, tap, calls } = setup({ inProgress: () => 'Ván dở' });
    shell.start();
    tap('🔄 Ván mới');
    expect(menu()?.title).toBe('Bắt đầu ván mới?');
    tap('Quay lại');
    expect(menu()?.layout).toBe('title');
    tap('🔄 Ván mới');
    tap('🔄 Ván mới');
    await settle();
    expect(calls).toEqual(['start fresh']);
  });

  it('shows how to play before the first game, then never again', async () => {
    let seen = false;
    const { shell, menu, tap, back, labels, calls } = setup({
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
    expect(menu()?.layout).toBe('screen');
    expect(labels()).toEqual(['▶ Bắt đầu']);
    expect(menu()?.actions[0]?.attributes).toEqual({ 'data-tohe-play': '' });
    back();
    expect(menu()?.layout).toBe('title');
    tap('▶ Chơi');
    tap('▶ Bắt đầu');
    await settle();
    expect(calls).toEqual(['done', 'start first']);
  });
});

describe('the play stage (ADR 0020)', () => {
  it('is created on play: loading, then the game alone, the menu stage gone', async () => {
    const { shell, menu, play, tap, reported, stageElement } = setup();
    shell.start();
    tap('▶ Chơi');
    expect(play()?.layout).toBe('loading');
    expect(menu()).toBeNull();
    await settle();
    expect(shell.playing).toBe(true);
    expect(stageElement.hidden).toBe(false);
    expect(reported()).toEqual([true, true, false]);
  });

  it('pauses into a quick panel with no way out to Tò He; Back goes on playing', async () => {
    const { shell, play, tap, back, labels, tools, rows, every, calls } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    back();
    expect(play()?.layout).toBe('menu');
    expect(play()?.title).toBe('Tạm dừng');
    expect(labels()).toEqual(['▶ Tiếp tục']);
    expect(rows().map((row) => row.label)).toEqual(['Âm thanh', 'Màu khối']);
    expect(tools()).toEqual(['Ván mới', 'Cách chơi', 'Menu chính']);
    expect(every().some((action) => action.attributes?.['data-tohe-exit'] !== undefined)).toBe(false);
    expect(play()?.tools?.[2]?.attributes).toEqual({ 'data-tohe-main-menu': '' });
    expect(calls.at(-1)).toBe('pause');
    back();
    expect(shell.playing).toBe(true);
    expect(calls.at(-1)).toBe('resume');
  });

  it("changes the game's looks in place from the panel, without leaving it", async () => {
    const { shell, tap, back, rows, play, calls } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    back();
    const colours = rows()[1] as Extract<OverlayRow, { kind: 'choices' }>;
    colours.onChoose('b');
    expect(calls.at(-1)).toBe('colour b');
    expect(play()?.title).toBe('Tạm dừng');
    expect((rows()[1] as Extract<OverlayRow, { kind: 'choices' }>).chosen).toBe('b');
  });

  it('goes back to the menu stage from the panel: the title at once, the stage left and its element emptied', async () => {
    const { shell, session, menu, play, tap, back, calls, stageElement } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    back();
    tap('Menu chính');
    expect(menu()?.layout).toBe('title');
    expect(play()).toBeNull();
    await settle();
    expect(calls).toEqual(['start', 'pause', 'leave']);
    expect(stageElement.replaceChildren).toHaveBeenCalled();
    expect(stageElement.hidden).toBe(true);
    back();
    expect(session.exit).toHaveBeenCalled();
  });

  it('opens the panel when the hub hides the game, and waits there', async () => {
    const { shell, tap, hidden, play, menu, calls } = setup();
    shell.start();
    hidden();
    expect(menu()?.layout).toBe('title');
    tap('▶ Chơi');
    await settle();
    hidden();
    expect(play()?.title).toBe('Tạm dừng');
    expect(calls.at(-1)).toBe('pause');
  });

  it('counts 3, 2, 1 before a game against the clock goes on', async () => {
    const { shell, calls, tap, back, play } = setup({ countdown: true });
    shell.start();
    tap('▶ Chơi');
    await settle();
    vi.useFakeTimers();
    back();
    tap('▶ Tiếp tục');
    expect(play()).toMatchObject({ layout: 'count', title: '3' });
    expect(calls.at(-1)).toBe('pause');
    vi.advanceTimersByTime(650);
    expect(play()?.title).toBe('2');
    // Back while counting: the panel again, and the count stops.
    back();
    expect(play()?.title).toBe('Tạm dừng');
    vi.advanceTimersByTime(5000);
    expect(play()?.title).toBe('Tạm dừng');
    back();
    vi.advanceTimersByTime(650 * 3);
    expect(shell.playing).toBe(true);
    expect(calls.at(-1)).toBe('resume');
  });

  it('starts a new game in place from the panel, after asking', async () => {
    const { shell, play, tap, back, calls } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    back();
    tap('Ván mới');
    expect(play()?.title).toBe('Bắt đầu ván mới?');
    back();
    expect(play()?.title).toBe('Tạm dừng');
    tap('Ván mới');
    tap('🔄 Ván mới');
    expect(calls.slice(-2)).toEqual(['resume', 'newGame']);
    expect(shell.playing).toBe(true);
  });

  it("brings the game's own card back when the panel closes", async () => {
    const { shell, back, play, tap, ctx } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    ctx().overlay.show({ title: 'Mẹo', actions: [] });
    expect(play()?.title).toBe('Mẹo');
    back();
    expect(play()?.title).toBe('Tạm dừng');
    back();
    expect(play()?.title).toBe('Mẹo');
    ctx().overlay.hide();
    expect(play()).toBeNull();
  });

  it('ends a game with play again (in place) and the main menu; Back goes to the menu stage', async () => {
    const { shell, calls, tap, labels, back, menu, play, ctx } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    ctx().gameOver({ title: 'Hết ván' });
    expect(labels()).toEqual(['▶ Chơi lại', '🏠 Menu chính']);
    expect(play()?.actions[1]?.attributes).toEqual({ 'data-tohe-main-menu': '' });
    tap('▶ Chơi lại');
    expect(calls).toEqual(['start', 'newGame']);
    ctx().gameOver({ title: 'Hết ván' });
    back();
    expect(menu()?.layout).toBe('title');
    await settle();
    expect(calls.at(-1)).toBe('leave');
  });

  it('shows a game that ended while the panel was open once play would go on', async () => {
    const { shell, tap, back, play, ctx } = setup();
    shell.start();
    tap('▶ Chơi');
    await settle();
    back();
    ctx().gameOver({ title: 'Hết ván' });
    expect(play()?.title).toBe('Tạm dừng');
    tap('▶ Tiếp tục');
    expect(play()?.title).toBe('Hết ván');
  });

  it('does not start a stage whose code arrives after the player went back to the menu', async () => {
    let deliver: (module: StageModule) => void = () => {};
    const slow = new Promise<StageModule>((resolve) => {
      deliver = resolve;
    });
    const started: string[] = [];
    const { shell, tap, back, menu } = setup({ stage: () => slow });
    shell.start();
    tap('▶ Chơi');
    back();
    expect(menu()?.layout).toBe('title');
    deliver({
      start: () => {
        started.push('start');
        return { pause: () => {}, resume: () => {}, newGame: () => {}, leave: () => {} };
      },
    });
    await settle();
    expect(started).toEqual([]);
    expect(menu()?.layout).toBe('title');
  });

  it('leaves a stage that started but was not ready when the player went back', async () => {
    const started: string[] = [];
    const { shell, tap, back, menu, play } = setup({
      stage: async () => ({
        start: () => {
          started.push('start');
          return {
            pause: () => {},
            resume: () => {},
            newGame: () => {},
            leave: () => void started.push('leave'),
          };
        },
      }),
    });
    shell.start();
    tap('▶ Chơi');
    await settle();
    expect(play()?.layout).toBe('loading');
    back();
    await settle();
    expect(started).toEqual(['start', 'leave']);
    expect(menu()?.layout).toBe('title');
  });

  it('says so when the play stage cannot start, and goes back to the menu', async () => {
    const { shell, session, tap, play, menu } = setup({ stage: () => Promise.reject(new Error('offline')) });
    shell.start();
    tap('▶ Chơi');
    await settle();
    expect(play()?.body).toBe('Chưa mở được ván chơi. Thử lại nhé.');
    expect(session.log).toHaveBeenCalled();
    tap('Quay lại');
    expect(menu()?.layout).toBe('title');
  });
});

describe('the panel’s cards to read', () => {
  it('opens an info row as a card over the panel, and Back returns to the panel', async () => {
    const { shell, tap, back, play, rows } = setup({
      stage: async () => ({
        start: (ctx) => {
          ctx.ready();
          return {
            pause: () => {},
            resume: () => {},
            newGame: () => {},
            leave: () => {},
            quick: () => [
              { kind: 'info', icon: '📜', label: 'Luật của bàn', card: () => ({ title: 'Luật' }) },
            ],
          };
        },
      }),
    });
    shell.start();
    tap('▶ Chơi');
    await settle();
    back();
    const link = rows()[1] as Extract<OverlayRow, { kind: 'link' }>;
    expect(link.kind).toBe('link');
    link.onClick();
    expect(play()?.title).toBe('Luật');
    back();
    expect(play()?.title).toBe('Tạm dừng');
  });
});

describe('a table and a replay: no menu stage', () => {
  it('at an online table: straight into play, the table goes on, and the panel keeps the seat’s way out', async () => {
    const { shell, session, calls, labels, tools, tap, back, hidden, play, menu, reported } = setup({
      direct: { exitLabel: 'Rời bàn', goesOn: true },
    });
    shell.start();
    expect(menu()).toBeNull();
    await settle();
    expect(shell.playing).toBe(true);
    expect(reported()).toEqual([true, false]);
    hidden();
    expect(shell.playing).toBe(true);
    back();
    expect(play()?.title).toBe('Menu');
    expect(play()?.body).toBe('Bàn vẫn tiếp tục khi bạn mở menu.');
    expect(labels()).toEqual(['▶ Tiếp tục']);
    expect(tools()).toEqual(['Cách chơi']);
    expect(play()?.footer?.attributes).toEqual({ 'data-tohe-exit': '' });
    tap('Rời bàn');
    expect(session.exit).toHaveBeenCalled();
    expect(calls).toEqual(['start', 'pause']);
  });

  it('in a replay: the end card plays it again, and Back opens the panel with the way out', async () => {
    const again = vi.fn();
    const { shell, labels, tap, back, play, ctx } = setup({
      direct: { exitLabel: 'Về sảnh', goesOn: false },
    });
    shell.start();
    await settle();
    ctx().gameOver({ title: 'Hết ván' }, { label: 'Xem lại từ đầu', onClick: again });
    expect(labels()).toEqual(['Xem lại từ đầu', 'Về sảnh']);
    back();
    expect(play()?.title).toBe('Tạm dừng');
    expect(play()?.footer?.label).toBe('Về sảnh');
    tap('▶ Tiếp tục');
    expect(play()?.title).toBe('Hết ván');
    tap('Xem lại từ đầu');
    expect(again).toHaveBeenCalled();
    expect(shell.playing).toBe(true);
  });
});
