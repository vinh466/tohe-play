# R-08 — Pixel FX: pixelfx, sprite sheets and the platform

Date: 2026-11-09 · Status: first pass

Question: [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx) có dùng được cho Vân Du Ký không, dùng cách nào, và có đáng mở rộng nền tảng không?

## What pixelfx is

- **244 pixel-art effects**, each a small JS module; no dependencies; MIT (code and effects).
- Categories: moves, fire, explosions, water, ice, lightning, sci-fi, melee, impacts, projectiles, spawn/death, arcane, holy, shadow, status, nature, weather, UI, pickups, transitions, critters.
- **Two ways to use**:
  1. **Code**: `createFx` / `createAct` draw into a low-res frame (color + light buffers), then composite; works in canvas/Phaser/PixiJS/three.js.
  2. **Sprite sheets**: `node tools/render.mjs <id> --sheet` writes a PNG + Aseprite-style JSON (frame rects, durations, `meta.pixelfx` with fps, loop, pivot, and `act` timing).
- **Act data** is the gold: wind-up, hit at `t`, freeze, shake amplitude, push distance, poses. It is exactly the "card clash" feel: the effect tells the game when to stop, shake, and push.
- **Palette** is an option: any effect can be re-rendered with a dark-to-bright ramp, so one fire effect can be Ember, Tide (blue), Stone (gold), Gale (green), or a heal.
- **Seeded**: deterministic frames; good for replays/simulation.
- **Licence**: MIT; attribution to Patch and Hugo Duprez. The Patch Pixel font in `gallery/fonts` is **not** MIT — do not use it; use Be Vietnam Pro for UI.
- **Skill**: the repo ships a Claude Code skill to find/export/make effects; MIT. It can speed up new FX in the same style.

## Test exports (measured, not estimated)

| Effect | Frames | PNG size | Use |
|---|---:|---:|---|
| `impacts/hit-spark` | 16 | 24 KB | every hit |
| `impacts/hit-flash` | 16 | 24 KB | hit flash |
| `impacts/crit-hit` | 28 | 140 KB | crit |
| `melee/sword-slash` | 24 | 60 KB | melee |
| `holy/heal` | 58 | 172 KB | heal |
| `shadow/curse` | 103 | 360 KB | debuff |
| `ice/frost-nova` | 103 | 796 KB | ultimate |
| `lightning/lightning-strike` | 91 | 1 128 KB | ultimate |
| `arcane/magic-circle-cast` | 118 | 1 220 KB | ultimate |
| `moves/fireball-throw` | 205 | 1 308 KB | too long for a card battle |
| `ui/crit-number` | 46 | 240 KB | skip; the kit's `floatText` is enough |
| `transitions/iris` | 67 | 488 KB | skip; a simple fade is enough |

**Facts:**

- Short impact effects are **cheap** (24–140 KB) and perfect for card clashes.
- Big spell effects are **0.8–1.3 MB each**; using 3–4 of them bundled would add ~4 MB to the build. With P0 asset on-demand, that is fine; with `bundle`, the build would exceed the 4.5 MB target.
- Many effects are **longer than a card battle needs** (frost nova 3.4 s, fireball 6.8 s). Trim to the first 24–40 frames or play as a one-shot overlay while the battle continues.

## How to use it

### A — Sprite sheets in Phaser (recommended for v1)

1. Export the chosen effects with `--sheet`; keep the PNG + JSON.
2. Package the PNG as a Studio **`spritesheet`** asset (the JSON can be a sidecar in the game's content).
3. Load with Phaser's atlas loader; read `meta.pixelfx` for pivot/fps/act; play as a one-shot sprite at the target card.
4. Pre-bake palette variants at export time (`--opts '{"palette":[...]}'`) — one sheet per element/ultimate.
5. On the `act.hits` event, trigger the game's hit-stop/shake/push; the effect itself does not block the battle.

**Pros**: predictable phone performance; no runtime simulation; standard Aseprite JSON; the Studio can store/credit it; the game-kit can play it.
**Cons**: PNG size; palette variants multiply sheets; metadata sidecar.

### B — Code directly

- Import only the effect modules; use `createFx`/`createAct` on a canvas layer.
- **Pros**: no PNG size; palette at runtime; the act data is already in the module.
- **Cons**: JS in the game bundle; CPU per effect; harder to fit the Studio asset/credit pipeline; more risk on low-end phones with 12 cards + effects.

### C — Hybrid

- Sprite sheets for common hits/ultimates; code for a few dynamic things (portals, weather, palette-shifting auras).
- **Verdict**: a v2 option; not needed for v1.

## Platform implications

| Need | Current platform | Recommendation |
|---|---|---|
| Store an FX sprite sheet | Studio `spritesheet` kind (PNG + frames) | Use it; no contract change |
| Store `act` timing/pivot | Not in the Studio manifest | Keep a small `content/fx.ts` sidecar in the game (v1); a Studio `fx` kind is a later option |
| Play a sheet with hit events | No game-kit helper | **E-03: a game-kit FX player** (small; reads sheet + act, emits hit/freeze/shake/push; palette variants) |
| Asset size | P0 asset on-demand | Use it; ~2 MB of FX is fine on-demand, not as a bundle |
| Credit/licence | Studio `credits.json` + MIT accepted | Add Patch/Hugo Duprez attribution; never use the Patch Pixel font |
| Make new effects | pixelfx skill/tools | Use the skill to generate/export, then the Studio checks the sheet |

**E-02 (a Studio `fx` asset kind) is not needed for v1.** The existing `spritesheet` + a game-side `act` sidecar is enough. Build E-02 only when a second game needs the same FX metadata.

## Recommended FX set for v1 (~2 MB on-demand)

- **Hits**: hit-spark, hit-flash, crit-hit, sword-slash, blunt-hit, shield-block.
- **Element signatures**: one per element — Ember (fire burst), Tide (water/ice), Stone (earth), Gale (wind/lightning); trim to 24–40 frames.
- **Support**: heal, shield/divine, curse.
- **Pickups/UI**: coin-collect, chest-open, level-up, combo.
- **No** 205-frame moves, no 3-second ultimates, no separate crit-number/iris sheets.
- **Palette**: one sheet per element variant, pre-baked; do not recolor at runtime on the phone.

## Recommendation for D-03

- The render split stays **hybrid**: Phaser for the board/effects, DOM/game-kit for sheets. pixelfx does not change that; it gives the board a strong FX layer.
- Use **sprite sheets in Phaser** + **E-03 FX player**; keep act timing in `content/fx.ts`.
- Prototype **one effect** (crit-hit) in the real Phaser scene before locking D-03; measure frame time on a mid-range phone.
- If the prototype is good, D-03 is decided; if not, fall back to the kit's `shake`/`floatText`/`burst` only.

## Open

- Which 20 effects exactly; which ultimates get a big sheet.
- Trim ranges for the 0.8–1.3 MB effects.
- Palette ramps per element and the card frame colors.
- E-03 API shape; whether the act sidecar lives in content or in the Studio later.
- Whether to adopt the pixelfx skill for authoring; licence/attribution text.

## Sources

- https://github.com/patch-gg/pixelfx (README, MIT licence, catalog)
- Local exports in `/tmp/opencode/pixelfx-out` and `/tmp/opencode/pixelfx-out2` (not in the repo)
- [R-03 — Battle, card UX and pixel art](R-03-battle-card-ux.md)
- [D-03 — Technical foundation](../items/D-03-technical.md)
- `packages/game-kit/src/phaser/juice.ts`, `docs/guides/make-assets.md`
