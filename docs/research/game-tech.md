---
title: Game technology research
description: Which engine and building blocks Tò He games use, why, and the evidence behind the choice.
sidebar:
  order: 1
---

Question (owner, 2026-10-13): *one stable, good-looking technical approach for Merge Block that the same way of
working can carry to other genres — block blast, tetris, mini farms, light RPGs — with real investment in
game feel.* Decision: [ADR 0012](../decisions/0012-phaser-and-the-game-kit.md).

## Requirements

| # | Requirement | Why |
| --- | --- | --- |
| R1 | Stable, maintained, permissive licence | Games live for years; the repo is public |
| R2 | Covers puzzle **and** world-based genres (tilemaps, cameras, sprites, physics) | One way of working for every game |
| R3 | Polished feel: tweens/timelines, particles, camera shake, crisp text on phones | The owner asked for it explicitly |
| R4 | AI-friendly: agents write correct code for it without hand-holding | Most games will be written by agents |
| R5 | Fits the Game Contract: static build, our CSP (no inline scripts, no network), runs in a sandboxed iframe | Platform rule |
| R6 | Reasonable size on phones | Kids on mobile data, but the build is cached once |

## Candidates

| | Kind | Licence | Genres out of the box | Notes |
| --- | --- | --- | --- | --- |
| **Phaser 4.2** | Full 2D engine | MIT | Scenes, tweens + timelines, particles, cameras & FX, input incl. drag, tilemaps (Tiled), arcade & Matter physics, sound, loader, scale manager | v4 shipped April 2026 with a rewritten WebGL renderer (render nodes, context-loss recovery); API kept close to v3 — 8 years of examples and AI training data still apply |
| PixiJS 8.22 | 2D renderer | MIT | Rendering, events, text; everything else is other libraries (tilemap, sound, particles, viewport, layout) | Mature since 2024, smaller, crisp by default (`resolution` + `autoDensity`); v8 broke many v7 APIs that agents still write |
| Canvas 2D (own code) | Browser API | — | Nothing | Tiny and never changes; every system (tweens, particles, scenes) is ours to build — fine for `hello`, too much for real games |
| Kaplay | Beginner engine | MIT | Simple scenes, components | Great DX, slowest in sprite benchmarks |
| Excalibur | TS-first engine | BSD | Scenes, actors, physics | Smaller community and ecosystem |
| Defold / Cocos Creator | Editor-based engines | Source-available / custom | Everything | Editor workflows and their own languages/tooling; poor fit for agents writing TypeScript in a monorepo |
| Godot 4 web export | Engine export | MIT | Everything | Already allowed by the contract for big games; multi-MB builds, slow start for small games |

Supporting libraries considered: **GSAP** (excellent timelines, free since 2025 but proprietary licence that
Webflow may amend — not needed with Phaser's tweens), **Motion** (MIT, DOM-oriented), **tween.js** (MIT, minimal),
**Howler** (unmaintained; Web Audio directly is enough).

## Evidence gathered

**Bundle size** (Vite 8 production build, minified, gzip −9, measured 2026-10-13):

| Build | Minified | Gzip |
| --- | --- | --- |
| Phaser 4.2.1 (whole engine; it does not tree-shake) | 1,374 KB | **344 KB** |
| PixiJS 8.22 + GSAP, all renderer chunks (upper bound) | — | ~180 KB |
| GSAP / Motion / tween.js alone | — | 27 / 21 / 3.5 KB |

344 KB is about a second on a slow phone connection, once: builds are immutable and cached for a year.

**Crisp rendering on phones** — the biggest practical risk with Phaser, which has no global `resolution` setting.
Experiment on a DPR 3 phone viewport, number tiles "2 … 2048":

- *Default setup* (canvas at CSS pixels): visibly soft edges, small text smeared.
- *Device-pixel setup* (canvas = CSS size × DPR, `scale.zoom = 1 / DPR`, camera zoom = DPR, `Text.setResolution(DPR)`):
  sharp at 1170 × 1200 device pixels for a 390 × 400 CSS area.

So crispness is achievable but must be done right once — it goes into the kit (`createGame`), not into each game.

**Rendering speed**: third-party sprite benchmarks put Phaser and PixiJS close (43 vs 47 FPS at 10 000 moving
sprites on a 2023 laptop). Casual games draw dozens to a few hundred objects; neither is a bottleneck.

**Stability**: Phaser 4.2.1 (July 2026) was a bug-fix release (stencil, ESM build, tween delays, scale manager).
The v3 → v4 changes are in pipelines/FX/masks/lighting; sprites, text, tweens, input, cameras, tilemaps, sound and
scenes are unchanged — the parts casual games use.

## Decision in short

**Phaser 4 is the default engine for Tò He games**, wrapped by a small **`@tohe/game-kit`** that does the parts every
game must get right the same way. Canvas 2D (like `hello`) remains fine for tiny games; Godot remains allowed for
big ones (ADR 0001).

Why not PixiJS, which is lighter and crisp by default: it covers R3 but not R2 — a farm or RPG would need a
tilemap, camera, sound and particle library glued together and maintained by us, and agents keep writing v7 code
for it. Phaser trades ~160 KB for having all of that in one well-known API.

## The way every game is built

```text
games/<id>/
├── SPEC.md          rules, screens, invariants (reviewed first)
├── src/logic.ts     pure rules: state + action → new state + EVENTS
├── src/logic.test.ts  rules + random-play bot (fast-check) checking the invariants
├── src/view.ts      Phaser scene: replays events as animations (tweens, particles, sound)
└── src/main.ts      wiring: SDK session, kit game, input, save/score
```

1. **Logic emits events, the view animates them.** `drop(state, column)` returns the new state *and* what happened
   (`land`, `merge`, `fall`, `gameOver`…). Tests read the events; the view turns each into a short animation. The
   view never decides rules, so the rules are testable and the animation can be polished without risk.
2. **All randomness is in the state** (a seeded PRNG state saved with the game), so a save restores the exact game
   and a seed + list of moves replays it.
3. **Save after every move** (the SDK's `save`), resume on open — children leave mid-game all the time.
4. **Juice in tiers** (small / medium / large feedback), capped so it stays readable; motion reduced when
   `prefers-reduced-motion` is set.

## What the kit provides (`packages/game-kit`)

| Module | Purpose |
| --- | --- |
| `createGame` | Phaser game at device pixels (crisp), fills its parent, re-lays out on resize/rotation, pauses the scene and its tweens on the SDK's `pause`, no Phaser audio or banner |
| `sfx` | Synthesised sounds (Web Audio, no files): `pop`, `drop`, `merge(level)`, `combo(n)`, `error`, `fanfare`; unlocked on the first touch (iOS); respects `muted` |
| `haptics` | `tap` / `bump` / `success` via `navigator.vibrate` where supported (Android); silent elsewhere |
| `juice` | Phaser helpers: `popIn`, `squash`, `floatText`, `burst` (particles), `shake` (tiered, motion-aware), `confetti` |
| `overlay` | DOM screens over the canvas with one kid-friendly style: intro/pause/game-over cards, buttons, a tutorial strip |
| `format` | Big numbers for children: `2048`, `4K`, `16K`, `1M` |

## Applying it to other genres

| Genre | Logic events | Phaser parts used |
| --- | --- | --- |
| Merge / drop (Merge Block) | land, merge, fall, chain | tweens, particles, text, input drag |
| Block blast | place, clear rows/cols, score | drag & drop with snapping preview, particles |
| Tetris-like | spawn, move, rotate, lock, clear | fixed-step update from logic, tweens for clears |
| Match-3 | swap, match, cascade | the same chain/fall machinery as Merge Block |
| Mini farm | plant, grow (time), harvest | tilemap, camera drag/zoom, timers from the platform (later) |
| RPG-lite | move, encounter, attack, loot | tilemaps, sprite animations, cameras, arcade physics |

## Sources

- Phaser 3 vs Phaser 4 (phaser.io, May 2026): <https://phaser.io/news/2026/05/phaser-3-vs-phaser-4>
- Phaser 4.2.1 release notes summary (gamedev.net): <https://gamedev.net/news/4825-phaser-v421-released/>
- PixiJS v8 launch and migration guide: <https://pixijs.com/blog/pixi-v8-launches>, <https://pixijs.com/8.x/guides/migrations/v8>
- JS game rendering benchmark: <https://github.com/Shirajuki/js-game-rendering-benchmark>
- Web game engine comparisons 2026: <https://app.cinevva.com/guides/web-game-engines-comparison>
- GSAP licence change: <https://webflow.com/blog/gsap-becomes-free>
- Game feel / juice: <https://www.wayline.io/learn/game-feel>, <https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/>
