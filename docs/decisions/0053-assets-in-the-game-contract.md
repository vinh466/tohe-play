---
title: "0053: A game declares its asset packs in game.json and ships them pinned by hash"
description: The Game Contract gains, in protocol 1, an optional `assets` field — pack, version and delivery per pack — and a build folder `studio/` with the files by hash, the lock and the credits; conformance checks them, and checks that a game requests nothing outside its own folder.
sidebar:
  order: 53
---

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** the owner, 2026-10-24, in plans/asset-studio D-12 ("ok chốt theo đề xuất, hướng review đã ổn"), on the
  ground laid by [ADR 0050](0050-a-game-declares-what-it-depends-on.md) and
  [ADR 0051](0051-an-asset-studio-for-game-assets.md). The agent simplified one point for the first step, marked
  *(agent)*: files are copied as they are, without atlases.

## Context

ADR 0051 makes assets in a Studio and lets a game pin them at build time. The contract must say how a game declares its
packs, what its build carries, and what conformance checks, so that an agent writes it right the first time and nothing
about a built game can change afterwards. A game makes no network request outside its folder (Game Contract v1, runtime
rules) — a rule written down but, until now, checked only per origin.

## Decision

All of it is **additive in protocol 1**: a game without `assets` is built and checked as before.

### The manifest

```json
"assets": {
  "farm-crops": { "version": "1.0.0", "delivery": "bundle" },
  "farm-tiles": { "version": "2.1.0", "delivery": "bundle", "include": ["ground/*", "fence/*"] }
}
```

| Field | Means |
| --- | --- |
| key | a pack id (`a-z`, digits, `-`; 3–40), at most 20 packs |
| `version` | the pack version, exact semver — never a range |
| `delivery` | `bundle` — the only value for now; `precache` and `on-demand` come later as new values (ADR 0051) |
| `include` | optional: globs of asset ids; without it, the whole pack |

### The build folder

```text
dist/studio/
├── <sha256>.<ext>   every asset file the game uses, named by its hash
├── lock.json        a copy of the game's assets.lock.json
└── credits.json     who made what, under which licence
```

- `lock.json` lists, per pack: its version, the hash of its manifest, and for each file its asset id, kind, sha256,
  bytes, SPDX licence and attribution. It is generated (`pnpm assets:resolve`) and committed as `assets.lock.json` next to
  `game.json`; the build copies it.
- *(agent)* Files are copied as they are. Packing them into atlases is a later optimisation of the build; it will name
  its output files by hash too and list them beside the lock.
- `credits.json` lists every pack with its licences and, for every file whose licence asks for it, the attribution.
- The game's code reaches its files through `src/assets.gen.ts`, generated from the lock: typed keys, URLs relative to
  the build.
- What decides a table's rules or a ranked run (numbers, recipes) is in the game's code, never in an asset.

### Conformance

With `assets`:

1. the lock's packs and versions are exactly those of `assets`;
2. every file in `studio/` is in the lock with the same sha256, and every file in the lock is in `studio/`;
3. every licence is one the Studio accepts (ADR 0051), and `credits.json` names every attribution the lock holds.

For every game: **no request outside the game's own folder**. Conformance serves the build at `/<id>/<version>/`, as the
games origin does, and fails a request to any other path.

### Not done here

`precache`, `on-demand`; atlases; the hub showing credits (the game shows them, through the kit).

## Consequences

- `@tohe/contract`: `assets` in `GameManifest`, the lock and credits schemas, the accepted licences; the JSON schemas
  regenerated.
- The conformance kit: the checks above, and the build served under its folder.
- [Game Contract v1](../contracts/game-contract-v1.md): the field, the build folder, the checks, *Versioning*.
- The build tool (`assets:resolve`, the cache, `assets.gen.ts`) and the kit's pack loader and credits follow in their
  own pull requests.

## Alternatives considered

- **The game copies files into `public/`:** no lock, no hashes, no licences checked, no way to update a pack.
- **The lock inside `game.json`:** fewer files, but what a person declares and what a machine pins would be mixed.
- **Atlases from the first step:** fewer requests and smaller downloads, but conformance could no longer match each file
  to the lock without a second index; it comes when a game needs it.
