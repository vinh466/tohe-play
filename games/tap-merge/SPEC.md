# Chạm Ghép (`tap-merge`) — spec

> **Status: approved.** The owner proposed this variant of Ghép Khối and approved these rules in chat on
> 2026-10-14 ("ừa vậy bạn triển khai đầy đủ nó giúp tôi"). After playing 0.1.0 the owner kept the 8 directions —
> "a game to open and play without thinking" — and asked that a tap pull in the whole connected group, not only
> the 8 cells around (0.2.0). On 2026-10-15 the owner asked that a merge add up the group ("khi merge thì cộng
> tổng các ô"), and chose to round the sum **up** to a power of two (0.3.0) after seeing how long games last
> ([Game length](#game-length)). The same day a friend of the owner found the gradual block colours hard to tell
> apart; the owner likes them, so each player picks a colour preset (0.4.0, [Block colours](#block-colours)).
> Later that day the owner asked that big blocks stop the small ones from coming ("khi merge ra 1 block to, thì cần
> có cơ chế ko spawn block nhỏ nữa"), chose the [rising floor](#rising-floor) proposed after a simulation ("như bạn
> đề xuất, làm sao để nó hợp lý, an toàn, và kích thích cảm giác đạt được"), with points for the blocks it clears
> ("có cộng") and no care for older scores ("k cần quan tâm điểm cũ"), and asked for vibrations and effects tuned
> so players stay ("tối ưu để người chơi dính hơn"): 0.5.0, [Feel](#feel-juice-in-tiers).
> Details the chat left open are marked *(default)*.

A board always full of number blocks. Tap a block: every equal block connected to it, diagonals included, merges
into it and their sum, rounded up to a power of two, is the new block; the board falls and new blocks slide in
from the top. Big blocks retire the smallest numbers, which leave the board with a bonus, so the game levels up as
it goes. The genre of "Get 10" / "2248", made for children: one tap is the whole move, there is no timer, and
nothing merges on its own.

## Board

- **5 columns × 7 rows**, always full. Blocks hold powers of two: 2, 4, 8, … shown as `2048`, `4K`, `16K`, `1M`
  (never more than 4 characters, up to `512B`).
- The same blocks and colours as Ghép Khối, so the two games look like a family.

## A move

1. The player **taps a block**. While the finger is down, the block and the group it would absorb are
   highlighted. Letting go on the same block plays the move; sliding off to another block moves the highlight.
2. **Merge:** the tapped block's **group** is every block of the same value connected to it through neighbours
   in 8 directions (sideways, up, down and diagonal), however far the chain reaches. The whole group is absorbed
   into the tapped block, which becomes **the sum of the group, rounded up to a power of two**, so every block
   stays a power of two:

   | Blocks in the group (with the tapped one) | 2 | 3–4 | 5–8 | 9–16 | 17–32 |
   | --- | --- | --- | --- | --- | --- |
   | The tapped block becomes | ×2 | ×4 | ×8 | ×16 | ×32 |
   | From 2s | 4 | 8 (3 × 2 = 6, rounded up) | 16 | 32 (10 × 2 = 20, rounded up) | 64 |
3. A block with no equal neighbour wobbles (soft error sound). That is not a move.
4. **Gravity:** absorbed blocks leave holes; the blocks above fall down.
5. **Refill:** the holes left at the top of each column fill with new blocks that slide in from above the board.
6. **Rising floor:** when the merge made a milestone block, the smallest value retires: its blocks leave the board
   and score, the board falls and refills again ([Rising floor](#rising-floor)).
7. **No chains:** blocks that now touch an equal block wait for the player's next tap. Every merge is a choice.
8. Taps made while blocks are still moving are ignored *(default)*: a move animates in under half a second, and a
   remembered tap could land on a block that has changed under the finger.

## Scoring

- A tap scores **the new value × the number of blocks absorbed** *(default: unchanged since 0.1.0)*: a 4 made
  from two 2s scores 4; a 32 made from ten 2s (nine absorbed) scores 288.
- Rounding up rewards gathering: three 2s already make an 8, and five make a 16.
- When the floor rises, **each block that leaves scores the largest block's value** *(default)*: the first 4K
  clearing five 2s adds 5 × 4,096 = 20,480. In simulated games that is about 14% of all points: a jackpot at each
  milestone that never outweighs the merges.

## Rising floor

The smallest value that still comes and stays on the board, the **floor**, rises with the largest block made in the
game (`floorOf` in `logic.ts`):

| Largest block made | below 4K | 4K, 8K | 16K, 32K | 64K, 128K | 256K, 512K | 1M, 2M | … |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The floor (smallest value) | 2 | 4 | 8 | 16 | 32 | 64 | one more every second new largest block |
| The value retired then | | 2 | 4 | 8 | 16 | 32 | |

- **Milestones** are 4K, 16K, 64K, 256K, 1M, …: each is four times the one before. Making one retires the floor
  value: no new block of it comes, and **every block of it on the board leaves** (and scores, see
  [Scoring](#scoring)); the board falls and refills from the new floor.
- The new blocks of the merge that reaches a milestone already come from the new floor, so none is cleared a moment
  after it arrives.
- **Why a floor that falls behind:** a floor kept at a fixed distance under the largest block makes the board at 1M
  look exactly like the board at 1K, only bigger: a fair player never gets stuck, games never end and blocks grow
  without bound (2^100 and more in the simulation, [Game length](#game-length)). Rising one value for every two new
  largest blocks widens the range of values on the board as the game goes, so every game still ends.
- The floor is computed from the largest block made, which saves already hold: games saved before 0.5.0 need no
  migration. Blocks they still have under the floor leave at their next tap, the same way.
- The HUD shows the next milestone and the value it retires, "🎯 Mục tiêu **4K** tạm biệt **2**", lit up when one
  more new largest block reaches it ([Screens](#screens)).

## New blocks

Values come from the state's seeded PRNG. With *F* the exponent of the [floor](#rising-floor) and *M* the
exponent of the largest block on the board, new blocks have exponents *F* … *F* + *K* − 1, *K* = clamp(*M* − *F* − 2,
3, 6), weighted towards the small ones (weights 6, 5, 4, 3, 2, 1). At the start that is 2, 4 and 8; from a 512 on
the board, up to 64; each time the floor rises, the whole range moves up one value (from 4 to 128 after the first
4K). A new game is a full board drawn the same way, drawn again until it has a move.

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

The 8 directions, the merge rule and the floor decide how long a game lasts. A full 5 × 7 board where diagonals
count almost always holds an equal pair, and whole groups clear more of the board at each tap, so a game is long: a
game to open and play without thinking, resumed where it was left (continue / new game, live leaderboard). Every
game ends, after a long while. Simulated games of 0.5.0, 40 per player (`pnpm --filter @tohe/game-tap-merge
simulate`):

| Player | Taps per game (median) | Largest block (median, max) | Stuck per game | Score (median, max) |
| --- | --- | --- | --- | --- |
| Taps any block that merges (a child) | about 2,800 (1,600–4,600) | 256K, 2M | 4.9 | 11.3M, 56M |
| Always takes one of the biggest groups | about 2,600 (1,400–3,800) | 512K, 2M | 5.5 | 12.2M, 46M |

Blocks absorbed per tap: 2.2 on average, up to 22; 6 or more in 5% of a child's taps and 2% of the greedy
player's. The floor ends four or five values up (32 in the median game), and each rise clears about five blocks.

How the floor rule changes games (a throwaway variant of the same simulation, 40 games per player and rule, stopped
at 25,000 taps; it refilled from the old floor before raising it, so its 0.5.0 row is a little apart from the table
above):

| Floor rule | Taps per game, child / greedy | Largest block (median) | Games that do not end |
| --- | --- | --- | --- |
| No floor (0.4.0) | about 1,700 / 1,750 | 32K | none |
| **One value for every second new largest block, from 4K (0.5.0)** | **about 3,000 / 2,300** | **512K** | **none** |
| One value for every third new largest block, from 4K | about 2,550 / 2,000 | 128K | none |
| 14 values under the largest block | about 1,750 / 1,700 | 32K (it hardly ever rises) | none |
| 12 values under the largest block | about 8,800 / 7,000 | 32B–64B, up to 2^98 | 3 and 1 of 40 |
| Retire a value after making a block 12 values above the floor three times | about 4,700 / 3,700 | 2M–8M, up to 2^66 | none, but blocks of 2^66 |

Earlier versions: how the merge rule changed the median game of the child-like player (the same bot, 10 to 40
games per rule): the tapped block doubling once, however big the group (0.2.0), about 15,000 taps, some games never
ending; the sum rounded down to a power of two, about 6,000; **rounded up (0.3.0), about 1,900**; the exact sum
(three 2s → 6), about 100, as numbers like 6 and 20 almost never find a pair among the new 2s, 4s and 8s. Only the
8 cells around (0.1.0) gave about 3,000 taps; 4 directions only, about 260. The directions are one constant
(`DIRECTIONS` in `logic.ts`), the rounding one function (`merged`), the floor another (`floorOf`).

## Screens

The kit's game shell ([Game shell](../../docs/architecture/game-shell.md), ADR 0018):

1. **Main menu** (every time the game opens, over the board as it was left): **▶ Chơi**, or "Ván đang chơi dở: n
   điểm" with **▶ Chơi tiếp** and **Ván mới** (asks first; the run ends); **⚙️ Cài đặt**, **🏆 Bảng xếp hạng**
   (signed-in players), **❓ Cách chơi**, **← Về Tò He**.
2. **Intro** (the first **Chơi** only): four picture hints — tap a block; equal blocks connected to it, diagonals
   too, merge into it; making the goal block (4K, 16K, …) retires the smallest blocks, with points; when nothing
   merges, 🔀 shuffles.
3. **Playing:** HUD with ☰, score (counts up), the 🔀 button with how many are left, and best; under it the goal,
   "🎯 Mục tiêu [4K] tạm biệt [2]" with both blocks drawn small in the player's colours; the board below.
   - **Scores never cover the HUD:** each score box keeps its share of the row; a score is shown in full while it
     fits ("812.345") and otherwise in its own unit with as many decimals as fit ("812,3K", "23,45M"), cut and never
     rounded up (the kit's `formatCompact`). The game-over card shows scores in full.
   **☰** (phone Back, Esc) opens the menu: **▶ Tiếp tục**, **🔊 Âm thanh**, **❓ Cách chơi**, **⚙️ Cài đặt**,
   **☰ Menu chính**, **← Về Tò He**.
   - **Cài đặt → Màu khối** (any time): one row per [preset](#block-colours), with its name and sample blocks 2 …
     256 (the numbers on the board most of the time) in its colours; the chosen one is marked. Tapping a row
     repaints the board at once and keeps the choice; **Quay lại** returns.
4. **Paused by the hub:** the hub sends `pause` when the app is hidden; animations and timers stop, and `resume`
   continues exactly where they were.
5. **Game over:** board dims, card with score/best and the largest block made ("Khối lớn nhất [512K]"),
   confetti for a record, **Chơi lại**, **☰ Menu chính**.

## Feel (juice), in tiers

Feedback grows with how rare a moment is, so the big ones keep their meaning: a buzz or a shake every tap would be
noise by the hundredth. Shakes are skipped with reduced motion; vibrations work where the browser allows them
(Android), the kit's `haptics`.

| Event | How often | Feedback | Vibration |
| --- | --- | --- | --- |
| Finger down on a group that merges | every tap | The block and its group lift and glow | a light tick, like a button giving way |
| Finger down on a lone block | | It sinks a little | none |
| Merge | every tap | The group is pulled into the tapped block like a ripple, nearest first; the block pops and changes colour, particle burst in its colour, "+points" floats up (shortened like the HUD), a note that climbs with the value, counted from the floor so it stays pleasant | a bump |
| Big merge (6 or more absorbed) | 1 tap in 20 to 50 | "Gom n!" banner, a combo sound | a double pulse |
| Huge merge (9 or more absorbed) | rarer | The banner in the bright colour, a small camera shake | a double pulse |
| New largest block | from 64 on, a dozen times a game | "Khối mới: 4K!" banner, a combo sound; with a 🔀 earned, "+1 🔀" and the button pops; from 512 on a small shake | from 512 on, a double pulse |
| The goal is one new largest block away | | The goal lights up and pops | none |
| **Milestone: the floor rises** | four or five times a game | "Tạm biệt khối 2!" and the bonus in big letters over the board, a run up the scale, a medium shake; the retired blocks pop one after another to a rising run of notes, each in a burst of its colour; the goal pops and moves on | a long celebration pattern |
| **The score passes the best**, while playing | once a game at most | "Vượt kỷ lục! 👑" in big letters, a fanfare, a little confetti; the best box lights up | the celebration pattern |
| Fall and refill | every tap | Blocks fall with a small bounce; new blocks fade in as they slide down from above the board | none |
| No equal neighbour | | The block wobbles, soft error sound | an error buzz |
| Stuck | | The 🔀 button pulses, "Chạm 🔀!" | none |
| Shuffle | | Every block flies to its new place | a double pulse |
| Game over | | The board dims and wobbles; a record brings confetti and a fanfare | a double pulse for a record |

- Banners queue: one waits until the one before has risen out of the way, so "Khối mới", "Gom n!", the milestone
  and the record never cover each other.
- Until 0.4.0 every merge from 512 on shook the board, which by the end of a long game was nearly every tap; the
  shake now belongs to new largest blocks and the rarer moments.

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013), like Ghép Khối:

- **Board:** a cream board on a cream page in light; a warm-charcoal board on a darker page in dark.
- **Blocks:** in the player's [colour preset](#block-colours), the same in both themes.
- **HUD and cards:** the platform's design tokens, through the kit.

## Block colours

Each player picks how the blocks look (**⚙️ Cài đặt → Màu khối**). The choice belongs to the player: it is kept in the
game's save, so it follows the profile to other devices, and a new player starts with **Hoàng hôn**.

| Preset | Look |
| --- | --- |
| **Hoàng hôn** (default) | The colours of Ghép Khối: warm and soft for small numbers, saturated and cool as they grow. |
| **Tương phản mạnh** | Two numbers in a row never share a hue: red, blue, yellow, green, purple, orange, pink, teal, then the same round again in other shades. |
| **Kẹo pastel** | Light, soft colours, a different hue for each number, dark text. |
| **Neon** | Bright, saturated colours with dark text; they stand out most on the dark board. |
| **Dễ phân biệt** | Built on the Okabe–Ito palette, which people with red–green colour blindness tell apart; numbers above 256 take its hues again, darker. |

- Every number is at least 4.5:1 on its block, in every preset (`palette.test.ts`).
- In every preset except Hoàng hôn, two numbers in a row are clearly different colours (`palette.test.ts`
  measures the distance between them).
- **From 64K on**, the preset's colours come round again (64K like 2, 128K like 4, …) with a **gold ring and a
  sparkle** in the corner (deep gold on the cream board, light gold on the dark one). The rising floor has retired
  those small numbers long before, and in the rare game where one is still there (from a 2M on), the ring and the
  number tell them apart. Until 0.4.0 every block from 64K on was the same dark "champion" block, which a board of
  big blocks could no longer tell apart.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | After every move: `{ best, game, tutorialSeen, run, palette }` where `game` is the full state (board, score, 🔀, largest block made, PRNG), `run` its leaderboard id and `palette` the player's colour preset (also saved when it changes). Opening the game resumes it; the floor is computed from the largest block, so saves from before 0.5.0 still open. |
| `scores` | A live run (ADR 0014): `session.run(id).update(score)` after every move, `finish(score)` at game over or when the player starts a new game. One run id per game, kept in the save. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of a new game. |

`minAge`: **3** (one tap per move, no reading needed).

## Invariants (checked by the random-play bot)

- The board is always full; every block is a power of two.
- After every tap, no block is under the floor, and the floor never goes down.
- A tap raises the score by exactly what its merge and its floor bonus gained.
- A merged block holds at least the sum of its group, and less than twice it.
- The score never decreases, and every move raises it.
- 🔀 stays between 0 and 3; a shuffle keeps the same blocks, leaves a move, and costs one.
- No block is larger than the largest block made in the game.
- The game is over exactly when no block has an equal neighbour and no 🔀 is left; it waits for 🔀 exactly when no
  block has an equal neighbour and one is left.
- A save restores an identical game: replaying the same moves from a restored state gives the same result.

## Technology

Phaser 4 + `@tohe/game-kit`, like Ghép Khối: pure logic in `src/logic.ts` emitting events the view animates; the
board and blocks are drawn once into textures (`drawTexture`).
