---
title: Use assets in a game
description: Declare asset packs in game.json, resolve them into a lock, build a game that ships its files by hash with their credits, and load them in Phaser with the kit.
sidebar:
  order: 10
---

A game takes its pictures, sounds and fonts from packs approved in the [Asset Studio](../architecture/asset-studio.md).
It pins each pack by version in `game.json`; `@tohe/assets` (`tools/assets`) turns that into a lock of hashes, a typed
module for the game's code, and, at build time, the folder `studio/` that the
[Game Contract](../contracts/game-contract-v1.md#assets) asks for
([ADR 0053](../decisions/0053-assets-in-the-game-contract.md)). **No game uses assets yet**: this is the tool the first
one will use.

## 1. Declare the packs

In `public/game.json`:

```json
"assets": {
  "farm-crops": { "version": "1.0.0", "delivery": "bundle" },
  "farm-tiles": { "version": "2.1.0", "delivery": "bundle", "include": ["ground/*", "fence/*"] }
}
```

An exact version, never a range; `bundle` is the only delivery for now. `include` takes globs of asset ids (`*` stays
within one folder of the id, `**` crosses folders); a glob that matches no asset of the pack is an error, so a typo does
not silently drop files. Without `include`, the game takes the whole pack.

## 2. Point at the registry

The registry is the Studio's public storage: approved files and manifests, read without signing in. Its base URL comes
from **`TOHE_ASSETS_REGISTRY`**, which has no default yet — the production bucket does not exist. When something must be
fetched and the variable is unset, the tool fails and names it.

```sh
export TOHE_ASSETS_REGISTRY=https://assets.example.test
```

It reads two kinds of path below that base:

| Path | Holds |
| --- | --- |
| `packs/<id>/<version>.json` | the version's manifest ([below](#the-manifest)); written on approval, never changed |
| `blobs/sha256/<sha256>.<ext>` | one file, named by the sha256 of its content |

## 3. Resolve

Give the game the tool and its two scripts, in its `package.json`:

```json
"scripts": {
  "assets:resolve": "tohe-assets resolve",
  "assets:check": "tohe-assets check"
},
"devDependencies": { "@tohe/assets": "workspace:*" }
```

Then, in the game's folder:

```sh
pnpm assets:resolve
```

It fetches each pack version's manifest, applies `include`, and writes two **generated files**, both committed and
never edited by hand:

- **`assets.lock.json`**, next to `package.json`: an `AssetsLock` of `@tohe/contract` — per pack its version, the
  sha256 of its manifest, and for each file its asset id, kind, sha256, extension, bytes, licence and attribution.
- **`src/assets.gen.ts`**: per pack (its id in camelCase), per asset id, `{ key, url, kind }` and, when the manifest
  has them, `width`, `height` and `frames`. `key` is `<pack>/<asset id>`, unique in the game, for a loader's cache;
  `url` is relative to the build, `./studio/<sha256>.<ext>`.

The game loads them with the kit's `loadPack` ([below](#5-load-them-in-the-game)) and draws them by `key`.

Resolve again after changing `assets` in `game.json`. It fails, before writing anything, on a version with no manifest
(it does not exist, or it was withdrawn), on a licence the Studio does not accept and on a file whose licence needs an
attribution it lacks. Both files come out the same for the same input — sorted, so a diff shows only what changed.
`tohe-assets` with no folder, run outside a game (the repository's root), works on every game in `games/` that declares
`assets`; a game that no longer declares any loses its lock and its `assets.gen.ts`.

## 4. Build

Add the plugin to the game's `vite.config.ts`:

```ts
import { toheAssets } from '@tohe/assets/vite';

export default defineConfig({
  base: './',
  plugins: [toheAssets()],
});
```

At build time it reads **only the lock** — it never resolves anew — and:

1. fails, asking to run `pnpm assets:resolve`, when the lock's packs and versions are not those `game.json` declares;
2. takes every file of the lock from the cache, fetching a missing one from the registry by its hash;
3. checks the sha256 of every file, on download and on every read from the cache;
4. writes `dist/studio/<sha256>.<ext>` for every file, as it is; `dist/studio/lock.json`, a copy of the lock; and
   `dist/studio/credits.json`, the credits built from the lock — every pack with its licences and every attribution.

A failed download fails the build naming the file and its URL. A game without `assets` is left as it was.

## 5. Load them in the game

`@tohe/game-kit/phaser` loads a pack of `src/assets.gen.ts` in one call:

```ts
import { loadPack, loadPacks } from '@tohe/game-kit/phaser';
import { assets } from './assets.gen.ts';

// in a scene's create() (or preload(): the loader starts either way)
await loadPack(this, assets.farmCrops);              // or loadPacks(this, assets.farmCrops, assets.farmTiles)
this.add.image(x, y, assets.farmCrops['crops/carrot'].key);
```

Each asset is queued by its kind:

| Kind | Loaded as |
| --- | --- |
| `image`, `tileset` | `scene.load.image(key, url)` |
| `spritesheet` | `scene.load.spritesheet(key, url, { frameWidth, frameHeight, endFrame: count - 1 })` from its `frames`; one without `frames` is an error |
| `audio` | `scene.load.audio(key, url)` |
| `font` | a `FontFace` whose family is the key, added to `document.fonts`: draw with `fontFamily: '"farm-fonts/title"'`, quoted, since a key holds a `/` |
| `palette` | nothing: the game reads the file's colours itself |

A key already in Phaser's textures or audio cache, or a font the kit already added, is skipped, so loading a pack twice
costs nothing. The promise resolves when the loader has finished, and rejects naming every asset whose file failed
(`farm-crops/crops/carrot (./studio/3f8a….png)`). The kit's games run Phaser with its own audio off (they synthesize
their sounds, `createSfx`), so Phaser skips `audio` files there.

## 6. Credits

Nothing to write: the shell's title screen shows **Ghi công** by itself in a game whose `game.json` declares `assets`.
It reads `studio/credits.json` from the game's folder and lists, per pack, its version, its licences and every
attribution ([Game shell](../architecture/game-shell.md#menu-stage)). A game that wants the credits elsewhere uses
`readCredits()` and `formatCredits()` from `@tohe/game-kit`.

## The cache

Files are kept by hash in **`$XDG_CACHE_HOME/tohe/assets/sha256/`** (else `~/.cache/tohe/assets/sha256/`): one folder
for every worktree on the machine, so a file is fetched once. The manifests the locks pin are kept there too, as
`<sha256>.json`. A file whose content does not hash to its name fails the build, naming the file: delete it and build
again. CI keeps the folder between runs, keyed by the hash of every `games/*/assets.lock.json`.

**Offline:** with `TOHE_ASSETS_OFFLINE=1` the tool never fetches. A build whose files are all in the cache works; one
that misses any fails, naming every missing file. `assets:resolve` always needs the registry.

## The drift check

`tohe-assets check` (in a game's folder, or for every game from the repository's root) fails when the lock is not what
`game.json` and the manifests it pins make, or when `src/assets.gen.ts` is not exactly what they generate; it also fails
when a game without `assets` still has either file. It reads the manifests by the hash the lock pins, from the cache or
the registry. `pnpm verify` and CI run it.

## The manifest

The format of `packs/<id>/<version>.json` — the Studio writes it on approval, and `@tohe/assets` exports its Zod schema
as `PackManifest`:

```json
{
  "manifestVersion": 1,
  "id": "farm-crops",
  "version": "1.0.0",
  "files": [
    {
      "id": "crops/carrot",
      "kind": "spritesheet",
      "sha256": "3f8a…",
      "ext": "png",
      "bytes": 1234,
      "licence": "CC-BY-4.0",
      "attribution": "Carrot by A. Artist",
      "width": 64,
      "height": 16,
      "frames": { "width": 16, "height": 16, "count": 4 }
    }
  ]
}
```

| Field | Holds |
| --- | --- |
| `manifestVersion` | `1` |
| `id`, `version` | the pack and its version; they must match the path |
| `files[].id` | the asset id, unique in the pack: `a-z`, digits, `-`, and `/` for folders |
| `files[].kind` | `image`, `spritesheet`, `tileset`, `audio`, `font` or `palette` |
| `files[].sha256`, `ext`, `bytes` | the file's hash (lowercase hex), extension without the dot, and size |
| `files[].licence`, `attribution` | an SPDX identifier, and the credit when the licence asks for one |
| `files[].width`, `height` | optional: a picture's size in pixels |
| `files[].frames` | optional: a sprite sheet's frame size and how many frames it holds |

Fields not listed are ignored, so the Studio can add some without breaking older builds. The lock pins the sha256 of the
manifest's bytes: an approved version never changes, and a manifest that no longer hashes to what the lock pins is an
error.
