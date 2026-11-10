# R-10 — UI/UX v2: a board that fits, reads and keeps up

Date: 2026-11-10 · Status: design for the v1.0.1 UI pass

The owner played v1.0.0 on production: the layout is slightly off and overlapping, and the game feels laggy. This
page records what was measured, what the genre does, and the design the next pass follows.

## What was measured (v1.0.0)

Device emulation in Chrome, headless, DPR 2, battle at ×3:

| Screen | Frame p50 | Frame p95 | Worst | Long tasks (6 s) |
|---|---|---|---|---|
| 320 × 568 | 49.9 ms | 66.7 ms | 183 ms | 19 (50–181 ms) |
| 360 × 640 | 50.0 ms | 66.7 ms | 167 ms | 100+ (50–173 ms) |
| 390 × 844 | 66.7 ms | 83.4 ms | 183 ms | 85 (60–192 ms) |

That is 12–20 fps in a software-rendered headless browser; a phone GPU is faster at pixels but not at the JavaScript and
texture work. The long tasks line up with card text updates and effect objects, not with the network.

Layout, from the DOM and the scene's fractions:

- The top strip is 56 px, the bottom controls 56 px and the dock 57 px, all **absolute over the canvas**. The enemy back
  row starts at 13% of the height. At 320 × 568 its card top is ~53 px, under the 56 px top strip: the first row is
  clipped by the HUD. At 360 × 640 the gap is 3 px.
- The board's rows are fixed fractions (13/22/31/56/65/74%) and the card height is `min(56, height·0.075)`: at 568 the
  card is 42.6 px high with 51 px between row centres, so rows are tight; the 44% clash line has no reserved height.
- The turn rail is one 9 px text line of six names; at 320 it can overflow or collide with the HUD. It is also the only
  place the player can read the order, and it changes every actor.
- The bottom controls are four text buttons; “Tự tung chiêu: bật” is the widest and leaves little room at 320.
- The dock uses letter tiles (`Đ`, `T`, `S`, `S`, `⋯`) instead of icons, and “Khác” hides the daily loop two taps deep.
- Card text is 10 px names and 8 px charge text; the charge text is rebuilt every tick.
- The canvas renders at DPR 3 on a DPR-3 phone: 390 × 844 CSS becomes 1170 × 2532 device pixels, 3 MP, for a card game
  whose art is 32 px.

## What the genre and the platform docs say

- **An idle game is checked, not played.** The HUD must be parsed in about three seconds, one-handed, in bed, in the
  dark. Keep ≤5 always-on information units; numbers are second-class to the place and the next action. (Teemo, *UX,
  UI & accessibility: designing a HUD for a 40-second visit*, 2026.)
- **Short wins feed long arcs.** Show the next short goal and the long arc at once; a number that matters earns screen
  space, not three taps. (Phtbyte, *Designing a Satisfying Idle Loop*, 2026; SAVA Meta, *Idle RPG retention*, 2026.)
- **First session: show the goal, one mechanic at a time, win early, then ask.** The first five minutes need a clear
  goal, a real win and a visible next step, not a wall of rules. (Jest, *FTUE guide*, 2026; Teemo, *onboarding*, 2026.)
- **Auto-battles are only fun if readable.** Strong silhouettes, clear hit feedback, restrained effects, numbers only
  when they matter; the player must be able to say why the fight went the way it did. (Bosslabstudio, *Phaser
  auto-battler*, 2026.)
- **Touch.** 48 px targets, 56 px for the primary one; labels under icons; a thumb-first bottom area. (WCAG 2.5.8,
  Apple HIG, Material; Teemo HUD.)
- **Text on canvas is a texture upload.** Every `Text.setText` redraws a canvas and uploads it to the GPU; use
  `BitmapText`/pre-drawn textures for values that change. (Phaser docs, *Text*; Glitchless, *Phaser performance*, 2026.)
- **Pixels are the first cost.** Do not multiply the canvas by `devicePixelRatio` for a pixel-art card game; choose a
  fixed/capped ratio and let CSS scale. Pool effects, cap particles, avoid camera shake, atlas images. (Glitchless;
  Phaser 4 shader guide; game-tech research in this repo.)
- **The repo's own rule**: a screen is a sticker, not a template; ink borders, hard shadows, no gradient/glow; text is
  Be Vietnam Pro; a control has a label, not an emoji; the board is the app. (`docs/conventions/voice-and-look.md`.)

## Design decisions

### 1. The stage is a column, not a stack of overlays

`#stage` becomes a flex column: **HUD → board canvas → controls → dock**. The canvas gets exactly the space between
the bars, so a card can never slide under the HUD, and the HUD can grow for a safe area or a longer word without
covering the board. The Phaser parent is the board div, so `kit.size()` is the board's size and the scene never needs
to know the HUD heights.

At 320 × 568 the board keeps ~380 px; six rows of 55–58 px cards fit with 7 px gaps. At 390 × 844 the cards reach 64 px.
If a landscape window is very short, the HUD/dock compact and the cards shrink; the board still never overlaps.

### 2. The HUD carries five things, no more

| Unit | Where |
|---|---|
| Menu | 40 px icon+label button, left |
| Stage / region | centre block, one tap opens the stage picker; a 2 px region-progress bar |
| Gold and shards | two compact chips, right (tap the shard chip opens Summon) |
| Turn order | a 26 px rail of six portrait tokens, the actor in gold |
| Battle result / state | the card over the board (already the shell's) |

Power/recommended power live in the stage picker, not on the board. Essence, pity and records live in their sheets.

### 3. Cards are one pre-drawn image plus two bars

The static card (background, rarity strip, portrait, name, element gem) is drawn once per unit, side, size and DPR with
`drawTexture`, then shown as one image. The dynamic parts are a 5 px HP bar, 3–4 charge pips and a highlight border.
No `Text` changes on a card during a battle. Names are 10–11 px, portraits 28–34 px, and the rarity/element are carried
by a coloured strip and a letter, never colour alone.

### 4. Effects are DOM, not new canvas text

Damage/heal numbers are a small pool of DOM nodes over the canvas, animated with CSS transform/opacity. The canvas
keeps the cards and the clash line; it no longer allocates a `Text` and a tween per hit. Crits shake the card, not the
camera; normal hits flash and nudge; the camera shakes only on a crit or an active skill, and `reduced motion` turns
even that off. SFX are throttled to one hit sound per ~50 ms.

### 5. Performance budget

- `maxDpr: 2` for this game (kit option; the kit's default stays 3 for other games).
- One portrait atlas for Phaser (44 frames in 256 × 192), individual PNGs stay for DOM sheets.
- No per-tick `Text` on the board; turn rail and cards update only when a value changes.
- DOM number pool capped at 10; one impact per 40 ms per board; no allocation in the tick path.
- Canvas is the board only (not the whole screen), so the HUD/dock cost no WebGL pixels.
- Sheets pause the scene (already) and animate in with CSS only.

Target on the same headless setup: p50 ≤ 20 ms (50 fps), no long task over 100 ms; on a real phone, 60 fps at ×3 with
`#perf`.

### 6. Retention and first-session

- **Visible next step**: the stage block shows `MÀN 1-1 · 1/12` and a progress bar; the stage picker shows recommended
  vs current power and the first-clear reward. The win card's primary action is the next stage.
- **Daily loop in one tap**: the dock's last item is **Hôm nay**, not “Khác”; a dot appears when a task, the journey,
  the expedition or a weekly reward is ready. Summon shows a dot when shards ≥ 100.
- **Upgrade visibility**: the primary control shows a dot when a star-up or gear upgrade is affordable; the team sheet
  says who can grow.
- **A first win in the first minute**: the how-to stays one card with four short lines; the first stage is short and
  winnable; the first clear pays the welcome pull.
- **No pressure**: no countdown, no streak loss, no “come back” guilt; the offline card is a summary, not a chore.

## Screens to rework

1. **Board**: HUD, card, turn rail, controls, dock, number layer.
2. **Sheets**: a grab handle and a sticky header; bottom-sheet motion; one accent action; the stage picker detail at the
   top; summon results with rarity and “mới”; daily tasks with honest disabled states.
3. **Onboarding**: shorter hints; the goal visible in the HUD; no new modal chain.

## What is explicitly not in this pass

- A new art style or new portraits; the 32 px set stays.
- Asset on-demand; the atlas and cap are enough for v1.0.1.
- PvP, leaderboards, accounts, notifications.
- New content or balance changes.

## Sources

- Teemo, *UX, UI & accessibility: designing a HUD for a 40-second visit* (2026).
- Teemo, *Onboarding & first session: the first hour* (2026).
- Phtbyte, *Designing a Satisfying Idle Loop* (2026); SAVA Meta, *Idle RPG: what drives retention* (2026).
- Bosslabstudio, *Building a boss-building battler with Phaser* (2026).
- Glitchless, *Phaser performance optimization* (2026); Phaser docs, *Text* and *Phaser 4 shader guide*.
- Jest, *A first-time user experience guide* (2026).
- `docs/conventions/voice-and-look.md`, `docs/architecture/theming.md`, `docs/research/game-tech.md`.

## Result (after the pass)

Same headless Chrome, DPR 2, battle at ×3, 6-second samples:

| Screen | Frame p50 before → after | Long tasks before → after |
|---|---|---|
| 320 × 568 | 49.9 → 16.7 ms | 19 → 2 |
| 360 × 640 | 50.0 → 33.3 ms | 100+ → 0 |
| 390 × 844 | 66.7 → 33.3 ms | 85 → 0 |

The canvas renders at `maxDpr: 1.25` (400 × 455 device pixels at 320 CSS, 488 × 800 at 390 CSS), the board no longer
paints a full-screen background image, card faces are textures, and no card `Text` changes during a battle. The
headless numbers are software-rendered and understate a phone GPU; the `#perf` readout on a real phone is the judge.
The layout test (`src/view-layout.test.ts`) proves the rows never overlap at 320 × 380, 360 × 452, 390 × 652 and
shorter canvases.

Screens inspected at 320 × 568, 360 × 640 and 390 × 844: board, HUD, turn rail, stage picker, codex, daily, team, hero,
gear and summon. No 4xx, no console errors, no page scroll.
