# Chạm Ghép (`tap-merge`) — spec

> **Status: approved.** The owner proposed this variant of Ghép Khối and approved these rules in chat on
> 2026-10-14 ("ừa vậy bạn triển khai đầy đủ nó giúp tôi"). Details the chat left open are marked *(default)*.

A board always full of number blocks. Tap a block: the equal blocks around it, diagonals included, merge into it
and it doubles; the board falls and new blocks slide in from the top. The genre of "Get 10" / "2248", made for
children: one tap is the whole move, there is no timer, and nothing merges on its own.

## Board

- **5 columns × 7 rows**, always full. Blocks hold powers of two: 2, 4, 8, … shown as `2048`, `4K`, `16K`, `1M`.
- The same blocks and colours as Ghép Khối, so the two games look like a family.

## A move

1. The player **taps a block**. While the finger is down, the block and the equal neighbours it would absorb are
   highlighted. Letting go on the same block plays the move; sliding off to another block moves the highlight.
2. **Merge:** every block with the **same value among the 8 cells around** the tapped block (sideways, up, down
   and diagonal) is absorbed into it, and the tapped block **doubles once (×2)**, however many it absorbed.
3. A block with no equal neighbour wobbles (soft error sound). That is not a move.
4. **Gravity:** absorbed blocks leave holes; the blocks above fall down.
5. **Refill:** the holes left at the top of each column fill with new blocks that slide in from above the board.
6. **No chains:** blocks that now touch an equal block wait for the player's next tap. Every merge is a choice.
7. Taps made while blocks are still moving are ignored *(default)*: a move animates in under half a second, and a
   remembered tap could land on a block that has changed under the finger.

## Scoring

- A tap scores **the new value × the number of blocks absorbed**: a 4 made from two 2s scores 4; a 4 made from
  four 2s (three absorbed) scores 12.
- Absorbing many blocks scores more, but a pair keeps more value on the board. That is the game's choice.

## New blocks

Values come from the state's seeded PRNG. With *M* the exponent of the largest block on the board, new blocks have
exponents 1 … *K*, *K* = clamp(*M* − 3, 3, 6), weighted towards the small ones (weights 6, 5, 4, 3, 2, 1). At the
start that is 2, 4 and 8; from a 512 on the board, up to 64. A new game is a full board drawn the same way, drawn
again until it has a move.

## 🔀 Shuffle (the rescue)

- A game starts with **one 🔀**, and earns **one more for each new largest block** made in that game, holding
  **at most 3**.
- 🔀 can only be used **when no block has an equal neighbour** *(default)*, so a child cannot spend it by
  accident. Its button pulses at that moment and the label says "Chạm 🔀!".
- It rearranges the same blocks at random; if that still leaves no move, one block is moved next to an equal one.
  The score does not change.

## End

The game ends when **no block has an equal neighbour and no 🔀 is left**. Then: score, best, "Kỷ lục mới!" if it is
a record, and **Chơi lại**.

## Game length

The 8 directions decide how long a game lasts. A full 5 × 7 board where diagonals count almost always holds an equal
pair, so a game is a long run, played over several sittings (continue / new game, live leaderboard). Simulated
games, 60 per player:

| Player | Taps per game (median) | Largest block (median) | Stuck per game |
| --- | --- | --- | --- |
| Taps any block that merges (a child) | about 3,000 (2,000–4,500) | 8K | 4.5 |
| Plays carefully | about 4,000 (2,300–8,000) | 16K | 4.2 |
| *For comparison: 4 directions only (no diagonals)* | *about 260* | *256–512* | *5* |

If games feel too long, the switch is one constant (`DIRECTIONS` in `logic.ts`) and a version bump.

## Screens

1. **Intro** (first time only): three picture hints — tap a block; equal blocks around it, diagonals too, merge
   into it; when nothing merges, 🔀 shuffles.
2. **Continue** (opening with a game in progress, after the intro was seen): "Ván đang chơi dở: n điểm" with
   **Chơi tiếp** (the default) and **Ván mới** (asks first; the run ends).
3. **Playing:** HUD with ⏸, score (counts up), the 🔀 button with how many are left, and best; the board below.
   Exit and sound buttons come from the hub. **⏸** (or Esc) opens the menu: **Tiếp tục**, **Ván mới** (asks
   first), **Cách chơi**.
4. **Paused by the hub:** the hub sends `pause` when the app is hidden or its exit confirmation is open; animations
   and timers stop, and `resume` continues exactly where they were.
5. **Game over:** board dims, card with score/best, confetti for a record, **Chơi lại**.

The continue card and the ⏸ menu are the kit's standard lifecycle (`createLifecycle`).

## Feel (juice), in tiers

| Event | Feedback |
| --- | --- |
| Finger down | The block and the neighbours it would absorb lift and glow |
| Merge | Neighbours slide into the tapped block, it pops and changes colour, particle burst in its colour, "+points" floats up, rising pitch with value, haptic |
| Big merge (4 or more absorbed) | "Gom n!" banner, a combo sound |
| New largest block | "Khối mới!" banner; with a 🔀 earned, "+1 🔀" and the button pops |
| Block of 512 or more | Short camera shake (skipped with reduced motion) |
| Fall and refill | Blocks fall with a small bounce; new blocks fade in as they slide down from above the board |
| No equal neighbour | The block wobbles, soft error sound |
| Stuck | The 🔀 button pulses, "Chạm 🔀!" |
| Shuffle | Every block flies to its new place |
| Record | Confetti + fanfare |

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013), like Ghép Khối:

- **Board:** a cream board on a cream page in light; a warm-charcoal board on a darker page in dark.
- **Blocks:** the same in both themes; every number is at least 4.5:1 on its block (`palette.test.ts`). The dark
  champion block gets a gold ring on the dark board.
- **HUD and cards:** the platform's design tokens, through the kit.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | After every move: `{ best, game, tutorialSeen, run }` where `game` is the full state (board, score, 🔀, PRNG) and `run` its leaderboard id. Opening the game resumes it. |
| `scores` | A live run (ADR 0014): `session.run(id).update(score)` after every move, `finish(score)` at game over or when the player starts a new game. One run id per game, kept in the save. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of a new game. |

`minAge`: **3** (one tap per move, no reading needed).

## Invariants (checked by the random-play bot)

- The board is always full; every block is a power of two.
- The score never decreases, and every move raises it.
- 🔀 stays between 0 and 3; a shuffle keeps the same blocks, leaves a move, and costs one.
- No block is larger than the largest block made in the game.
- The game is over exactly when no block has an equal neighbour and no 🔀 is left; it waits for 🔀 exactly when no
  block has an equal neighbour and one is left.
- A save restores an identical game: replaying the same moves from a restored state gives the same result.

## Technology

Phaser 4 + `@tohe/game-kit`, like Ghép Khối: pure logic in `src/logic.ts` emitting events the view animates; the
board and blocks are drawn once into textures (`drawTexture`).
