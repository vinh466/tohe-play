---
title: Game FX from pixel sprite sheets
description: How a game plays a pixel-art hit effect from a sprite sheet, with the act timing that makes the board freeze, shake and push, and the pixelfx source it can start from.
sidebar:
  order: 13
---

Decision: [plans/idle-card-rpg](../../plans/idle-card-rpg/PLAN.md) E-03, D-13. The kit API is
`playFx` in [`@tohe/game-kit/phaser`](../../packages/game-kit/src/phaser/fx.ts).

## Why a sprite sheet, not a runtime simulation

A card game can show dozens of hits a minute on a phone. A pre-rendered sprite sheet is predictable: one texture, a
fixed frame count, no per-frame particle simulation. The **timing** is data: when the effect connects, how long the
board holds, how hard it shakes, how far the target moves. That data is the `act` block of a
[pixelfx](https://github.com/patch-gg/pixelfx) effect.

## The sheet

- A **uniform spritesheet** (the Studio's `spritesheet` kind): every frame is the same width and height; the texture key
  and `frames: { width, height, count }` come from the asset.
- The effect's `fps`, `pivot` and `act` come from the effect's JSON and live in the game's `content/fx.ts` (the Studio
  does not store act metadata yet).
- `pivot` is the point in the frame that sits at the target: `origin = pivot / frameSize`.
- A one-shot plays from frame 0 to the last frame and is destroyed. A loop (a portal, weather) has no natural end; the
  game stops it.

```ts
import { playFx, type FxSheet } from '@tohe/game-kit/phaser';

const crit: FxSheet = {
  key: 'fx-crit-hit',
  frames: 28,
  fps: 30,
  frameWidth: 216,
  frameHeight: 136,
  pivot: [84, 106],
  act: { windup: 0.55, hits: [{ t: 0.06, freeze: 0.14, shake: 0.18, amp: 2, push: 2.8 }] },
};

const fx = playFx(scene, crit, {
  x: target.x,
  y: target.y,
  flip: true,
  scale: 2,
  onHit: (hit) => board.onImpact(hit), // freeze/shake/push are the game's call
});
```

- `fx.done` resolves at the end or after `fx.stop()`.
- `reducedMotion` is the game's setting: the player still reports hits; the game skips the shake.
- A dead card's shatter, a skill cut-in and the hit effect are separate views; the battle logic never waits for them.

## Exporting from pixelfx

[pixelfx](https://github.com/patch-gg/pixelfx) is MIT (code and effects). Export only the effects a game needs, and
prefer short ones; the measured sizes are in
[R-08](../../plans/idle-card-rpg/research/R-08-pixel-fx.md).

```sh
git clone --depth 1 https://github.com/patch-gg/pixelfx.git
cd pixelfx
node tools/render.mjs impacts/crit-hit melee/sword-slash --sheet --out ../fx
```

- The PNG is the spritesheet; the JSON has frame rects, `meta.pixelfx.fps`, `pivot` and `act`.
- Trim long effects to the first 24–40 frames; do not ship a 200-frame move as a hit.
- Pre-bake palette variants (one sheet per element) at export time; do not recolor per frame on the phone.
- Credit Patch and Hugo Duprez in the game's `studio/credits.json`; **do not use the Patch Pixel font** (it is not
  under the MIT licence) — use Be Vietnam Pro for UI.
- The Studio accepts MIT; the pack is a `spritesheet` with a `source` and a licence.

## What the game does with a hit

The `act` hit is feedback, not damage. The battle logic has already resolved the damage; the view uses the hit to:

- freeze the board for `freeze` seconds (40–60 ms for a normal hit);
- shake by `amp` pixels for `shake` seconds (skip when reduced motion);
- push the target by `push` pixels and spring back;
- show the damage number and the card flash.

A game that does not want the kit's timing can pass `onHit` and ignore it; the sheet still plays.

## Tests

Pure timing (`fxTimeline`, `fxOrigin`) is tested without Phaser; `playFx` is tested with a fake scene for the frame
steps, the hit callback, the finish and `stop()`. A game's conformance is the real check: the effect must live in its
build and make no request outside the game's folder.
