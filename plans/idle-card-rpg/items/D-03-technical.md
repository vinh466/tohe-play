# D-03 — Technical foundation: hybrid render, save envelope, data (decided)

**Status:** decided — owner chose **Hybrid + E-03** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-17, D-04

## Decision (owner's words)

> "Hybrid + E-03 (Recommended)"

- **Hybrid render**: Phaser for the board/cards/FX; DOM/game-kit sheets for team, hero, gear, summon, codex, daily and stage picker.
- **FX**: pixelfx **sprite sheets** in Phaser (not runtime code), played by **E-03**; act timing in `content/fx.ts`.
- **Pure TS core** for battle/progression/economy; the scene and sheets are views.
- **Save envelope 256 KB** (P0), versioned and migrated by the game.
- **TS catalogs + sim** (D-11).
- **Assets on-demand** (P0), ~2 MB of FX on-demand.
- **One-effect prototype** (`crit-hit`) in the first slice; it is a gate, not a separate decision: if it does not read at 360×640 on a mid-range phone, fall back to the kit's `shake`/`floatText`/`burst` and re-open the FX part.

## Question

Render board và sheet bằng gì; save/schema/migration ra sao; nội dung load thế nào; và lớp FX pixel dùng pixelfx theo cách nào?

## Options

### A — Hybrid: Phaser board + DOM sheets (recommended)

- **Phaser 4** (game-kit) for the board, cards, clash, FX; a Phaser scene in the play stage.
- **DOM/game-kit overlay** for sheets: team, hero, gear, summon, codex, daily, stage picker. HTML/CSS is better for text, scroll, accessibility and fast iteration.
- **Shared state**: pure TypeScript logic (battle, progression, economy) independent of Phaser/DOM; the scene and sheets both read it.
- **FX**: pixelfx sprite sheets in Phaser (R-08), played by a small kit FX player (E-03); act timing in `content/fx.ts`.
- **Save**: a versioned envelope in the 256 KB P0 budget; compact keys; migrations on load; save on stage clear/upgrade/summon/pause.
- **Content**: TypeScript catalogs (D-11), Zod schemas in tests, reference checks; no runtime validation.
- **Assets**: Studio packs, `on-demand`; 2 MB of FX is fine on-demand.
- **Performance**: 60 fps target; cap concurrent effects; 30 fps sheets; object pools; test on a mid-range phone.

**Pros:** each layer does what it is good at; fastest UI iteration; best phone performance for the board; the kit already supports the split.
**Cons:** two renderers to reason about; state must be shared cleanly; the play stage must manage Phaser lifecycle.

### B — All Phaser

- Everything, including sheets, in Phaser.
- **Pros:** one renderer.
- **Cons:** text/scroll/accessibility in Phaser are painful; UI iteration is slower; the 6-sheet meta is a lot of UI.

### C — All DOM/Canvas

- The board and FX in DOM/Canvas; no Phaser.
- **Pros:** lighter; one renderer.
- **Cons:** card clash, particles, hit-stop and shader-like FX are much harder; the kit's Phaser helpers are unused.

## Recommendation

**A**, with a **one-effect prototype before locking**: play `pixelfx` `impacts/crit-hit` (sprite sheet) in a real Phaser scene at 360×640, measure frame time on a mid-range phone, and confirm the act timing (freeze/shake/push) reads. If it does, D-03 is decided; if not, fall back to the kit's `shake`/`floatText`/`burst` only.

## The technical shape

```
┌─────────────────────────────────────────┐
│ play stage (Phaser)                     │
│  board, 12 cards, turn rail, FX layer   │
│  ── reads/writes pure battle state ──   │
├─────────────────────────────────────────┤
│ DOM sheets (game-kit overlay)           │
│  team · hero · gear · summon · codex    │
│  daily · stage picker · settings        │
├─────────────────────────────────────────┤
│ pure TS core                            │
│  battle, progression, economy, content  │
├─────────────────────────────────────────┤
│ save envelope (256 KB) + content data   │
└─────────────────────────────────────────┘
```

- **Battle logic** is pure and deterministic (seeded RNG); the Phaser scene is a view.
- **Sheets** mutate the save/state through the same pure functions; no duplicated rules.
- **FX** is a view-only layer; it never decides damage.
- **Save** is versioned and migrated; the game owns the schema, the hub only stores JSON.
- **Content** is typed data; the balance sim (D-11) runs the same pure battle logic in Node.

## What it changes

- **D-11**: TS catalogs + Zod + sim; the same content feeds the game and the sim.
- **D-12**: sheets are DOM; the board is Phaser; the dock switches layers.
- **D-13**: pixelfx sprite sheets + palette variants; no runtime shader dependency.
- **E-03**: a kit FX player for sheets + act timing.
- **D-16**: the first implementation slice is the battle prototype + one FX.

## Evidence

- [R-08 — Pixel FX: pixelfx, sprite sheets and the platform](../research/R-08-pixel-fx.md).
- [R-04 — Platform fit](../research/R-04-platform-fit.md): shell, save, size.
- [R-05 — Platform extension options](../research/R-05-platform-extension.md): P0.
- `packages/game-kit/src/phaser/*`, `packages/game-kit/src/overlay.ts`, `packages/game-kit/src/content/index.ts`.
- pixelfx: https://github.com/patch-gg/pixelfx (MIT).

## Discussion

**owner (2026-11-09):** "khả năng cao là 1. nhưng bàn sau đi, tôi có thêm 1 nguồn asset cần phân tích cùng là pixelfx... dive research xem có giải pháp tối ưu k (chấp nhận xây thêm cho nền tảng luôn, đừng nhìn hẹp bởi nền tảng)", then chose **Hybrid + E-03**.

**agent (2026-11-09):** after the pixelfx analysis, A remains the right shape. pixelfx is a strong fit as **sprite sheets + act metadata**, not as a runtime code dependency. The one missing piece is a small kit FX player (E-03); the Studio `fx` kind (E-02) is not needed for v1. The prototype is the gate: measure one crit-hit sheet on a real phone before art lock.
