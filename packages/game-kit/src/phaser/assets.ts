// A game's asset packs in Phaser (ADR 0053): `loadPack(scene, assets.farmCrops)` queues every asset of one pack of
// the game's `src/assets.gen.ts` by its kind and resolves when the loader is done. The pack is typed by its shape, so
// the kit does not depend on @tohe/assets. The files are in the game's own folder (`./studio/<sha256>.<ext>`).

/** What `src/assets.gen.ts` holds for one asset (its `StudioAsset`). */
export interface AssetRef {
  /** `<pack>/<asset id>`: the key of the texture, the audio or the font family. */
  readonly key: string;
  /** `./studio/<sha256>.<ext>`, relative to the game's page. */
  readonly url: string;
  readonly kind: 'image' | 'spritesheet' | 'tileset' | 'audio' | 'font' | 'palette';
  readonly width?: number;
  readonly height?: number;
  readonly frames?: { readonly width: number; readonly height: number; readonly count: number };
}

/** One pack of `src/assets.gen.ts`: asset id → asset. */
export type AssetPack = Readonly<Record<string, AssetRef>>;

/** A file the loader could not load, as Phaser hands it to `loaderror`. */
interface FailedFile {
  key: string;
  url?: unknown;
}

/** The parts of a Phaser scene `loadPack` uses: a `Phaser.Scene` has them. */
export interface PackScene {
  readonly load: {
    image(key: string, url: string): unknown;
    spritesheet(
      key: string,
      url: string,
      config: { frameWidth: number; frameHeight: number; endFrame: number },
    ): unknown;
    audio(key: string, url: string): unknown;
    on(event: 'loaderror', listener: (file: FailedFile) => void): unknown;
    off(event: 'loaderror', listener: (file: FailedFile) => void): unknown;
    once(event: 'complete', listener: () => void): unknown;
    start(): void;
    isLoading(): boolean;
  };
  readonly textures: { exists(key: string): boolean };
  readonly cache: { readonly audio: { exists(key: string): boolean } };
}

/** Where fonts go: the page's `document.fonts`, or a fake in tests. */
export interface FontLoader {
  /** The kit already added a font of this family. */
  has(family: string): boolean;
  /** Loads the font at `url` as `family` and adds it to the page. */
  load(family: string, url: string): Promise<void>;
}

/** The kit's fonts by family: a pack loaded twice adds each font once. */
const fontsAdded = new Map<string, Promise<void>>();

const documentFonts: FontLoader = {
  has: (family) => fontsAdded.has(family),
  load(family, url) {
    const loading = (async () => {
      // The family is the key as it is: Chrome keeps it whole (`farm-fonts/title`); CSS names it in quotes.
      const face = new FontFace(family, `url(${JSON.stringify(url)})`);
      await face.load();
      document.fonts.add(face);
    })();
    fontsAdded.set(family, loading);
    // A failed font may be tried again by a later call.
    loading.catch(() => fontsAdded.delete(family));
    return loading;
  },
};

const named = (asset: AssetRef) => `${asset.key} (${asset.url})`;

/**
 * Loads every asset of one pack of `src/assets.gen.ts` by its kind: `image` and `tileset` as images, `spritesheet` by
 * its frames, `audio`, `font` as a `FontFace` named by its key, `palette` not at all. A key already in Phaser's textures
 * or audio cache is skipped. Resolves when the loader completes (call it in `preload()` or later: it starts the loader
 * when it is not running); rejects naming every asset whose file failed.
 */
export function loadPack(scene: PackScene, pack: AssetPack): Promise<void> {
  return loadPacksWith(scene, [pack], documentFonts);
}

/** `loadPack` for several packs, in one run of the loader. */
export function loadPacks(scene: PackScene, ...packs: AssetPack[]): Promise<void> {
  return loadPacksWith(scene, packs, documentFonts);
}

/** `loadPacks` with the fonts' loader given: what the tests drive. */
export async function loadPacksWith(scene: PackScene, packs: AssetPack[], fonts: FontLoader): Promise<void> {
  const assets = packs.flatMap((pack) => Object.values(pack));
  const unframed = assets.filter((asset) => asset.kind === 'spritesheet' && !asset.frames);
  if (unframed.length > 0) throw new Error(`spritesheet without frames: ${unframed.map(named).join(', ')}`);

  const { load } = scene;
  /** What this call waits for from the loader, by key. */
  const waiting = new Map<string, AssetRef>();
  const fontLoads: Promise<AssetRef | null>[] = [];
  for (const asset of assets) {
    const { key, url } = asset;
    switch (asset.kind) {
      case 'image':
      case 'tileset':
        if (scene.textures.exists(key)) break;
        load.image(key, url);
        waiting.set(key, asset);
        break;
      case 'spritesheet': {
        if (scene.textures.exists(key)) break;
        const frames = asset.frames as NonNullable<AssetRef['frames']>;
        load.spritesheet(key, url, {
          frameWidth: frames.width,
          frameHeight: frames.height,
          endFrame: frames.count - 1,
        });
        waiting.set(key, asset);
        break;
      }
      case 'audio':
        if (scene.cache.audio.exists(key)) break;
        load.audio(key, url);
        waiting.set(key, asset);
        break;
      case 'font':
        if (fonts.has(key)) break;
        fontLoads.push(
          fonts.load(key, url).then(
            () => null,
            () => asset,
          ),
        );
        break;
      case 'palette':
        break;
    }
  }

  const failed: AssetRef[] = [];
  if (waiting.size > 0) {
    await new Promise<void>((resolve) => {
      const onError = (file: FailedFile) => {
        const asset = waiting.get(file.key);
        if (asset) failed.push(asset);
      };
      load.on('loaderror', onError);
      load.once('complete', () => {
        load.off('loaderror', onError);
        resolve();
      });
      if (!load.isLoading()) load.start();
    });
  }
  for (const asset of await Promise.all(fontLoads)) if (asset) failed.push(asset);
  if (failed.length > 0) throw new Error(`asset files failed to load: ${failed.map(named).join(', ')}`);
}
