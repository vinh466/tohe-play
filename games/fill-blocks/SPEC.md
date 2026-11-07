# Lấp Ô (`fill-blocks`) — spec

> **Status: approved for build.** The owner approved the plan's recommended direction on 2026-11-08 ("ok tốt nha,
> làm đi"). This spec is the source of truth for the first release: the core, endless, a 18-level journey, a local
> daily, mastery ranks, stats, achievements and board skins. Ranked runs and a platform daily board are later.

Place colourful block shapes on an 8 × 8 board; a full row or column clears and scores. The calm version of
"Block Blast" / "1010!": no timer, no rotation, tap-to-place for small children, and a long journey that never
pressures the player. No ads, purchases, energy, currency or punishing streaks.

## Board and pieces

- **8 × 8 board.** A cell is empty or holds one of eight colours. A few later levels may mark cells as blocked
  (a hole in the board); a row/column is full when every non-blocked cell is filled.
- **The tray** under the board offers **3 pieces**. Placed pieces leave the tray; when it is empty, three new ones
  are drawn.
- **Pieces** are fixed shapes (no rotation) from a set of 27, in eight colours. The shape is the identity; a colour
  is shared by several shapes. Sizes 1–5 and 3 × 3:
  - 1 × 1; 1 × 2, 2 × 1; 1 × 3, 3 × 1; 2 × 2; four small L (3 cells);
  - 1 × 4, 4 × 1; 1 × 5, 5 × 1; 3 × 3;
  - four big L (4 cells), four T, two S, two Z.
- **The bag** is weighted: small shapes dominate early; large shapes appear as the score grows. A fresh tray never
  holds more than one very large piece (5 cells or 3 × 3) in the first chapter. **Helpful draw**: while any shape of
  the set fits the board, a fresh tray has at least one piece that fits. If no shape fits, the draw is normal and
  the run is stuck.

## A move

1. Pick a piece from the tray:
   - **drag** it — it lifts above the finger, so the finger never hides the target;
   - **tap** it (it lifts and glows), then **tap a board cell** — the piece's bounding box top-left goes there. If
     that does not fit, the nearest fitting cell within one step is used; if none, the piece returns.
2. While aiming, a **ghost** shows the cells where it would land. If it fits nowhere, nothing is shown and letting
   go returns the piece (soft "nope").
3. **Placing** writes the piece's cells. Score **+1 per cell**.
4. **Clearing**: every row and every column that is now full clears, all at the same time (a cell in a full row and
   a full column clears once). A placement that clears **n** lines scores **10 × n × n × combo** before the perfect
   bonus: with combo ×1, one line gives 10, two give 40, three give 90.
5. **Combo**: a clear raises the multiplier by 1 (cap ×5); a placement that clears nothing lowers it by 1 (floor
   ×1). It never resets to 1 in one step. The HUD shows the meter.
6. **Perfect clear**: if the board is empty after a clear, add **300** and a fanfare; count it.
7. **Refill** the tray when it is empty.
8. **Rescue**: a run earns a **Đổi khay** at 1,000 points and at each perfect clear, holding at most **2**. It can
   be used only when no tray piece fits; it redraws the tray and decrements the count. No ads, no purchase.
9. **Undo**: one step per journey/daily level (not endless); the previous placement is restored. It is not saved
   across leaving the game.
10. **Hint**: after 8 seconds idle, one legal placement pulses; it can be turned off in Cài đặt.

## End

- **Endless**: the run ends when no tray piece fits and no rescue is left. The end card shows score, best, rank
  progress, **Chơi lại** and **Menu chính**.
- **Journey**: a level ends when all its goals are met, its **move limit** is reached, or it is stuck with no rescue.
  A level completes if its **primary goal** (the first goal) is met; the other goals give stars. The card shows the
  three goals, the stars, **Chơi lại**, **Màn tiếp** (when the next level is unlocked) and **Menu chính**.
- **Daily**: like a journey level, with a fixed seed and goals; one scored attempt per day. Its card has
  **Chơi lại** and **Menu chính** (there is no next level).

## The journey

- **3 chapters × 6 levels = 18** in this release. Chapters: **Giấy** (small pieces), **Mực** (mixed), **Gấc** (all).
- A level has a fixed seed, a piece-set profile, a move limit and three goals. The same seed gives the same pieces
  to every player; a retry is fair.
- **Goals** are icons + numbers: reach a score, clear N lines, clear 2+ lines in one move, keep the combo at N,
  make a perfect clear, finish the level. The first goal is the primary.
- **Stars**: 1 star for the primary goal, 1 for each of the other two. A level is complete at 1 star. Chapters 2
  and 3 unlock at **6** and **12** stars.
- No energy; replay any unlocked level. The next unplayed level is the **Tiếp tục** target.
- Levels are data in `src/content/levels.ts`; a validator (`pnpm --filter @tohe/game-fill-blocks simulate`) plays
  each with a bot and fails on an impossible level.

## Daily challenge

- One seed per day, from `session.seed` (`YYYYMMDD`), the same for everyone on that date.
- 3 goals and a 25-move limit; one scored attempt per day. Practice is allowed but does not change the stamp.
- A **calendar** of stamps; a missed day never removes a stamp or breaks a streak.
- No server daily board in this release; the result is local and personal.

## Mastery, stats and achievements

- **Mastery rank** from personal best: 10 ranks, `0, 100, 250, 500, 1000, 1750, 2750, 4000, 6000, 9000`. No decay.
  The title and end card show the rank and the next threshold.
- **Stats**: games, total score, total lines, best combo, perfect clears, journey stars.
- **15 achievements**: first line, 2/3/4-line clear, ×3/×5 combo, first perfect clear, 1,000/5,000 points,
  100/500 lines, first journey chapter, all chapter 1 stars, 7 different days played. Achievements are in-game only.
- **Board skins** (6): Giấy, Mực, Gấc, Nghệ, Lá, Đêm. They change the board frame/background, not the piece
  colours. Unlocked by journey stars and mastery rank; no purchase.
- **Palette**: the default paper/ink eight colours; a **Dễ phân biệt** palette (Okabe–Ito) in Cài đặt.

## Screens

The kit's shell (ADR 0018–0020) with two stages. The game brings its content.

1. **Title**: logo, best/rank, journey progress, **Chơi tự do** (or **Chơi tiếp**), **Hành trình**, **Ván mới** when
   a game is in progress; tools: Hôm nay, Thành tích, Cài đặt, Cách chơi, Xếp hạng. The daily is a tool, not a
   pressure card.
2. **Journey** (a full screen of the shell): 3 chapter pages; 6 level stamps per chapter; stars; a selected level's
   goals and **Chơi**; **Tiếp tục** to the next unplayed; locked levels say why.
3. **Daily** (a full screen): today's goals, **Chơi hôm nay** or **Đã đóng dấu**, a 28-day calendar of stamps.
4. **Stats / Achievements** (full screens): the totals, rank progress and the 15 stamps.
5. **How to play** (before the first **Chơi**, then from **Cách chơi**): three picture hints — drag or tap a piece
   onto the board; a full row/column clears; clear again and again for a combo. A first move pulses.
6. **Playing**: the kit's HUD (Menu, score, best); a combo meter/goal chip in the middle; the board; the tray;
   **Đổi khay** when stuck and a rescue is left; hint after idle. The board, tray and controls are DOM buttons with
   ARIA labels; the board is a grid of 64 cells.
7. **Game over**: the board dims; the end card with score/best/rank (endless), stars/goals (journey/daily), the
   actions above.
8. **Cài đặt**: sound, **Màu sắc** (paper / Dễ phân biệt), **Bàn** (unlocked skins), **Gợi ý** (on/off), reduced
   motion follows the system.

## Feel (juice), in tiers

| Event | Feedback |
| --- | --- |
| Pick up | Piece lifts and grows slightly, soft "pop" |
| Place | Cells drop in with a small squash, "tock", light haptic |
| Clear 1 line | Cells pop out along the line in their colours, sparkle, "+n" floats up |
| Clear 2+ lines | As above, with a rising pitch and a bigger "+n" |
| Combo ≥ 2 | "Combo ×n!" banner, brighter and higher per step |
| Perfect clear | Confetti + fanfare, bonus 300 |
| Record | Confetti + fanfare |
| Doesn't fit | Piece slides back, soft "nope" |
| Stuck with rescue | The rescue button pulses; the end card waits until it is used or the player ends |

Every animation is short (under half a second) and never blocks the next pick for more than a beat; with reduced
motion, clears are a flash and confetti is off.

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013):

- **Board**: cream paper in light, warm charcoal in dark; blocked cells are a darker hole.
- **Pieces**: eight colours, readable on both boards; the contrast palette is a setting.
- **HUD and cards**: the design tokens, through the kit.
- Every text is at least 4.5:1; UI/non-text 3:1. Colour is never the only channel: shape, star count and text.

## Technology

**DOM + CSS + `@tohe/game-kit`**, not Phaser. The game is a grid of 64 buttons and three piece buttons: DOM gives
precise touch targets, native focus/ARIA, cheap CSS animations and instant play with no engine download (the game
is a few hundred KB, not 1.5 MB). It uses the kit's `createShell`, `createHud`, `overlay`, `sfx`, `haptics`,
`formatScore`, `followTheme`, `prefersReducedMotion` and `defineCatalog`. The board and pieces are drawn with CSS;
there is no asset pack and no network request outside the game's folder.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | After every placement: the game state, best, journey stars, daily stamps, stats, achievements, settings. The last game in progress resumes on open. |
| `scores` | A live run (ADR 0014): `session.run(id).update(score)` after scoring moves, `finish(score)` at the end or when a new game replaces it. Journey levels use a run of their own; the household board shows the best. |
| `shell` | The two stages and the shell screens. |
| settings | `muted`, `theme`; the game's own settings live in the save. |
| seed | A new endless game mixes the hub's daily seed with a run counter; a journey/daily game uses its fixed seed. |
| ranked | **Not in this release.** |

`minAge`: **3** (tap-to-place, no reading required; journey goals have icons and numbers). `orientation`: **portrait**.

## Invariants (checked by the random-play bot)

- A placement never overlaps a filled or blocked cell and never leaves the board.
- After a placement no row or column is full; every line that was full is cleared.
- The score never decreases; it equals the sum of the rules above.
- The tray holds 1–3 pieces while the game runs; it is refilled exactly when it becomes empty.
- Helpful draw: whenever some shape fits a fresh tray, at least one piece fits.
- The combo is an integer 1–5; a clear raises it by 1 (cap 5), a non-clear lowers it by 1 (floor 1).
- The run is over exactly when no tray piece fits and no rescue is left; a journey/daily level also ends at its move
  limit.
- A save restores an identical game: replaying the same moves from a restored state gives the same result.
- A journey level with a fixed seed gives the same tray sequence on every device.

## Public pages

`/games/fill-blocks/` and `/en/games/fill-blocks/` from `page/vi.md`, `page/en.md`, `page/facts.json` and the OG
images, as every game.

## Open questions

1. The exact 18 level goals and seeds are tuned by the validator before release; the first table is a draft.
2. The daily needs a platform board later (PB-06); this release is local.
3. Ranked endless is V4; it needs a simulation of the final rules and a `maxMoves` decision.
