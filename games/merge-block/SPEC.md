# Ghép Khối (`merge-block`) — spec

Drop numbered blocks into columns; equal blocks that touch merge into bigger numbers, and merges can chain.
The genre of "X2 Blocks" / "Drop the Number", designed for children and adults on a phone in portrait.

## Board

- **5 columns × 7 rows.** Blocks hold powers of two: 2, 4, 8, … shown as `2048`, `4K`, `16K`, `1M`.
- Above the board: the **current** block (the one the player drops), hovering over the aimed column.
- In the HUD, between score and best: the **next** block. It lives there so the current block never covers it,
  whatever column the player aims at.

## A move

1. The player taps a column, or drags the current block over the columns and releases. A ghost shows where the
   block will land. A tap made while the previous move is still animating is remembered (only the latest) and
   played as soon as that move ends, so quick taps are never lost; taps less than 150 ms apart count as one
   (a bouncing finger), and holding a drop key drops once.
2. The block falls to the lowest empty cell of that column. A full column refuses the block (shake + soft error
   sound); that is not a move.
3. **Merge:** when a block arrives in a cell (landing, falling or after merging), every orthogonal neighbour
   (left, right, below, above) with the **same value** is absorbed into it. Absorbing *k* neighbours multiplies
   the value by 2^k: one neighbour → ×2, two → ×4, three → ×8.
4. **Gravity:** absorbed blocks leave holes; blocks above fall down. Every block that moved, and every merged
   block, is checked again (step 3). This repeats until nothing changes — a **chain**. Each step of a chain is a
   **combo** level (1, 2, 3, …).
5. **Score:** every merge adds its resulting value × its combo level.
6. The next block becomes current; a new next block is drawn.

## New blocks

Values are drawn from the state's seeded PRNG. With *M* the exponent of the largest block on the board
(2 → 1, 4 → 2, …, at least 3), new blocks have exponents 1 … min(M − 2, 6), weighted towards the small ones
(weights 6, 5, 4, 3, 2, 1). Early on that means 2, 4 and 8; later up to 64.

## End

The game ends when **every column is full**. Then: score, best, "Kỷ lục mới!" if it is a record, and **Chơi lại**.

## Screens

1. **Intro** (first time only): three picture hints — tap a column; equal blocks merge; chains multiply points.
   The first move shows a pulsing hint over the columns.
2. **Continue** (opening with a game in progress, after the intro was seen): "Ván đang chơi dở: n điểm" with
   **Chơi tiếp** (the default) and **Ván mới** (asks first; the run ends).
3. **Playing:** HUD with ⏸, score (counts up), next block and best; board with the current block above it; exit and
   sound buttons come from the hub. **⏸** (or Esc) opens the menu: **Tiếp tục**, **Ván mới** (asks first),
   **Cách chơi** (the intro hints again).
4. **Paused by the hub:** the hub sends `pause` when the app is hidden or its exit confirmation is open; animations
   and timers stop, and `resume` continues exactly where they were.
5. **Game over:** board dims and settles, card with score/best, confetti for a record, **Chơi lại**.

The continue card and the ⏸ menu are the kit's standard lifecycle (`createLifecycle`).

## Feel (juice), in tiers

| Event | Feedback |
| --- | --- |
| Drop | Accelerating fall, squash on landing, soft "tock", light haptic |
| Merge | Neighbours slide into the target, target pops and changes colour, particle burst in its colour, "+value" floats up, rising pitch with value, haptic |
| Chain ≥ 2 | "Combo ×n!" banner, each step a little brighter and higher in pitch |
| Big merge (≥ 512) | Short camera shake (skipped with reduced motion) |
| Record | Confetti + fanfare |
| Full column | Column shakes, soft error sound |

Every animation step is short (under half a second) so the board stays readable; taps made meanwhile are remembered
(see *A move*), so the game never ignores the player.

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013):

- **Board:** a cream board on a cream page in light; a warm-charcoal board on a darker page in dark, with empty
  cells a step lighter than the board. It switches at once when the hub changes theme mid-round.
- **Blocks:** the same in both themes, so a value keeps its colour. Every number is at least 4.5:1 on its block
  (checked by `palette.test.ts`): dark text on light blocks, white on the deeper 64–1024 colours. The dark champion
  block gets a gold ring on the dark board.
- **HUD and cards:** the platform's design tokens, through the kit.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | After every move: `{ best, game }` where `game` is the full state (board, current, next, score, PRNG). Opening the game resumes it. |
| `scores` | `submitScore(score)` at game over. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of a new game. |

## Invariants (checked by the random-play bot)

- After every move, no two orthogonally adjacent blocks have the same value.
- No hole under a block (every block rests on the floor or on another block).
- The score never decreases; the board never holds more than 35 blocks.
- The game is over exactly when every column is full.
- A save restores an identical game: replaying the same moves from a restored state gives the same result.

## Technology

Phaser 4 + `@tohe/game-kit` ([research](../../docs/research/game-tech.md)), pure logic in `src/logic.ts`
emitting events the view animates.
