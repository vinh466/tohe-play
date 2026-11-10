# R-11 — Bàn ngũ giác, đánh ngang: concept for the main battle screen

Date: 2026-11-10 · Status: wireframe for the owner's review (no implementation yet)

Question from the owner: the 6v6 top/bottom board works, but the main battle screen should be redesigned as a
**pentagon board**, heroes and enemies **left/right**, more cells than the six heroes, minimal board cards, and a
non-blocking auto-advance flow. The tall phone leaves room at the bottom for something useful.

Wireframe: [`wireframes/pentagon-board-v4.html`](../wireframes/pentagon-board-v4.html) — 3 frames at 390×844.

## Constraints

- Combat is **6 heroes vs 6 enemies**, three rows (front / mid / back) and a 30-round cap; the pure core is stable.
- Max **6 deployed heroes**, but the roster is 20; formation is a growth axis (company level, stars, gear, bonds).
- The screen is portrait, 320–430 CSS px wide. A 6-column board leaves cells ~45–58 px; board cards must be minimal.
- The game is idle: auto-advance and offline are the promise; a modal after every win breaks the loop.
- Performance is already “average” after v1.0.1; the new board must not add canvas text, full-screen fills or per-tick
  texture uploads.

## Geometry: 9 cells per side (3 × 3), not a full Cairo tiling

The board is **6 columns × 3 rows = 18 pentagon cells**: left 3 columns (heroes), right 3 columns (enemies).
Each side has **9 cells**, 6 occupied · 3 open.

- **Columns** = **front / mid / back** (nearest the centre clash first). This keeps the current row bonuses and
  targeting readable.
- **Rows** = **three lanes** (top / middle / bottom). A 9-cell side is a real formation choice: 6 heroes among 9 cells,
  with lane/terrain trade-offs.
- **Max 6** stays; the extra 3 cells are **open slots**, unlocked/used for placement, terrain, and later content. The
  board shows them faintly, so the player sees what is open without a tutorial.
- Exact **Cairo pentagonal tiling** is beautiful but not required: a 3 × 3 side of congruent pentagons with small gaps
  reads as a board, keeps hit areas simple, and scales down to 320 px. A Cairo-style interlock can be a later art polish.
  (Reference: the Cairo pentagonal tiling is the dual of the snub square tiling; it packs pentagons without gaps but
  complicates cell geometry and hit testing at this size.)
- **Boss**: one gold-rimmed pentagon with a crown, not a 2-cell footprint in v1; a 2-cell boss would be a later
  “large unit” mechanic.

### Why 9, not 12

12 cells/side (3 × 4 or 4 × 3) gives more placement but needs either a fourth row in combat or a fourth lane, plus a
full content rebalance. 9 cells is the smallest number that makes placement a choice beyond “fill every slot”, and it
maps cleanly onto the existing row/column model if `column` grows from 2 to 3 lanes. If the owner wants more openness
after playtest, 12 is the next step.

## Formation mechanics (the “open” part)

- **Open cells**: 3 per side; a faint pentagon with `+`, tap to place a hero from the bench. Empty cells never collapse
  a lane.
- **Terrain cells** (proposal, 1–2 per stage): Đá +10% DEF, Gió +8% SPD, Nước heal 5% between waves, Lửa +10% ATK.
  A cell shows a small icon; the hero standing there gets the tag. This makes placement matter without a new screen.
- **Lane identity** (proposal): top lane +5% CRIT, middle +8% HP, bottom +8% ATK. Keep it small; the row (front/mid/back)
  remains the main bonus.
- **Adjacency bonds** (proposal): a bond pair on edge-sharing pentagons gets +2% extra HP/ATK. The grid makes adjacency
  legible; a small link glyph appears between them.
- **Unlock by company level** (optional): start with 6 cells (2 lanes × 3 columns), unlock the third lane at company
  level 3. The wireframe shows all 9 open because the review is about the final board; the implementation can start with
  6 and reveal the third lane.
- **Enemy preview**: in formation mode the enemy side is ghosted, so the player can place against the actual wave.

## Cards: minimal on the board, detail in the sheet

A board card is a **pentagon cell** with:

- a circular **portrait** (24–30 px);
- a 3–4 px **HP bar** (hero green, enemy red);
- an **element gem** with a letter (L / N / Đ / G), never colour alone;
- **charge pips** (3–4 tiny marks);
- an **active ring** (gold, breathing in manual mode);
- a boss crown/notch; dead = grey + a dark veil.

No name, role or numbers on the board. Tap a hero → the existing hero sheet; tap an enemy → a compact enemy sheet
(portrait, role/element, HP, skills, lore). This keeps cells readable at 45 px and moves depth into the sheet.

The detail card keeps the full data: name, rarity, stars, role/element, stats, skills, gear, bond, blurb.

## Auto-advance: no blocking popup

State machine for the story road:

```text
battle ──win──▶ clear (0.8 s: ribbon + loot + node moves) ──▶ next battle
   │
   └──lose──▶ wall (auto off, panel at the bottom; board stays visible)

battle ──pause──▶ stop (resume later)
```

- **Clear ribbon** lives in the bottom feed: `✓ Màn 1-2 đã qua · +210 vàng · +6 mảnh → 1-3`. The road marker moves;
  the HUD progress bar fills; the next wave deals in. No overlay, no tap required.
- **Road strip** (12 nodes) is the visible progress; nodes 4/8 are elite, 12 is boss; the current node pulses; cleared
  nodes are green. The same strip is the fastest way to see “where am I”.
- **Auto toggle** (`Tự đi`) is on by default; off means the clear ribbon stays with a `Đi tiếp` chip. `Dừng` pauses the
  battle. The player never loses the board.
- **Loss**: auto stops; a **wall panel** in the bottom deck says what is short (`Thiếu 1.200 sức mạnh`) and gives
  `Đổi đội · Nâng cấp · Đánh lại`. No full-screen modal; the board and road stay visible.
- **Boss/chapter**: a larger ribbon and a chest, still inside the deck; no modal. The owner can decide whether a boss
  clear opens the stage picker.

## The tall phone: a bottom command deck

The board is 390×~360–420; the bottom is a **command deck** with tabs, so the extra height is useful and the player is
not staring at a huge empty card table.

| Tab | Content | When |
| --- | --- | --- |
| **Đường đi** (default) | 12-node road, next stage/recommended power, auto toggle | During auto/story |
| **Dự bị** | 6–9 roster chips, selected cell + terrain, `Lưu đội hình` | Formation mode; opens from HUD or the tab |
| **Chiêu** | 3 active skill cards for the current actors, target hint | Only when auto-cast is off (manual) |
| **Nhật ký** (optional) | Last 6–8 battle events, loot | For players who want to read the fight |

- The feed sits under the road in the **Đường đi** tab: 3 lines, newest first; clear ribbon on top. This is the
  “auto-battler readable” layer: who acted, what hit, what healed, what dropped.
- Controls (`Tự`, speed, `Dừng`, `Nâng cấp`) and the dock (`Đội · Trang bị · Triệu hồi · Sổ tay · Hôm nay`) stay below
  the deck; the deck is the new middle band.
- At 320×568, the deck shrinks to the active tab (road or bench), hides the feed to 1 line, and keeps the same order.

## Wireframe frames

1. **Giao chiến + tự đi**: 6 heroes left, 6 enemies right on 9 cells each, 3 open; bottom road + clear ribbon + feed;
   no popup.
2. **Xếp đội**: selected open cell with terrain, ghosted enemy preview, bench of owned heroes, `Lưu`.
3. **Tường (thua)**: auto stopped, bottom wall card with `Đổi đội / Nâng cấp / Đánh lại`, road still visible.

## Implementation direction (after approval)

- **Core**: extend `Column` from `0 | 1` to `0 | 1 | 2` (three lanes), keep `Row` front/mid/back. Update stage
  generation, formation sheet, loadouts, save normalization, tests. A v1 save with columns 0/1 stays valid.
- **View**: the pentagon board is a good fit for **DOM/CSS clip-path** rather than Phaser: 18 cells, crisp text/portraits
  at any DPR, CSS transform animations, no canvas text or texture uploads. Phaser is currently 1.4 MB and only used by the
  board; dropping it from this game is a real performance win. Keep the pure core and the DOM number layer.
  - If we keep Phaser: draw the pentagon background as a texture per size, cards as pre-drawn textures, no text; the
    layout is a 6×3 grid; similar to v1.0.1 but with pentagon masks. More code, more pixels.
- **Layout**: CSS grid 6 columns × 3 rows; cells `clip-path: polygon(50% 0, 100% 37%, 82% 100%, 18% 100%, 0 37%)`;
  lane labels; a centre clash line; a board ring/arena in the empty vertical space.
- **Performance budget**: DOM board, one portrait atlas or individual 32 px PNGs, no per-tick text, CSS-only damage
  numbers, one animation at a time per card. Target 60 fps at ×3 on a mid-range phone; use `#perf`.
- **Flow**: remove `ctx.gameOver` for story wins; keep it only for special modes if needed. The stage `finish` writes the
  save, updates the road, and restarts the board after a short delay; loss opens the wall panel in the deck.
- **State**: formation mode pauses the battle; the deck tab `Dự bị` is the same screen; closing returns to the road tab.

## Open questions for the owner

1. **9 cells/side** (3 × 3) or go straight to **12** (3 × 4)? 9 is the safer first step; 12 needs a fourth lane/row.
2. **Card text**: no name on the board (recommended), or one 7 px name line?
3. **Terrain/lane bonuses**: include in this pass, or keep the 9 cells plain first?
4. **Bottom deck**: road + feed (recommended), or command hand, or always-visible bench?
5. **Boss**: one gold cell, or a 2-cell boss later?
6. **Win**: 0.8 s auto-advance always, or a `Tự đi` toggle with a short pause for boss/chapter?
7. **Implementation**: DOM/CSS board (recommended for performance) or keep Phaser?

## What this is not

- Not a content or balance pass; 6v6 and the 48 stages stay.
- Not a new home/camp; the board remains the app.
- Not a Cairo-tiling art project yet; the 3 × 3 pentagon board is the playable version, the tiling is polish.
