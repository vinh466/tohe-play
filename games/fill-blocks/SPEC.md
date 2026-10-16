# Lấp Ô (`fill-blocks`) — spec

> **Status: draft for review.** No code yet: the owner reviews this spec first (`/new-game`).

Place colourful block shapes on a board; a full row or column clears and scores. The genre of "Block Blast" /
"1010!", made calm and friendly for children: no timer, no rotation, and a way to place blocks without dragging.

## Board and pieces

- **8 × 8 board.** Cells are empty or hold a block colour.
- **The tray** under the board offers **3 pieces**. Placed pieces leave the tray; when all three are placed, three
  new ones are drawn.
- **Pieces** are fixed shapes (no rotation) of 1 to 5 cells, from a set of about 20:
  - small: 1×1, 1×2, 2×1, 1×3, 3×1, the 2×2 square, small L corners;
  - large: 1×4, 4×1, 1×5, 5×1, the 3×3 square, big L shapes, T, S, Z.
  - Each shape has its own colour, the same in both themes.

## A move

1. The player picks a piece from the tray and puts it on the board, in either of two ways:
   - **drag** it: the piece lifts above the finger, so the finger never hides where it goes;
   - **tap** it (it lifts and glows), then **tap a board cell**: the piece's top-left cell goes there. This is for
     small children who cannot drag precisely.
2. While aiming, a **ghost** shows where it would land, snapped to the nearest cells where it fits. If it fits
   nowhere near the finger, nothing is shown, and letting go returns the piece to the tray (soft "nope" sound).
3. **Placing** writes the piece's cells to the board. Score **+1 per cell**.
4. **Clearing:** every row and every column that is now full clears, all at the same time (a cell in a full row and
   a full column clears once). Score per placement that clears **n** lines: **10 × n × n**. One line gives 10,
   two give 40, three give 90.
5. **Streak:** placements that clear one after another multiply the clear score by the streak (×2, ×3…). A
   placement that clears nothing ends the streak.
6. If the tray is empty, three new pieces are drawn.

## New pieces

- Drawn from the state's seeded PRNG (so saves resume exactly and replays are deterministic), weighted towards
  small pieces early and towards large ones as the score grows.
- **Helpful draw** (for children): if any shape of the set fits on the board, at least one of the three drawn pieces
  fits. If none fits, the draw is normal, and the game will end.

## End

The game ends when **none of the pieces left in the tray fits anywhere** on the board. The screen then shows:

- the score, the best score, and "Kỷ lục mới!" if it is a record;
- the cells of the full board, briefly greyed;
- **Chơi lại**.

## Screens

The kit's game shell and HUD ([Game shell](../../docs/architecture/game-shell.md), ADR 0019): the title screen, ☰
and its menu, the end card and phone Back come with the kit; this game brings its content.

1. **How to play** (before the first **Chơi**, then from ❓), with three picture hints:
   - drag or tap a piece onto the board;
   - a full row or column clears;
   - clear again and again for a streak.
2. **Playing:**
   - the kit's HUD: ☰, the score (counts up) and the best;
   - the board;
   - the tray, with pieces that fit nowhere dimmed, so a child sees what is still possible.
3. **Game over:** the board settles and greys, then the shell's end card with score and best, confetti for a
   record, **▶ Chơi lại** and **☰ Menu chính**.

## Feel (juice), in tiers

| Event | Feedback |
| --- | --- |
| Pick up | Piece lifts and grows slightly, soft "pop" |
| Place | Cells drop in with a small squash, "tock", light haptic |
| Clear 1 line | Cells pop out one after another along the line, sparkle in their colours, "+10" floats up |
| Clear 2+ lines | As above, with a rising pitch per line and a bigger "+n" |
| Streak ≥ 2 | "Liên tiếp ×n!" banner, each step brighter and higher |
| Board clear (empty after a clear) | Confetti + fanfare, bonus 300 |
| Doesn't fit | Piece slides back to the tray, soft "nope" |

Every animation is short (under half a second) and never blocks the next pick: a child can pick the next piece while
the clear still plays.

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013):

- **Board:** a cream board in light, a warm-charcoal board in dark (like Ghép Khối).
- **Pieces:** the same colours in both themes. Each colour stays readable against both boards.
- **HUD and cards:** the design tokens, through the kit.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | After every placement: `{ best, game, run }`, where `game` is the full state (board, tray, score, streak, PRNG) and `run` its leaderboard id. Opening the game resumes it. |
| `scores` | A live run (ADR 0014), like Ghép Khối: `run(id).update(score)` after placements that score, `finish(score)` at game over or when a new game replaces it. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of a new game. |

`minAge`: **3** (tap-to-place makes it playable before drag precision; no reading needed).

## Invariants (checked by the random-play bot)

- A placement never overlaps a filled cell and never leaves the board.
- After a placement no row or column is full; every line that was full is cleared.
- The score never decreases, and it equals the sum of the rules above.
- The tray always holds 1 to 3 pieces while the game runs; it is refilled exactly when it becomes empty.
- The game is over exactly when no tray piece fits anywhere.
- Helpful draw: whenever some shape fits, a fresh tray has at least one piece that fits.
- A save restores an identical game: replaying the same moves from a restored state gives the same result.

## Technology

Phaser 4 + `@tohe/game-kit`, following `games/merge-block`:

- `logic.ts` is pure and emits events (`place`, `clear`, `streak`, `draw`, `over`); the view only animates them.
- Drag and tap share one aiming routine (nearest fitting cell).

Expected size: like Ghép Khối (≈ 1.4 MB, mostly Phaser).

## Open questions for review

1. Name: **Lấp Ô**? (Alternatives: "Ô Màu", "Gạch Vui".)
2. Helpful draw for everyone? It also makes the game a little easier for adults, and a game cannot tell them apart:
   the contract gives it the profile's name and avatar, not its age.
3. Board-clear bonus of 300: fun or too generous?
