# R-13 — Rendering technology for the hex board: DOM/CSS, Pixi or Phaser?

Date: 2026-11-10 · Status: **implemented in v1.1.0** — DOM/CSS was chosen; Phaser is gone

The 12-cell hex board is a **turn-based card UI**, not a real-time sprite game: 24 hexes, 12 units, a handful of bars,
numbers and CSS animations. This page compares the renderers that fit it and recommends one, with a measured spike.

- Spike: [`tech-spike/dom-board.html`](tech-spike/dom-board.html) — open it; it auto-runs at ×3 with a perf readout.
- Former game: Phaser 4 + `@tohe/game-kit/phaser`, 1.4 MB stage chunk, WebGL at DPR 1.25. The shipped DOM board is 331 KB total.

## What the spike measured

Same headless Chrome, DPR 2, 6-second samples, spike at 24 hexes / 12 units / 12 empty cells / ~170 DOM numbers:

| Screen | DOM spike p50 | DOM spike p95 | Long tasks | Phaser v1.0.1 p50 |
|---|---|---|---|---|
| 320×568 | **16.7 ms** | 16.7 ms | 0 | 16.7 ms |
| 360×640 | **16.7 ms** | 16.8 ms | 0 | 33.3 ms |
| 390×844 | **16.7 ms** | 16.7 ms | 0 | 33.3 ms |

The spike is 25.7 KB of HTML/CSS/JS (inline, no engine), 377 DOM nodes, and no 60 fps game loop: a `setInterval` runs
the turn every 110 ms; CSS animations handle the hit and the floating number. It did not drop a frame while ~170
numbers/6 s were created from a pool.

The headless Phaser numbers are software-rendered and understate a phone GPU, but the direction is clear: the DOM
version has no WebGL context, no canvas texture uploads, no DPR scaling and no engine loop.

## The options

| | Phaser 4 (today) | PixiJS 8 | DOM/CSS (recommended) | Canvas 2D |
|---|---|---|---|---|
| Bundle | 1.4 MB stage / 376 KB gzip | 840 KB full / 237 KB gzip | ~30 KB gzip + portraits | tiny |
| Rendering | WebGL, 60 fps loop | WebGL, 60 fps loop | browser layout/compositor | CPU raster |
| Text | canvas textures, re-upload on change | canvas/BitmapText | native, crisp at any DPR | manual, DPR |
| Hex cells | masks/textures | masks | `clip-path` | path fill |
| Animation | tweens + camera | ticker/tweens | CSS/WAAPI on transform/opacity | manual rAF |
| Accessibility | poor (canvas) | poor | native buttons/labels | poor |
| Failure modes | WebGL context, DPR, black canvas | same | layout/paint bugs only | text blur, manual layout |
| Fit for 24 cards | overkill | overkill | **exact** | possible but worse UI |

- **Phaser** is the current board. It is reliable, but 1.4 MB and a 60 fps WebGL loop are unnecessary for a turn-based
  card UI; the v1.0.1 work removed the worst text/DPR costs, not the engine.
- **PixiJS 8** is a good engine, smaller than Phaser, with strong sprite batching. It still brings WebGL/context/DPR
  concerns and canvas text, and we do not need thousands of sprites or shaders. It would be the choice if the board
  later grows particles/tilemaps.
- **DOM/CSS** is the natural fit: 24 hexes are 24 elements, portraits are `<img>`, HP is a CSS variable, damage numbers
  are a pooled layer, and animations are compositor-friendly `transform`/`opacity`. It is crisp at DPR 3, accessible,
  testable with Playwright/axe, and has no engine to boot.
- **Canvas 2D** is small but loses crisp text and native hit areas; it would be a downgrade for this UI.
- **WebGPU / HTML-in-Canvas** (Chrome 157, Oct 2026) are interesting but not a cross-browser/stable baseline for a family
  PWA; do not build the board on them.

## Recommendation: DOM/CSS board, drop Phaser from this game

The game already keeps the pure battle core and the DOM number layer. The board is the only Phaser user. Replacing it
with a small DOM view:

- **removes Phaser** from the game build (1.4 MB, 376 KB gzip);
- removes WebGL context loss, DPR and canvas text from the failure surface;
- keeps the kit's shell, SFX, haptics, overlays and tokens;
- makes the board testable and accessible (buttons with labels, `aria` for HP/charge/dead);
- makes the 6×4 honeycomb trivial: flex columns + `clip-path`; 24 cells; no masks/textures.

### Architecture

```text
core/ (pure)  ── step(state) ──▶ board-view (DOM)
   │                               ├─ 24 hex cells, created once
   │                               ├─ HP/pips/active only on change
   │                               ├─ turn rail (6 portraits)
   │                               └─ DOM number pool + CSS animation
   └─ stage.ts: timer → step → view; save/road/modes
```

- **No `requestAnimationFrame` loop for the game state.** A `setInterval`/`setTimeout` at the chosen speed runs a turn;
  CSS animates the feedback. The browser can idle between turns (battery).
- **One update per affected cell**: write the HP width and the pips only when they change; no `innerHTML` after the
  initial build. Damage numbers are 12 reused nodes with `animation` reset.
- **Compositor-only animation**: `transform`, `opacity`; never animate `left/top/width`.
- **Hex**: `clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)`; columns use negative margin 25%,
  even columns offset half a cell. `contain: layout paint` on the board; `will-change` only while a card animates.
- **Fallback**: if `clip-path` is missing, use a rounded rectangle; the game still works.
- **Testing**: `view-layout` pure test; Playwright screenshots at 320/360/390; conformance at 360×640; `#perf` on a
  real phone. Bundle target <150 KB gzip (excluding portraits).

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| CSS animation jank from too many simultaneous hits | one hit animation per card; 12-number pool; batch updates per turn |
| Hex hit areas | `clip-path` clips pointer events in modern browsers; test; fallback to the bounding box |
| Very old Safari/Chrome | CSS clip-path is supported for years; rounded-card fallback; no WebGL dependency |
| DOM size | 24 cells + ~12 numbers + HUD/deck ≈ 400 nodes, measured 377; trivial |
| Refactor cost | the board is one view module; the pure core, save, modes and sheets stay |
| Future heavy FX | add a small canvas overlay for particles only; do not bring a full engine back |

## What to decide

- **Use DOM/CSS as the board technology** (recommended) and drop Phaser from `games/van-du-ky`.
- Keep `@tohe/game-kit` for shell/SFX/haptics/tokens; no `createGame`.
- If the owner wants a separate technology, **PixiJS 8** is the fallback, but it is a heavier second choice for this
  card UI.

## Sources

- Spike file in this repo; measurements above.
- Phaser bundle/current cost: `docs/research/game-tech.md`; PixiJS 8.22 full bundle measured from its published dist
  (840,663 B minified / 237,380 B gzip).
- *SVG vs Canvas vs WebGL performance* (2026): DOM/CSS is efficient for UI-sized scenes; canvas/WebGL win at thousands
  of objects.
- *200FPS: CSS vs Canvas vs WebGL vs WebGPU* (2026): compositor-friendly `transform`/`opacity` CSS is the cheapest
  animation path; DOM preserves accessibility.
- *5 reasons to use DOM instead of Canvas for UI in HTML5 games*: static UI in DOM can improve performance; canvas is
  for gameplay sprites.
- Chrome for Developers, *HTML-in-Canvas* (Chrome 157, Oct 2026): future hybrid, not a baseline.
