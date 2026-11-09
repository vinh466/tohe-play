# E-03 — A game-kit FX player for pixel sprite sheets

**Status:** proposed — chờ owner chốt · **Kind:** enhancement · **Blocked by:** D-03, D-13

## The gap

pixelfx exports a sprite sheet + Aseprite JSON with `meta.pixelfx` (fps, pivot, `act` timing). The game needs to:

- load the sheet + act data;
- play it once at a target card, with the right pivot/scale;
- emit the hit event so the game can freeze/shake/push;
- respect reduced motion;
- pre-bake palette variants (one sheet per element) and pick one;
- pool/destroy effects without leaking.

The kit has `shake`, `floatText`, `burst`, `squash`, `pulse` and `tweenAsync` (`packages/game-kit/src/phaser/juice.ts`), but **no sprite-sheet effect player** and no act metadata reader.

## Options

### A — A kit module `playFx(sheet, act, at, options)` (recommended)

- Input: a loaded Phaser atlas/sprite sheet, the effect's `meta.pixelfx` (pivot, fps) and `act` (windup, hits, freeze, shake, push).
- Plays a one-shot at a position; calls `onHit({ freeze, shake, push })` at the act's hit time.
- Options: `flip`, `scale`, `palette` (a pre-baked sheet key), `reducedMotion`, `depth`.
- Pools sprites; destroys on complete; caps concurrent effects.
- Tests: pivot/scale math, hit-time callback, reduced motion, pool reuse.

**Cost:** small–medium; one kit PR + tests + docs; no contract change.

### B — Per-game code

- The game writes its own player in `games/van-du-ky/src/fx.ts`.
- **Pros:** no kit change; tuned to the game.
- **Cons:** duplicated in every future game; no shared tests; the kit remains incomplete for FX.

### C — A Studio `fx` asset kind + a kit player

- Add an `fx` kind to the Studio (spritesheet + act metadata) and a kit player.
- **Pros:** the metadata lives with the asset; reusable across games.
- **Cons:** a contract/Studio/API change; not needed for one game; E-02 is a later investment.

## Recommendation

**A.** It is the smallest reusable piece: the Studio already stores the sprite sheet, and the act metadata can live in the game's `content/fx.ts` for v1. If a second game needs the same FX, promote the sidecar to a Studio `fx` kind (E-02) then.

## API sketch

```ts
import { playFx, type FxSheet } from '@tohe/game-kit/phaser';

const crit: FxSheet = {
  key: 'fx-crit-hit',
  pivot: [84, 106],
  fps: 30,
  framePrefix: 'crit-hit',
  act: { windup: 0.55, hits: [{ t: 0.06, freeze: 0.14, shake: 0.18, amp: 2, push: 2.8 }] },
};

const fx = playFx(scene, crit, { x, y, flip: true, scale: 2, onHit: (hit) => battle.onImpact(hit) });
```

- `playFx` returns a handle with `stop()` and `done` (a promise).
- `onHit` is called once per hit entry; the game decides whether to freeze the whole board or only the target.
- `reducedMotion` skips shake and shortens the effect; it does not change damage.

## What it changes

- D-03: the FX layer is a kit module, not game-specific code.
- D-13: the art pipeline exports sheets + act; the kit plays them.
- D-16: one FX prototype is part of the first implementation slice.
- Future games: any pixel game can reuse the player.

## Evidence

- [R-08 — Pixel FX](../research/R-08-pixel-fx.md): sheets, act data, sizes.
- `packages/game-kit/src/phaser/juice.ts` (existing feedback helpers).
- pixelfx sprite sheet format: `meta.pixelfx` + `frames` (Aseprite-style).

## Discussion

**agent (2026-11-09):** the kit already owns the feel helpers; a sprite-sheet player is the missing piece. Keep it small: one-shot, pivot/scale, hit callback, pool, reduced motion. Do not build a general shader/particle engine.
