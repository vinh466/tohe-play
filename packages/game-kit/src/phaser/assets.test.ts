import type Phaser from 'phaser';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { type AssetPack, type FontLoader, loadPacksWith, type PackScene } from './assets.ts';

// The shape of a pack in a game's src/assets.gen.ts (tools/assets/src/generate.ts).
const farmCrops = {
  'crops/carrot': {
    key: 'farm-crops/crops/carrot',
    url: './studio/aaa.png',
    kind: 'image',
    width: 16,
    height: 16,
  },
  'crops/grow': {
    key: 'farm-crops/crops/grow',
    url: './studio/bbb.png',
    kind: 'spritesheet',
    width: 64,
    height: 16,
    frames: { width: 16, height: 16, count: 4 },
  },
  'ground/grass': { key: 'farm-crops/ground/grass', url: './studio/ccc.png', kind: 'tileset' },
  'sounds/pop': { key: 'farm-crops/sounds/pop', url: './studio/ddd.ogg', kind: 'audio' },
  'fonts/title': { key: 'farm-crops/fonts/title', url: './studio/eee.woff2', kind: 'font' },
  'colours/autumn': { key: 'farm-crops/colours/autumn', url: './studio/fff.json', kind: 'palette' },
} as const satisfies AssetPack;

/** A loader that records what it is asked and completes when told, failing the urls given. */
function fakeScene({ textures = [] as string[], audio = [] as string[] } = {}) {
  const calls: string[] = [];
  const listeners = { loaderror: new Set<(file: { key: string }) => void>(), complete: [] as (() => void)[] };
  let loading = false;
  const scene: PackScene = {
    load: {
      image: (key, url) => calls.push(`image ${key} ${url}`),
      spritesheet: (key, url, config) => calls.push(`spritesheet ${key} ${url} ${JSON.stringify(config)}`),
      audio: (key, url) => calls.push(`audio ${key} ${url}`),
      on: (_, listener) => listeners.loaderror.add(listener),
      off: (_, listener) => listeners.loaderror.delete(listener),
      once: (_, listener) => listeners.complete.push(listener),
      start: () => {
        calls.push('start');
        loading = true;
      },
      isLoading: () => loading,
    },
    textures: { exists: (key) => textures.includes(key) },
    cache: { audio: { exists: (key) => audio.includes(key) } },
  };
  /** The loader is done: `failed` keys errored first. */
  const finish = (...failed: string[]) => {
    for (const key of failed) for (const listener of listeners.loaderror) listener({ key });
    loading = false;
    for (const listener of listeners.complete.splice(0)) listener();
  };
  return { scene, calls, finish, listeners, setLoading: (on: boolean) => (loading = on) };
}

function fakeFonts(failing: string[] = [], added: string[] = []): FontLoader & { loaded: string[] } {
  const loaded: string[] = [];
  return {
    loaded,
    has: (family) => added.includes(family),
    load: async (family, url) => {
      loaded.push(`${family} ${url}`);
      if (failing.includes(family)) throw new Error('bad font');
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('loadPack (ADR 0053)', () => {
  it('takes a Phaser scene', () => {
    expectTypeOf<Phaser.Scene>().toMatchTypeOf<PackScene>();
  });

  it('queues every asset by its kind, starts the loader and resolves when it completes', async () => {
    const { scene, calls, finish } = fakeScene();
    const fonts = fakeFonts();
    let done = false;
    const loading = loadPacksWith(scene, [farmCrops], fonts).then(() => {
      done = true;
    });
    expect(calls).toEqual([
      'image farm-crops/crops/carrot ./studio/aaa.png',
      'spritesheet farm-crops/crops/grow ./studio/bbb.png {"frameWidth":16,"frameHeight":16,"endFrame":3}',
      'image farm-crops/ground/grass ./studio/ccc.png',
      'audio farm-crops/sounds/pop ./studio/ddd.ogg',
      'start',
    ]);
    expect(fonts.loaded).toEqual(['farm-crops/fonts/title ./studio/eee.woff2']);
    await settle();
    expect(done).toBe(false);
    finish();
    await loading;
    expect(done).toBe(true);
  });

  it('skips keys already loaded, and does not start the loader for nothing', async () => {
    const { scene, calls } = fakeScene({
      textures: ['farm-crops/crops/carrot', 'farm-crops/crops/grow', 'farm-crops/ground/grass'],
      audio: ['farm-crops/sounds/pop'],
    });
    const fonts = fakeFonts([], ['farm-crops/fonts/title']);
    await loadPacksWith(scene, [farmCrops], fonts);
    expect(calls).toEqual([]);
    expect(fonts.loaded).toEqual([]);
  });

  it('joins a loader that is already running instead of starting it again', async () => {
    const { scene, calls, finish, setLoading } = fakeScene();
    setLoading(true);
    const loading = loadPacksWith(scene, [{ 'crops/carrot': farmCrops['crops/carrot'] }], fakeFonts());
    expect(calls).toEqual(['image farm-crops/crops/carrot ./studio/aaa.png']);
    finish();
    await loading;
  });

  it('loads several packs in one run of the loader', async () => {
    const { scene, calls, finish } = fakeScene();
    const tiles = { fence: { key: 'farm-tiles/fence', url: './studio/ggg.png', kind: 'tileset' } } as const;
    const loading = loadPacksWith(scene, [{ 'crops/carrot': farmCrops['crops/carrot'] }, tiles], fakeFonts());
    expect(calls.filter((call) => call === 'start')).toHaveLength(1);
    expect(calls).toContain('image farm-tiles/fence ./studio/ggg.png');
    finish();
    await loading;
  });

  it('rejects naming every asset whose file failed, its own only, and stops listening', async () => {
    const { scene, finish, listeners } = fakeScene();
    const loading = loadPacksWith(scene, [farmCrops], fakeFonts(['farm-crops/fonts/title']));
    finish('farm-crops/crops/grow', 'another-game/thing');
    await expect(loading).rejects.toThrow(
      'asset files failed to load: farm-crops/crops/grow (./studio/bbb.png), farm-crops/fonts/title (./studio/eee.woff2)',
    );
    expect(listeners.loaderror.size).toBe(0);
  });

  it('refuses a spritesheet without its frames before queuing anything', async () => {
    const { scene, calls } = fakeScene();
    const { frames: _, ...unframed } = farmCrops['crops/grow'];
    await expect(loadPacksWith(scene, [{ grow: unframed }], fakeFonts())).rejects.toThrow(
      'spritesheet without frames: farm-crops/crops/grow (./studio/bbb.png)',
    );
    expect(calls).toEqual([]);
  });

  it('needs nothing for a palette or an empty pack', async () => {
    const { scene, calls } = fakeScene();
    await loadPacksWith(scene, [{ autumn: farmCrops['colours/autumn'] }, {}], fakeFonts());
    expect(calls).toEqual([]);
  });
});
