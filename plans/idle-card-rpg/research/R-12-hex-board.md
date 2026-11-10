# R-12 — Bàn lục giác 12 ô, đánh ngang: the main battle screen

Date: 2026-11-10 · Status: wireframe for the owner's review (no implementation yet)

Owner feedback after v1: the board should be **hexagons** (not pentagons), **12 cells per side**, seamless, with a
non-blocking loss/retry flow and auto always. This page is the current design; the wireframe is
[`wireframes/hex-board-v6.html`](../wireframes/hex-board-v6.html) — 3 frames at 390×844.

## Board: 6 columns × 4 rows = 24 flat-top hexes

- **12 cells per side** (3 columns × 4 lanes), 6 hero maximum, **6 open**. The open cells are the formation space;
  they never collapse a lane.
- **Flat-top hexes** (points left/right) point at the enemy and interlock into one continuous honeycomb:
  - 6 columns: left 3 (heroes), right 3 (enemies); columns overlap 25% of their width; even columns drop half a hex.
  - 4 rows: four lanes. **Columns** = front / mid / back; **lanes** are the vertical bands.
  - The seam between the sides is a **zigzag**; the centre marker sits on it.
- At 390 px: `--hw: 74px`, `--hh: 64px`; at 320 px: `--hw: 62px`, `--hh: 54px`. 24 hexes at these sizes fit the width
  and use the tall phone's height.
- **Boss**: one gold-rimmed hex with a crown (confirmed). A 2-cell boss is later.
- **Terrain**: 2 open cells per side in the wireframe (Đá +DEF, Lửa +ATK, Gió +SPD). Terrain is cheap: one data field,
  an icon and a stat check. Include it now; lane bonuses are the next cheap step, after the first playtest.
- **Lane identity** (later): top +CRIT, middle +HP, lower +ATK, fourth lane +DEF, or a per-region rotation. Keep the
  numbers small; front/mid/back remains the main axis.
- **Adjacency bonds** (later): bond pair on edge-sharing hexes gets +2% extra HP/ATK; a small link glyph.
- **Open cells** can also be **locked** by company level if we want a reveal; the wireframe shows all 12 open for the
  final-state review.

### Core change

`Column` grows from `0 | 1` to `0 | 1 | 2 | 3` (four lanes); `Row` stays front/mid/back. Stage generation, formation,
loadouts, save normalization and tests change together. A v1 save with columns 0/1 stays valid; columns 2/3 are new.
Max 6 deployed; 12 cells means six are empty/open.

## Cards: minimal on the board

A board hex contains:

- a circular portrait (26–30 px);
- a 3–4 px HP bar (hero green, enemy red);
- an element gem with a letter (L / N / Đ / G), never colour alone;
- charge pips (3–4 marks);
- an active gold ring (breathing in manual mode);
- a boss crown; dead = grey + dark veil.

No name/role/numbers. Tap a hero → the existing hero sheet; tap an enemy → a compact enemy sheet. Detail keeps name,
rarity, stars, role/element, stats, skills, gear, bond, blurb.

## Loss: a small popup, an automatic rewind, one basic resource

The owner wants the game to keep moving after a loss, with a popup and an automatic return to the start of the wave or
stage, and only a basic resource — not the normal/exclusive rewards.

Proposed rule:

```text
loss in wave 1  -> popup 1.2 s -> restart the stage at wave 1 (full team HP)
loss in wave 2+ -> popup 1.2 s -> restart the current wave at its start HP
win on retry    -> normal clear; first-clear only if the stage was never cleared before
loss again      -> auto stops; wall panel in the deck (Đổi đội · Nâng cấp · Đánh lại)
```

- **Popup** is a small card over the lower board/deck: `Đội ngã ở đợt 2 · Quay lại đầu đợt 2 sau 1s · +12 vàng ·
  không nhận thưởng màn`. It has a `Dừng` button; auto continues on its own.
- **Only one basic resource on the losing attempt**: gold (small, e.g. 10% of the stage's repeat gold). No shards, no
  gear, no first-clear, no normal loot. The retry is a fresh attempt, so a win on it gives normal rewards; the
  first-clear stays available until a clean win. If the owner wants the retry win to be gold-only too, that is a
  one-line rule change; the anti-farm guard is the small consolation and one auto retry.
- **One auto retry per stage attempt**, then the wall panel. Infinite retry would loop a weak team and hide the real
  answer (upgrade/formation). The player can still press `Đánh lại` manually.
- **Auto is always on** for story stages: no `Tự đi` toggle. `Dừng` pauses; after a win the board moves on at once. A
  boss/chapter gets a larger ribbon but still no blocking modal.
- The loss does **not** move the road marker; the retry is the same node. The wall (after the second loss) keeps the
  road visible.

## Win: no popup

- Clear ribbon in the feed: `✓ Màn 1-2 đã qua · +210 vàng · +6 mảnh → 1-3`.
- Road marker moves, HUD progress fills, next wave deals in after ~0.8 s.
- Auto always; `Dừng` is the only stop.
- Boss/chapter: a larger ribbon/chest inside the deck; no modal.

## The tall phone: a bottom command deck

| Tab | Content | When |
| --- | --- | --- |
| **Đường đi** (default) | 12-node road, next stage/power, 3-line feed | During auto |
| **Dự bị** | 6–12 roster chips, selected cell + terrain, `Lưu đội hình` | Formation mode |
| **Chiêu** | 3 active skill cards, target hint | Only when auto-cast is off |
| **Nhật ký** (optional) | Last 6–8 events, loot | For reading the fight |

- Road: 12 nodes; 4/8 elite, 12 boss; current pulses; cleared green; `● Tự động` is a status, not a toggle.
- Feed: newest first, clear ribbon on top; this is the auto-battler readability layer.
- Controls: `Tự` (auto-cast), speed, `Dừng`, `Nâng cấp`; dock: `Đội · Trang bị · Triệu hồi · Sổ tay · Hôm nay`.
- At 320×568 the deck shrinks to the active tab; feed becomes one line; no page scroll.

## Wireframe frames

1. **Giao chiến + tự động**: 6 heroes left, 6 enemies right on 12 hexes each, 6 open + terrain; road + ribbon + feed.
2. **Xếp đội**: selected open hex with terrain, ghosted enemy preview, bench, `Lưu`.
3. **Thua + tự quay lại**: small popup, auto rewind, +gold only; after a second loss the wall panel appears (noted).

## Implementation direction (after approval)

- **DOM/CSS honeycomb** is the recommended view:
  - 24 hexes, CSS `clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)`;
  - crisp portraits/text at any DPR, CSS transforms for lunge/flash, no canvas text;
  - drops Phaser (1.4 MB) from this game, removes WebGL context/DPR issues, and makes the build much smaller;
  - keep the pure core and the existing DOM number layer.
- **Alternative**: keep Phaser with pre-rendered hex textures; more code and pixels, no text upload if careful. The owner
  asked to prioritise performance/stability, so DOM/CSS is the default.
- **Layout**: 6 flex columns of 4 hexes; even columns offset half a cell; `view-layout` test at 320/360/390; the board
  must never overlap the HUD/deck.
- **Core**: `Column` 0–3; 4 lanes; stage generation and formation; save migration; tests.
- **Flow**: remove `ctx.gameOver` for story wins; `finish` writes save, moves road, restarts after 0.8 s. Loss opens the
  popup + rewind; second loss opens the wall panel. Formation pauses and opens `Dự bị`.
- **Performance**: DOM board, CSS-only numbers, one animation per card; target 60 fps at ×3 on a mid-range phone; use
  `#perf`. The build should be far under the 8 MB budget.

## Open questions

1. Terrain now (recommended) and lane bonuses later — confirm?
2. Loss: retry win normal rewards (recommended) or gold-only? First-clear only on a clean win — confirm?
3. One auto retry per attempt, then wall — or two?
4. Card on board: no name (recommended) or one 7 px line?
5. `Chiêu` tab: include now or after the first playtest?
6. DOM/CSS board (recommended) or keep Phaser?
7. Boss/chapter ribbon: larger but auto, or a 1.2 s pause?

## Supersedes

[R-11](R-11-pentagon-board.md) (pentagon cells) and the 9-cell version of this page; the owner chose **hexagons, 12
cells**, boss 1 cell, auto always, and a loss popup + auto rewind.
