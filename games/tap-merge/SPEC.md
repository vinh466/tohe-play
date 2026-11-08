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
> On 2026-11-08 the owner reviewed the progression plan and said "rất ổn, làm như vậy đi ... xong release prod":
> the classic stays exactly as it is, and the game gains two optional doors, [Hành Trình](#hành-trình) and
> [Mỗi Ngày](#mỗi-ngày), plus [Sổ Tay Khối](#sổ-tay-khối) — one collection that every mode fills. 0.9.0.
> Details the chat left open are marked *(default)*.

A board always full of number blocks. Tap a block: every equal block connected to it, diagonals included, merges
into it and their sum, rounded up to a power of two, is the new block; the board falls and new blocks slide in
from the top. Big blocks retire the smallest numbers, which leave the board with a bonus, so the game levels up as
it goes. The genre of "Get 10" / "2248", made for children: one tap is the whole move, there is no timer, and
nothing merges on its own.

## Modes

The title offers three doors; the rules of a move, the board, the rising floor, the shuffle, the feel and the
colours are the same in all of them.

| Door | What it is | Ranked |
| --- | --- | --- |
| **Vô Tận** | The classic endless game described in this spec. The only ranked mode; the only mode with a server-verified run. | **Yes** |
| **Hành Trình** | Short levels: a snapshot of a real run, a target block and a par for stars. Unranked. | No |
| **Mỗi Ngày** | One date-seeded board, 120 taps, stars from the largest block. Unranked, local. | No |

**Sổ Tay Khối** is not a fourth door: it is the collection that all three modes fill. The classic is the first
door, still one tap from opening, and its rules and HUD are unchanged.

**One station for all three.** The title's **Chế độ**, the panel's **Chế độ** and a result card's **Chế độ** open
the same hub. It shows each door's own state — the run waiting, the classic record, Journey stars, today's stamp —
and makes **Chơi tiếp** the primary when that door has a run. **Ván mới** appears only then, and asks first.
Switching doors never replaces another door's save; a classic run stays a classic run while a Journey level or
today's Daily is tried, and comes back as **Chơi tiếp**.

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
- The HUD shows the next milestone and the value it retires, "Mục tiêu **4K** tạm biệt **2**" after the kit's target icon, lit up when one
  more new largest block reaches it ([Screens](#screens)).

## New blocks

Values come from the state's seeded PRNG. With *F* the exponent of the [floor](#rising-floor) and *M* the
exponent of the largest block on the board, new blocks have exponents *F* … *F* + *K* − 1, *K* = clamp(*M* − *F* − 2,
3, 6), weighted towards the small ones (weights 6, 5, 4, 3, 2, 1). At the start that is 2, 4 and 8; from a 512 on
the board, up to 64; each time the floor rises, the whole range moves up one value (from 4 to 128 after the first
4K). A new game is a full board drawn the same way, drawn again until it has a move.

## Xáo trộn: the shuffle (the rescue)

- A game starts with **one shuffle**, and earns **one more for each new largest block** made in that game, holding
  **at most 3**.
- A shuffle can only be used **when no block has an equal neighbour** *(default)*, so a child cannot spend it by
  accident. Its button (the kit's shuffle icon and how many are left, the word **Xáo trộn** over it)
  pulses at that moment and the word becomes "Chạm để xáo!".
- It rearranges the same blocks at random; if that still leaves no move, one block is moved next to an equal one.
  The score does not change.

## Classic: end

The classic ends when **no block has an equal neighbour and no shuffle is left**. Then: score, best, "Kỷ lục mới!" if
it is a record, and **Chơi lại**. The classic's score, best, HUD, shuffle and end card are exactly as before; Hành
Trình and Mỗi Ngày keep their scores to themselves and never touch the classic's best or the leaderboard.

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

## Hành Trình

- **3 chapters × 8 levels**: **Mầm**, **Chồi**, **Lá**. Chapter 1 teaches the goal; chapter 2 adds tighter pars;
  chapter 3 asks for bigger blocks. The levels are data in `src/content/levels.ts` (the table is generated into `levels.data.ts`); a generator
  (`pnpm --filter @tohe/game-tap-merge levels`) produces them from real runs and a bot validates every one.
- **A level is a snapshot of a real run.** The board, the PRNG and the largest block are frozen from a run at a
  moment one or two doublings below the target; the score and the move count start at 0. The board is full, has a
  move and looks like the moment before the target was made.
- **A level's data**: `{ id, chapter, index, start, rng, top, target, par: { three, two }, shuffles, intro }`.
  `target` is the exponent to make; `top` is the largest block on the starting board; `par.three`/`par.two` are
  taps from the generator's bot table. The level is deterministic: the same start and moves give the same result.
- **Playing**: the same tap, gravity, refill, rising floor and shuffle as the classic. The HUD shows the target,
  the taps used and the three-star par. A level starts with **3 shuffles** and earns one more on a new largest
  block, holding at most 5.
- **End**: the level completes the moment the target block is made. **1 star** for completing; **2** if the level
  is finished within `par.two` taps; **3** within `par.three`. There is **no hard move cap**; a player who takes
  longer still finishes with one star. If the board is stuck with no shuffle left before the target, the level
  ends with 0 stars and **Chơi lại** (one tap, no penalty). The level's result card shows the stars, taps, score
  and any new Sổ Tay Khối card.
- **Chapters**: a level is unlocked when the one before it is complete (1 star). The next chapter opens when
  **6 of 8** levels in the current chapter are complete, so one hard level is never a wall. A completed level can
  be replayed for more stars; the best result is kept.
- **Unranked**: no `session.run`, no leaderboard, no server replay. The result says "Không xếp hạng".

## Mỗi Ngày

- **One board per local date**, seeded from `YYYYMMDD`, the same for everyone in the family that day. The date
  is read in the player's local time; a future server board would need a fixed timezone, which this release does
  not have.
- **120 taps.** The HUD shows "Nước 34/120" — a budget, not a timer. The run ends at 120 taps, or earlier if the
  board is stuck with no shuffle.
- **Stars from the largest block**: 1K = 1 star, 2K = 2, 4K = 3. The first star is deliberately easy; the first
  daily ends with a small win. A run that misses 1K gives no stamp and may be retried.
- **A local result, a calendar.** The best result of the day is kept; practice after it never changes the stamp.
  The Daily screen shows the last 28 days as a calendar; a missed day never removes a stamp. The monthly badge is
  earned at **20 days played in a month**, not 30, and never expires.
- **Unranked**: no `session.run`, no leaderboard, no server board in this release.

## Sổ Tay Khối

- **20 block cards**, 2 … 1M, each with a growth name and a small fact. A card unlocks the first time the value
  is **seen in any mode** — classic, Hành Trình or Mỗi Ngày. This is the long-term progression that a classic-only
  player still fills.
- The detail shows the value, the name, the first-seen date, how many times the block has been met and a tiny
  fact. Locked cards show the value and "Làm ra 4K để mở"; they never expire or cost anything.
- **11 badges** for feats across the modes: absorb 9+/20+ blocks in one tap, play 10 classic runs, score 1M,
  finish chapter 1, 3-star five levels, finish a level without a shuffle, play 7 daily days, 20 daily days in a
  month, unlock 10 cards, unlock all 20. Badges are recognition, never a gate; no badge is lost or competitive.
- **Cosmetic only**: the album's completion can open a card frame and a board theme; it never changes a rule, a
  score, a shuffle or a ranked run. No coins, no ads, no purchase, no limited-time FOMO.
- The album and badges are game-owned full screens (the kit's `screens`): plain DOM, no engine, Back returns to
  the title. The title's progress line shows "Sổ Tay 12/20"; a new card is announced in the play stage and on the
  result card, never in a modal that interrupts a run.

## Screens

The kit's two stages, quick panel and HUD ([Game shell](../../docs/architecture/game-shell.md), ADR 0020); this game
brings its content:
The kit draws every control with an icon of its set beside the words (Phosphor, ADR 0049); the title screen shows
the game's own logo, `public/icon.svg`, the picture the catalog shows.

1. **Title screen** (the menu stage, every time the game opens, no board running): its logo and **Chạm Ghép** over
   drifting blocks, the chip "Ván đang chơi dở: n điểm." when a run waits, **Chơi** or **Chơi tiếp**, then
   **Chế độ** and the three doors **Vô Tận**, **Hành Trình** and **Mỗi Ngày** as secondary buttons with the kit's
   icons. With a run, the title's one job is Continue; with none, the line under the title says "Hành Trình x/72
   sao · Sổ Tay y/20" and the classic best. Tools: Âm thanh, Cài đặt, **Sổ Tay Khối**, Xếp hạng (signed-in
   players) and Cách chơi; **Về Tò He** last, under the tools. The primary button resumes the last mode: a classic
   run, a Journey level or today's Daily. The classic door is one tap. **Cài đặt**: Âm thanh and **Màu khối** — one
   row per [preset](#block-colours), with sample blocks 2 … 256 (the numbers on the board most of the time).
2. **Chế độ** (the kit's pre-play screen, no engine; the title's **Chế độ**, a panel's **Chế độ**, and a result
   card's **Chế độ**): one card per door, classic first. Each card carries its own state — "Đang chơi · 4,2K điểm",
   "Kỷ lục 4,2M", "Màn 3 · 10/72 sao", "Hôm nay · 3 sao", "Chưa chơi hôm nay" — and a **Xếp hạng / Không xếp
   hạng** tag. Its primary is the action that follows from that state: **Chơi tiếp** when a run is waiting, else
   **Chơi** (or **Chơi màn tiếp**, **Chơi hôm nay**, **Luyện lại**). **Ván mới** appears only when there is a run
   to replace, and it asks first: "Ván đang chơi sẽ mất; kỷ lục / sao / dấu đã có vẫn được giữ." A Journey card also
   offers **Chọn màn**: the level grid with the active level marked, and a second tap before another level replaces
   it. Back returns to the title or the panel.
3. **Hành Trình** (a game-owned full screen, no engine): three chapter sections, eight level stamps each with 1–3
   stars, the next chapter locked until 6/8 of the previous one is complete. When a level is in progress, a banner
   at the top says "Đang chơi Chặng 1 · Màn 3" and offers **Chơi tiếp**; that level's stamp is marked, and its
   detail makes **Chơi tiếp** the primary and **Chơi lại** a second, confirmed tap. Choosing another level asks
   before it replaces the run. The selected level's target, starting top block and par ("3 sao trong 120 nước · 2
   sao trong 160") are shown; a completed level offers **Chơi lại**.
4. **Mỗi Ngày** (a game-owned full screen): today's card with the target 4K, "120 nước", the 1K/2K/4K star
   thresholds and its state. A run in progress makes **Chơi tiếp** the primary and shows "Đang chơi dở · 34/120
   nước"; **Luyện lại** asks first. After the stamp the primary is **Luyện lại**; before it, **Chơi hôm nay**. The
   last 28 days are a calendar with a star on each stamped day; a note says "Bỏ một ngày không sao — huy hiệu tháng
   cần 20 ngày". No timer, no streak loss.
5. **Sổ Tay Khối** (a game-owned full screen): a 4 × 5 grid of the 20 cards, locked cards dashed with their value;
   a selected card's name, first-seen date, count and fact; a **Huy hiệu** tab with the 11 badges and their hints.
6. **How to play** (before the first **Chơi** only): four picture hints — tap a block; equal blocks connected to it,
   diagonals too, merge into it; making the goal block (4K, 16K, …) retires the smallest blocks, with points; when
   nothing merges, **Xáo trộn** — plus one line: "Hành Trình có mục tiêu riêng; Mỗi Ngày có 120 nước; cả hai không
   ảnh hưởng bảng điểm của Vô Tận." **Bắt đầu** starts, and a hand (the kit's, in the board's colours) points at a
   first move.
7. **Playing** (the play stage, created on play from the save): the kit's HUD — Menu, score (counts up), the **Xáo
   trộn** button (the kit's shuffle icon) with how many are left, best (its crown lights up once the score passes
   it). In the classic, under it the goal, the kit's target icon and "Mục tiêu [4K] tạm biệt [2]" with both blocks
   drawn small in the player's colours; the board below. In Hành Trình the goal row shows the target block and the
   taps/star par ("Nước 46 · 3 sao đến 120") with three small stars; in Mỗi Ngày it shows "Nước 46/120" and the
   1K/2K/4K thresholds. The board, tap, animation and shuffle are the same in every mode.
   - **Scores never cover the HUD:** each score box keeps its share of the row; the kit shows a score in full while
     it fits ("812.345") and otherwise in its own unit with as many decimals as fit ("812,3K", "23,45M"), cut and
     never rounded up (`formatCompact`). The end cards show scores in full.
8. **Quick panel** (Menu, phone Back, Esc, or the hub hiding the game): **Tiếp tục**; Âm thanh as a switch;
   **Màu khối · (the preset)**, which opens the presets with their sample blocks over the panel — a tap repaints
   the board and the goal behind it at once, **Quay lại** returns to the panel; **Chế độ** opens the mode hub over
   the panel, so switching doors never costs a trip to the title; **Ván mới** asks and restarts the current mode ·
   Cách chơi · Menu chính (saves; the title then offers Chơi tiếp).
9. **End cards**: the classic is unchanged — score/best, the largest block made ("Khối lớn nhất [512K]"), confetti
   for a record, **Chơi lại**, **Menu chính**. A Journey result shows the 1–3 stars, taps, score, a new Sổ Tay Khối
   card, **Màn tiếp** (the next level in place), **Chơi lại** and **Chế độ**; a stuck level says "Hết nước rồi, thử
   lại nhé!" with no "thua". A Daily result shows the stars, the largest block, score and taps, the stamp,
   **Luyện lại**, **Chế độ** and **Menu chính**; missing 3 stars is not a failure.

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
| New largest block | from 64 on, a dozen times a game | "Khối mới: 4K!" banner, a combo sound; with a shuffle earned, "+1 lượt xáo trộn" and the button pops; from 512 on a small shake | from 512 on, a double pulse |
| The goal is one new largest block away | | The goal lights up and pops | none |
| **Milestone: the floor rises** | four or five times a game | "Tạm biệt khối 2!" and the bonus in big letters over the board, a run up the scale, a medium shake; the retired blocks pop one after another to a rising run of notes, each in a burst of its colour; the goal pops and moves on | a long celebration pattern |
| **The score passes the best**, while playing | once a game at most | "Vượt kỷ lục! 👑" in big letters, a fanfare, a little confetti; the best box lights up | the celebration pattern |
| Fall and refill | every tap | Blocks fall with a small bounce; new blocks fade in as they slide down from above the board | none |
| No equal neighbour | | The block wobbles, soft error sound | an error buzz |
| Stuck | | The **Xáo trộn** button pulses, "Chạm để xáo!" | none |
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

Each player picks how the blocks look (**Cài đặt → Màu khối**). The choice belongs to the player: it is kept in the
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
| `save` | After every move: `{ best, game, tutorialSeen, run, palette, journey, daily, album, stats, achievements, lastMode, pending }`. `game` is the classic slot, a full state (board, score, shuffles, largest block, PRNG) plus its `mode` (`classic` / `journey` / `daily`), `level` and `moveLimit`; a save from before 0.9.0 has no mode and opens as classic. `journey` is `{ stars: level id → best stars, game: the active Journey run }`; `daily` is `{ dates: date → best stars, game: today's active run }` (a run from another local date is not kept). `lastMode` is the door the title resumes. `run` exists only for a classic run. `album` holds the seen values, first-seen dates and counts; `stats` holds the small totals the badges read; `achievements` is the badge ids; `pending` is the level/daily a screen asked the stage to start on the next play. Opening the game resumes the last door; the other doors keep their own runs. The floor is computed from the largest block, so saves from before 0.5.0 still open. |
| `scores` | **Classic only** (ADR 0014): `session.run(id).update(score)` after every move, `finish(score)` at game over or when the player starts a new classic game. One run id per classic game, kept in the save. Hành Trình and Mỗi Ngày never call `session.run`; their scores are local and unranked. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of a new classic game and the daily generator; a Journey level carries its own snapshot's `rng`. |

`minAge`: **3** (one tap per move, no reading needed).

## Invariants (checked by the random-play bot)

- The board is always full; every block is a power of two.
- After every tap, no block is under the floor, and the floor never goes down.
- A tap raises the score by exactly what its merge and its floor bonus gained.
- A merged block holds at least the sum of its group, and less than twice it.
- The score never decreases, and every move raises it.
- Shuffles left stay between 0 and 3; a shuffle keeps the same blocks, leaves a move, and costs one.
- No block is larger than the largest block made in the game.
- The classic is over exactly when no block has an equal neighbour and no shuffle is left; it waits for a shuffle
  exactly when no block has an equal neighbour and one is left.
- A Journey level starts from a full valid board, its target is above `top`, and it completes exactly when the
  target is made; stars are 1 for completion, 2/3 by `par.two`/`par.three`; it fails only when stuck with no
  shuffle before the target. A chapter's next chapter opens at 6/8 completed levels.
- A Daily's board is the same for the same local date; it ends at 120 taps or when stuck; its stars are 1/2/3 at
  1K/2K/4K; a missed day never removes a stamp. A daily run from another local date is not resumed as today's.
- The three doors hold three active slots. Starting or resuming one never changes another door's run; a mode
  switch saves the run being left before it replaces the board.
- The Album unlocks a value the first time it is seen in any mode; it never changes a rule, a score or a shuffle.
- A save restores an identical game in any mode: replaying the same moves from a restored state gives the same
  result. An old save with no mode opens as a classic game.

## Technology

Phaser 4 + `@tohe/game-kit`, like Ghép Khối: pure logic in `src/logic.ts` emitting events the view animates; the
board and blocks are drawn once into textures (`drawTexture`). The levels, daily seed, album and badges are pure
data/logic (`src/content/`, `src/album.ts`); the Journey, Daily and Album screens and the mode hub are plain DOM in
the menu stage (the kit's `screens` and `prePlay`), so they run no engine. The hub's choices are strings the play
stage reads (`src/flow.ts`), so a mode switch is a board change, not a second game. The classic's ranked run stays
the only `session.run`; the other modes are local and unranked.
