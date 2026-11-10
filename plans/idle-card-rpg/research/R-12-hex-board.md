# R-12 — Bàn lục giác, đánh ngang: the main battle screen

Date: 2026-11-10 · Status: wireframe for the owner's review (no implementation yet)

The owner corrected R-11: the cells are **hexagons**, not pentagons. The goal is the same: a **seamless honeycomb
board**, heroes and enemies **left/right**, more cells than the six heroes, minimal board cards, a non-blocking
auto-advance flow, and a useful command deck in the tall space below.

Wireframe: [`wireframes/hex-board-v5.html`](../wireframes/hex-board-v5.html) — 3 frames at 390×844.

## Board: flat-top hexagons, 6 columns × 3 rows

- **6 columns × 3 rows = 18 hexes**, left 3 columns (heroes), right 3 columns (enemies).
- Each side has **9 cells**, 6 occupied · 3 open. Max 6 heroes never changes; the extra cells make placement a choice.
- **Flat-top hexes** (points left/right) are the right orientation: they point at the enemy, and the columns interlock
  into one continuous honeycomb. Adjacent columns are offset by half a hex; columns overlap by 25% of their width, so
  there is no visible gutter.
- **Columns** = front / mid / back (nearest the centre clash first). **Rows** = three lanes (top / middle / bottom).
  This keeps the current front/mid/back bonuses and targeting, and adds a lane axis.
- The seam between the two sides is a **zigzag**, not a straight line; the centre marker sits on it. That is the visual
  cue that both sides share one board.
- **Open cells** are faint hexes with `+`; a cell can carry **terrain** (Đá +DEF, Gió +SPD, Nước heal, Lửa +ATK). The
  open cells never collapse a lane.
- **Boss** is one gold-rimmed hex with a crown; a 2-cell boss is a later “large unit” idea.

### Why 6 × 3 and not a 19-cell hexagon

A radius-2 hexagon (19 cells: 3/4/5/4/3) is beautiful but splits 7/5/7 across left/centre/right, not 9/9; the centre
column would need a new neutral-zone mechanic. 6 × 3 keeps 9/side, a straight left/right split, and the current 3-row
combat. If we want more cells after playtest, 6 × 4 (24 cells, 12/side) is the next step; it needs a fourth lane or a
fourth row in combat.

### Hex geometry in CSS

Flat-top hex shape:

```css
clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
```

- Cell width `--hw`, height `--hh = 0.866 × --hw`.
- Columns: width `--hw`, `margin-left: -0.25 × --hw` between columns (the honeycomb overlap).
- Even columns: `margin-top: 0.5 × --hh` so adjacent columns interlock.
- At 390 px: `--hw: 74px`, `--hh: 64px`; at 320 px: `--hw: 62px`, `--hh: 54px`.
- The board is a flex row of 6 columns, each a flex column of 3 hexes. The visual is seamless; hit areas are the hex
  polygons (CSS `clip-path` or an SVG/polygon hit test).

The standard reference for hex grids is Red Blob Games, *Hexagonal Grids* (redblobgames.com/grids/hexagons/).

## Cards: minimal on the board

A board hex contains:

- a circular **portrait** (26–30 px);
- a 3–4 px **HP bar** (hero green, enemy red);
- an **element gem** with a letter (L / N / Đ / G), never colour alone;
- **charge pips** (3–4 tiny marks);
- an **active ring** (gold, breathing in manual mode);
- a boss crown/notch; dead = grey + a dark veil.

No name, role or numbers on the board. Tap a hero → the existing hero sheet; tap an enemy → a compact enemy sheet
(portrait, role/element, HP, skills, lore). The detail card keeps name, rarity, stars, role/element, stats, skills,
gear, bond and blurb. The hex frame replaces the old rectangular card; the portrait is not clipped by the hex corners.

## Formation mechanics

- **Open cells**: 3 per side, tap to place a hero from the bench; empty cells are visible but faint.
- **Terrain cells** (proposal, 1–2 per stage): a small icon and a tag on the hero standing there. Placement becomes a
  trade-off, not just filling slots.
- **Lane identity** (proposal): top lane +5% CRIT, middle +8% HP, bottom +8% ATK. Keep the numbers small; front/mid/back
  remains the main axis.
- **Adjacency bonds** (proposal): a bond pair on edge-sharing hexes gets +2% extra HP/ATK; a small link glyph between
  them.
- **Unlock by company level** (optional): start with 6 cells (2 lanes × 3 columns), unlock the third lane at company
  level 3. The wireframe shows all 9 open for the final-state review.
- **Enemy preview**: in formation mode the enemy side is ghosted, so the player places against the actual wave.

## Auto-advance: no blocking popup

```text
battle ──win──▶ clear (0.8 s: ribbon + loot + node moves) ──▶ next battle
   │
   └──lose──▶ wall (auto off, panel at the bottom; board stays visible)

battle ──pause──▶ stop (resume later)
```

- **Clear ribbon** in the bottom feed: `✓ Màn 1-2 đã qua · +210 vàng · +6 mảnh → 1-3`. The road marker moves, the HUD
  progress bar fills, the next wave deals in. No overlay, no tap.
- **Road strip**: 12 nodes; nodes 4/8 are elite, 12 is boss; current pulses, cleared are green. This is the visible
  progress.
- **Auto toggle** (`Tự đi`) defaults on; off leaves the ribbon with `Đi tiếp`. `Dừng` pauses.
- **Loss**: a **wall panel** in the bottom deck says what is short (`Thiếu 1.200 sức mạnh`) and offers
  `Đổi đội · Nâng cấp · Đánh lại`. No modal; board and road stay.
- **Boss/chapter**: a larger ribbon/chest inside the deck; still no modal.

## The tall phone: a bottom command deck

| Tab | Content | When |
| --- | --- | --- |
| **Đường đi** (default) | 12-node road, next stage/recommended power, auto toggle | During auto/story |
| **Dự bị** | 6–9 roster chips, selected cell + terrain, `Lưu đội hình` | Formation mode |
| **Chiêu** | 3 active skill cards for the current actors, target hint | Only when auto-cast is off |
| **Nhật ký** (optional) | Last 6–8 events, loot | For players who want the fight in words |

- Feed sits under the road in **Đường đi**: 3 lines, newest first; the clear ribbon is the top line.
- Controls (`Tự`, speed, `Dừng`, `Nâng cấp`) and the dock (`Đội · Trang bị · Triệu hồi · Sổ tay · Hôm nay`) stay below
  the deck.
- At 320×568 the deck shrinks to the active tab; the feed becomes one line; no page scroll.

## Wireframe frames

1. **Giao chiến + tự đi**: 6 heroes left, 6 enemies right on 9 hexes each, 3 open; road + clear ribbon + feed.
2. **Xếp đội**: selected open hex with terrain, ghosted enemy preview, bench, `Lưu`.
3. **Tường (thua)**: auto stopped, bottom wall card with `Đổi đội / Nâng cấp / Đánh lại`, road still visible.

## Implementation direction (after approval)

- **Core**: extend `Column` from `0 | 1` to `0 | 1 | 2` (three lanes), keep `Row` front/mid/back. Update stage
  generation, formation sheet, loadouts, save normalization and tests. A v1 save with columns 0/1 stays valid.
- **View**: a **DOM/CSS honeycomb** is the natural fit: 18 hexes, crisp portraits/text at any DPR, CSS transforms for
  lunge/flash, no canvas text. Phaser is 1.4 MB and only used by the board; dropping it from this game is a real
  performance win. Keep the pure core and the DOM number layer.
  - Alternative: keep Phaser and draw 18 pre-rendered hex textures; more pixels and code, no text upload if careful.
- **Layout**: CSS flex columns as above; `clip-path` hexes; a 6-column board; `view-layout` test for 320/360/390.
- **Flow**: remove `ctx.gameOver` for story wins; the set `finish` writes the save, moves the road, restarts the board
  after ~0.8 s. Loss opens the wall panel; formation pauses the battle and opens the `Dự bị` tab.
- **Performance budget**: DOM hexes, 32 px portraits, CSS-only numbers, one animation per card; target 60 fps at ×3 on
  a mid-range phone, measured with `#perf`.

## Open questions

1. **9 cells/side** (6×3) or **12** (6×4)?
2. Card on board: no name (recommended) or one 7 px line?
3. Terrain/lane bonuses in this pass, or keep the hexes plain first?
4. Bottom deck: road + feed + `Dự bị` (recommended), or command hand, or always-visible bench?
5. Boss: one gold hex, or a 2-cell boss later?
6. Win: 0.8 s auto always, or a short pause at boss/chapter?
7. DOM/CSS honeycomb (recommended) or keep Phaser?

## Supersedes

[R-11](R-11-pentagon-board.md) explored the same flow with pentagon cells; the owner corrected the shape to hexagons.
R-11's notes on the command deck and auto-advance still apply.
