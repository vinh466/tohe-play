import { AssetCredits as ContractCredits } from '@tohe/contract';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { type AssetCredits, CREDITS_URL, formatCredits, parseCredits, readCredits } from './credits.ts';
import { iconNames } from './icons.ts';
import type { Overlay, OverlayAction, OverlayCard } from './overlay.ts';
import { createShell, type ShellOptions } from './shell.ts';

const credits: AssetCredits = ContractCredits.parse({
  packs: [
    {
      id: 'farm-crops',
      version: '1.0.0',
      licences: ['CC-BY-4.0', 'CC0-1.0'],
      attributions: [
        { assets: ['crops/carrot', 'crops/corn'], text: 'Crops by A. Artist (CC BY 4.0)' },
        { assets: ['crops/pumpkin'], text: 'Pumpkin by B. Builder' },
      ],
    },
    { id: 'farm-tiles', version: '2.1.0', licences: ['CC0-1.0'], attributions: [] },
  ],
});

/** A fetch over a few files of the game's folder; anything else is a 404. */
function folder(files: Record<string, unknown>) {
  const asked: string[] = [];
  const fetcher = async (url: string) => {
    asked.push(url);
    return url in files
      ? new Response(JSON.stringify(files[url]), { status: 200 })
      : new Response('not found', { status: 404 });
  };
  return { fetcher, asked };
}

const withAssets = { id: 'farm', assets: { 'farm-crops': { version: '1.0.0', delivery: 'bundle' } } };

describe('the credits (ADR 0053)', () => {
  it('has the shape of the contract’s AssetCredits', () => {
    expectTypeOf<ContractCredits>().toMatchTypeOf<AssetCredits>();
    expectTypeOf<AssetCredits>().toMatchTypeOf<ContractCredits>();
  });

  it('formats one block per pack: the pack and version, its licences, each attribution', () => {
    expect(formatCredits(credits, { licences: 'Giấy phép' })).toEqual([
      {
        title: 'farm-crops 1.0.0',
        lines: ['Giấy phép: CC-BY-4.0, CC0-1.0', 'Crops by A. Artist (CC BY 4.0)', 'Pumpkin by B. Builder'],
      },
      { title: 'farm-tiles 2.1.0', lines: ['Giấy phép: CC0-1.0'] },
    ]);
  });

  it('leaves out the licences line of a pack that lists none', () => {
    const bare = { packs: [{ id: 'farm-sky', version: '0.1.0', licences: [], attributions: [] }] };
    expect(formatCredits(bare, { licences: 'Licences' })).toEqual([{ title: 'farm-sky 0.1.0', lines: [] }]);
  });

  it('accepts what the contract accepts and refuses another shape', () => {
    expect(parseCredits(JSON.parse(JSON.stringify(credits)))).toEqual(credits);
    expect(parseCredits(null)).toBeNull();
    expect(parseCredits({})).toBeNull();
    expect(parseCredits({ packs: [{ id: 'farm-crops', version: '1.0.0', licences: 'CC0-1.0' }] })).toBeNull();
    expect(
      parseCredits({
        packs: [
          { id: 'farm-crops', version: '1.0.0', licences: [], attributions: [{ assets: [], text: 'x' }] },
        ],
      }),
    ).toBeNull();
    expect(
      parseCredits({
        packs: [
          { id: 'farm-crops', version: '1.0.0', licences: [], attributions: [{ assets: ['a'], text: '' }] },
        ],
      }),
    ).toBeNull();
  });

  it('reads the credits of a game that declares assets, from its own folder', async () => {
    const { fetcher, asked } = folder({ './game.json': withAssets, [CREDITS_URL]: credits });
    await expect(readCredits(fetcher)).resolves.toEqual(credits);
    expect(asked).toEqual(['./game.json', './studio/credits.json']);
  });

  it('asks for no credits file in a game without assets, so nothing logs a 404', async () => {
    const { fetcher, asked } = folder({ './game.json': { id: 'hello' } });
    await expect(readCredits(fetcher)).resolves.toBeNull();
    expect(asked).toEqual(['./game.json']);
  });

  it('is null when the credits file is missing, malformed or empty, or nothing can be read', async () => {
    await expect(readCredits(folder({ './game.json': withAssets }).fetcher)).resolves.toBeNull();
    await expect(
      readCredits(folder({ './game.json': withAssets, [CREDITS_URL]: { packs: 'no' } }).fetcher),
    ).resolves.toBeNull();
    await expect(
      readCredits(folder({ './game.json': withAssets, [CREDITS_URL]: { packs: [] } }).fetcher),
    ).resolves.toBeNull();
    await expect(readCredits(folder({}).fetcher)).resolves.toBeNull();
    await expect(readCredits(() => Promise.reject(new TypeError('offline')))).resolves.toBeNull();
    // A dev server's page instead of JSON.
    await expect(
      readCredits(async () => new Response('<!doctype html>', { status: 200 })),
    ).resolves.toBeNull();
  });
});

// The shell's side, here beside the credits it shows (shell.test.ts holds the rest of the shell).
describe('Ghi công on the title screen', () => {
  /** The game's folder as the shell's fetch sees it; anything not in `files` is a 404. */
  function serve(files: Record<string, unknown>) {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url);
      const found = url in files;
      return { ok: found, status: found ? 200 : 404, json: async () => files[url] } as Response;
    });
    return asked;
  }

  interface FakeNode {
    tag: string;
    className: string;
    textContent: string;
    children: FakeNode[];
    append(...nodes: FakeNode[]): void;
  }
  /** Just enough of `document` for the lines the credits screen builds. */
  const fakeDocument = () =>
    vi.stubGlobal('document', {
      createElement: (tag: string): FakeNode => {
        const node: FakeNode = {
          tag,
          className: '',
          textContent: '',
          children: [],
          append: (...nodes) => node.children.push(...nodes),
        };
        return node;
      },
    });

  /** A shell over two layers that remember their card, and a session that remembers what it was told. */
  function setup(overrides: Partial<ShellOptions> = {}) {
    const cards = { menu: null as OverlayCard | null, play: null as OverlayCard | null };
    const layer = (name: keyof typeof cards): Overlay => ({
      show: (card) => {
        cards[name] = card;
      },
      hide: () => {
        cards[name] = null;
      },
      get visible() {
        return cards[name] !== null;
      },
    });
    const listeners = new Map<string, () => void>();
    const menuChanged = vi.fn();
    const shell = createShell({
      session: {
        mode: 'embedded',
        locale: 'vi',
        settings: { muted: false, theme: 'light' },
        shell: { can: { leaderboard: false, rooms: false }, menuChanged, open: vi.fn(), setMuted: vi.fn() },
        exit: vi.fn(),
        log: vi.fn(),
        on: ((event: string, listener: () => void) => {
          listeners.set(event, listener);
          return () => {};
        }) as ShellOptions['session']['on'],
      },
      root: {} as HTMLElement,
      layers: {
        menu: layer('menu'),
        play: layer('play'),
        stage: { hidden: true, replaceChildren: vi.fn() } as unknown as HTMLElement,
      },
      title: 'Nông trại',
      logo: 'icon.svg',
      inProgress: () => null,
      howTo: () => ({ title: 'Cách chơi' }),
      stage: async () => ({
        start: (ctx) => {
          ctx.ready();
          return { pause() {}, resume() {}, newGame() {}, leave() {} };
        },
      }),
      ...overrides,
    });
    const top = () => cards.play ?? cards.menu;
    const every = (): OverlayAction[] => {
      const card = top();
      return [...(card?.actions ?? []), ...(card?.tools ?? []), ...(card?.corner ? [card.corner] : [])];
    };
    return {
      shell,
      menu: () => cards.menu,
      play: () => cards.play,
      tools: () => cards.menu?.tools?.map((tool) => tool.ariaLabel ?? tool.label) ?? [],
      tap(label: string) {
        const action = every().find((a) => a.label === label || a.ariaLabel === label);
        if (!action) throw new Error(`no "${label}" in ${JSON.stringify(every().map((a) => a.label))}`);
        action.onClick();
      },
      back: () => listeners.get('menu')?.(),
      reported: () => menuChanged.mock.calls.map(([open]) => open),
    };
  }

  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  const withAssets = { id: 'farm', assets: { 'farm-crops': { version: '1.0.0', delivery: 'bundle' } } };
  const files = { './game.json': withAssets, [CREDITS_URL]: credits };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appears once the credits are read, and opens a screen of them per pack', async () => {
    fakeDocument();
    const asked = serve(files);
    const { shell, menu, tools, tap, back, reported } = setup();
    shell.start();
    // The title screen does not wait for them.
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
    await settle();
    expect(asked).toEqual(['./game.json', './studio/credits.json']);
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi', 'Ghi công']);
    expect(menu()?.tools?.at(-1)?.icon).toBe('scroll');
    expect(iconNames).toContain('scroll');
    expect(reported()).toEqual([true, true]);

    tap('Ghi công');
    expect(menu()?.layout).toBe('screen');
    expect(menu()?.title).toBe('Ghi công');
    expect(menu()?.icon).toBe('scroll');
    const sections = menu()?.sections ?? [];
    expect(sections.map((section) => section.title)).toEqual(['farm-crops 1.0.0', 'farm-tiles 2.1.0']);
    expect(
      sections.map((section) =>
        (section.content as unknown as FakeNode).children.map((line) => line.textContent),
      ),
    ).toEqual([
      ['Giấy phép: CC-BY-4.0, CC0-1.0', 'Crops by A. Artist (CC BY 4.0)', 'Pumpkin by B. Builder'],
      ['Giấy phép: CC0-1.0'],
    ]);
    back();
    expect(menu()?.layout).toBe('title');
    tap('Ghi công');
    tap('Quay lại');
    expect(menu()?.layout).toBe('title');
  });

  it('asks for nothing more and changes nothing in a game without assets', async () => {
    const asked = serve({ './game.json': { id: 'hello' } });
    const { shell, tools, reported } = setup();
    shell.start();
    await settle();
    expect(asked).toEqual(['./game.json']);
    expect(tools()).toEqual(['Âm thanh: bật', 'Cài đặt', 'Cách chơi']);
    expect(reported()).toEqual([true]);
  });

  it('leaves play alone when the credits arrive during it; the next title screen has them', async () => {
    serve(files);
    const { shell, menu, play, tap, tools, back } = setup();
    shell.start();
    tap('Chơi');
    await settle();
    expect(play()).toBeNull();
    expect(menu()).toBeNull();
    back();
    tap('Menu chính');
    await settle();
    expect(menu()?.layout).toBe('title');
    expect(tools()).toContain('Ghi công');
  });

  it('reads nothing at a table or in a replay, which have no title screen', async () => {
    const asked = serve(files);
    const { shell } = setup({ direct: { exitLabel: 'Rời bàn', goesOn: true } });
    shell.start();
    await settle();
    expect(asked).toEqual([]);
  });
});
