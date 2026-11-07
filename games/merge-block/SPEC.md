# Ghép Khối (`merge-block`) — spec

Fire numbered blocks up into a rack that hangs from the ceiling; equal blocks that touch merge into bigger numbers.
The machine above the rack shakes when its pressure is full: every row slides toward the centre, and the blocks that
meet merge in a chain. Build a big block and let it leave through the top chute before the rack reaches the loader.
The genre of "X2 Blocks" / "Drop the Number", turned upside down and given a machine, for children and adults on a
phone in portrait.

## The machine and the board

- **5 columns × 7 rows.** Row 0 is the bottom, row 6 the ceiling. The rack hangs from the ceiling; empty cells are
  below the lowest block of each column.
- The **loader** sits in a bay under the rack: the **current** block is in its breech, and the **next** block waits on
  a feeder below it, inside the same bay. The loader slides along the bay to the aimed column.
- Above the rack, the machine's **pressure gauge** (eight lamps) and its **top chute**; below the rack, the **safety
  line** that separates the playing field from the loader.
- Blocks hold powers of two: 2, 4, 8, … shown as `2048`, `4K`, `16K`, `1M`.

## A shot

1. The player drags the loader to a column and lets go; a tap on a column also fires. A dotted aim line runs from the
   current block to a ghost block in the landing cell. While the previous shot is still animating, the latest tap is
   remembered and fired as soon as that shot ends (taps less than 150 ms apart count as one; holding a fire key fires
   once).
2. The block flies up its column. It stops in the cell **just below the lowest block** of that column; an empty column
   takes it at the ceiling. A column with a block in row 0 is blocked: the loader clunks, shakes and the shot is not a
   move.
3. **Merge:** when a block arrives in a cell (landing, falling upward, or after merging), every orthogonal neighbour
   (left, right, below, above) with the **same value** is absorbed into it. Absorbing *k* neighbours multiplies the
   value by 2^k: one neighbour → ×2, two → ×4, three → ×8. A block takes part in at most one merge in a round.
4. **Gravity up:** absorbed blocks leave holes; blocks below fall **upward** until they rest on the ceiling or on
   another block. Every block that moved, and every merged block, is checked again (step 3). This repeats until
   nothing changes — a **chain**. Each round of a chain is one **combo** level (1, 2, 3, …).
5. **Score:** every merge adds its resulting value × its combo level.
6. **Pressure:** after the shot's chain settles, every merge in it adds 1 to the pressure gauge (at most 8). At 8 the
   machine shakes (below). The shot's chain always finishes first.
7. **Ship:** after every round, a block of 256 or more resting on the ceiling is pushed up through the top chute: it
   leaves the rack, adds its value × 3 to the score, and the blocks below it fall up into its place.
8. The next block becomes current; a new next block is drawn.

## The machine's shake

When the pressure gauge is full (8), the machine shakes once the shot has settled:

1. **Slide:** in every row, the blocks slide toward the centre, keeping their left-to-right order. The centre columns
   are filled first, so a gap between two equal blocks can close.
2. **Merge:** every equal pair that now touches merges, by the same rule as a shot. A machine merge adds its resulting
   value × its combo × **2**; the combo starts again at 1 for the shake. The shake's own merges add no pressure.
3. **Ship and gravity:** a block of 256 or more on the ceiling is shipped as above; blocks below it fall upward.
   Repeat the merges and the gravity until nothing changes (the slide itself happens once).
4. The gauge empties. The shake can free a column: a pulse merge removes a block and the gravity pulls the blocks below
   it up, or the merge removes a row-0 block itself. The game is over only after the shake has run, so the rack is always
   settled before a jam is declared.

A machine merge is what a player sets up: two equal blocks in the same row, with only empty cells between them in that
row, slide together and merge. The machine is a second, reliable actor in the puzzle, not a random booster.

## New blocks

Values are drawn from the state's seeded PRNG. With *M* the exponent of the largest block on the board
(2 → 1, 4 → 2, …, at least 3), new blocks have exponents 1 … min(M − 2, 6), weighted towards the small ones
(weights 6, 5, 4, 3, 2, 1). Early on that means 2, 4 and 8; later up to 64.

## End

The machine jams when **every column has a block in row 0** at the end of a shot and its shake: the rack has reached
the safety line and no column can take another block. Then: score, best, "Kỷ lục mới!" if it is a record, the number
of blocks shipped, and **Chơi lại**.

## Screens

The kit's two stages, quick panel and HUD ([Game shell](../../docs/architecture/game-shell.md), ADR 0020); this game
brings its content:

1. **Title screen** (the menu stage, every time the game opens, no board running): its gear logo holding a block over
   drifting blocks, **Ghép Khối**, the chip "Ván đang chơi dở: n điểm. · Kỷ lục m", **Chơi** or **Chơi
   tiếp** and **Ván mới** (asks first; the run ends); tools Âm thanh, Cài đặt, Xếp hạng (signed-in players) and Cách
   chơi; **Về Tò He** last, under the tools. **Cài đặt**: Âm thanh and **Màu khối** — one row per
   [preset](#block-colours), with its name and sample blocks 2 … 256 in its colours. **Cách chơi**: the three picture
   hints.
2. **How to play** (before the first **Chơi** only): three picture hints — drag the loader and let go to fire up;
   equal blocks that touch merge; when the gauge is full the machine shakes the rows together. **Bắt đầu** starts,
   and the first move shows a pulsing aim line and the kit's pointing hand at the loader.
3. **Playing** (the play stage, created on play from the save): the kit's HUD — Menu, score (counts up), best (its crown
   lights up once the score passes it); the machine: top beam with the **eight pressure lamps** and the chute, the
   hanging rack, the **safety line**, the loader bay with the current block and the feeder; the aim line and ghost.
4. **Quick panel** (Menu, phone Back, Esc, or the hub hiding the game): **Tiếp tục**; Âm thanh as a switch;
   **Màu khối · (the preset)**, which opens the presets with their sample blocks over the panel — a tap repaints
   the board, the current block, the feeder and the machine's blocks behind it at once, **Quay lại** returns to the
   panel; Ván mới (asks) · Cách chơi · Menu chính (saves; the title then offers Chơi tiếp).
5. **Game over:** the rack dims and the machine jams, card with score/best/shipped, confetti for a record, **Chơi lại**,
   **Thách bạn** (when the hub can share and the game knows its seed), **Menu chính**; Back goes to the title screen.
6. **Watching a ranked run** (the admin console, ADR 0032): no title screen. The board starts from the run's seed and
   plays at once, like a video, with the kit's HUD — Menu, score, **Nước n/m** — and a bar under it: a
   slider to any move, **Lùi** one back, **Phát / Dừng**, **Tới** one on (stepping and the slider wait for **Dừng**),
   each with the kit's caret, play or pause icon beside its word, and
   the speed: **×1** shows where each block goes, then fires it; **×4** fires them one after another; **×20** only draws
   the boards. The board takes no taps. At the end the bar says how the run ended — "Hết ván: n điểm.",
   "Run dừng ở đây, ván chưa hết.", or for a run with a move that is not legal
   "Nước k không hợp lệ: chiếu đến trước nó." (it plays up to that move). The panel: Tiếp tục (playing stops when
   it opens), Âm thanh, Màu khối (not saved), Cách chơi, **Thoát xem lại**. Nothing is saved, scored or handed in.

## Challenge a friend ("Thách bạn")

[ADR 0045](../../docs/decisions/0045-games-declare-identity-and-entries.md). A game remembers the seed it started from
(`seed` in its state; a version-2 game always has one, and only a damaged save loses it).

- **Sending**: the end-of-game card of a regular game shows **Thách bạn** when the hub can share
  (`session.canShare`): it shares `{ v: 2, seed, score }` with the text "Mình được {score} điểm Ghép Khối. Bạn vượt
  được không?" and the level `any`, so a newcomer plays at once. The hub's sheet makes the link only when the player
  sends, copies or shows it.
- **Opening**: `game.json` declares `"entries": ["share"]` and ships `entries/share.json`. The shell's entry handler
  answers `handled` only for exactly `{ v: 2, seed, score }` (a 32-bit seed, a whole score from 0 to 10¹²),
  `unsupported` for another `v` or kind, `invalid` for anything else. Handled, play opens at once, the title screen
  behind it. A `v: 1` link is from the game before the machine: it is `unsupported`, not played.
- **The challenge game**: the same blocks from the link's seed, in a slot of its own in the save (`challenge`: seed,
  target, sender, game, run) with its own score run on the account's board — a normal score, **never a ranked run**.
  The regular game and its ranked run stay untouched. Opened again by the same challenge while it is in progress (after
  signing in, or the same link), it continues; another challenge replaces the slot. First a card: "Vượt {score} của
  {name}" and "Cùng bộ khối với {name}. {score} là điểm {name} gửi kèm link." (without a sender: "Vượt {score}", "Cùng
  bộ khối với người gửi…"): the score is the sender's claim, shown as such. Under the HUD, the target line.
  Ván mới in the panel starts the challenge again on the same blocks.
- **Its end**: "Bạn đã vượt {name}! 🎉" or "Còn thiếu {diff} điểm nữa thôi!", then **Về ván thường** (the regular game
  in place: the one in progress, or a new one, ranked when the hub deals a run), **Thách lại** (shares this score on
  the same seed) and Menu chính.

## Feel (juice), in tiers

| Event | Feedback |
| --- | --- |
| Shot | A steam puff, an accelerating rise, squash on landing, soft "tock", light haptic |
| Merge | Neighbours slide into the target, target pops and changes colour, particle burst in its colour, "+value" floats up, rising pitch with value, haptic |
| Chain ≥ 2 | "Combo ×n!" banner, each step a little brighter and higher in pitch |
| Pressure full | The gauge lamps flash, a warning tick, a light haptic |
| Shake | The machine jolts; rows slide toward the centre in a staggered wave; every pair snaps with a mechanical "clunk"; the gauge empties; "Máy lắc ×n!" banner; a dust burst from the beam |
| Ship | The block rises into the chute, a gold burst and an "Xuất xưởng!" stamp; "+value" and a cash-register chime |
| Big merge (≥ 512) | Short camera shake (skipped with reduced motion) |
| Record | Confetti + fanfare |
| Jam | The rack dims, the safety lamp turns red, the loader stops, a paper ticket with the result |

Every animation step is short (under half a second) so the board stays readable; taps made meanwhile are remembered
(see *A shot*), so the game never ignores the player. With reduced motion the loader's block snaps into place, the
machine's jolt is a flash, and the rows still slide (the state must be readable).

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013):

- **Machine and board:** a warm cream machine with brass and dark rails in light; a warm-charcoal machine with copper
  and amber lamps in dark. Empty cells are a step lighter than the rack in light, a step lighter than the rack in
  dark. It switches at once when the hub changes theme mid-round.
- **Blocks:** in the player's [colour preset](#block-colours), the same in both themes, so a value keeps its colour.
- **HUD and cards:** the platform's design tokens, through the kit.
- **Safety line and pressure:** the safety line has a striped pattern and a lamp (never colour alone); the pressure
  lamps show empty/full by shape as well as colour.

## Block colours

Each player picks how the blocks look (**Cài đặt → Màu khối**), with the same five presets as Chạm Ghép, so the two games
still look like a family. The owner asked for them on 2026-10-15, after trying them in Chạm Ghép. The choice belongs
to the player: it is kept in the game's save, so it follows the profile to other devices, and a new player starts
with **Hoàng hôn**. Each game keeps its own choice (games do not share saves).

| Preset | Look |
| --- | --- |
| **Hoàng hôn** (default) | Warm and soft for small numbers, saturated and cool as they grow, so a glance at the board shows how far a game has come. |
| **Tương phản mạnh** | Two numbers in a row never share a hue: red, blue, yellow, green, purple, orange, pink, teal, then the same round again in other shades. |
| **Kẹo pastel** | Light, soft colours, a different hue for each number, dark text. |
| **Neon** | Bright, saturated colours with dark text; they stand out most on the dark board. |
| **Dễ phân biệt** | Built on the Okabe–Ito palette, which people with red–green colour blindness tell apart; numbers above 256 take its hues again, darker. |

- Every number is at least 4.5:1 on its block, in every preset (`palette.test.ts`).
- In every preset except Hoàng hôn, two numbers in a row are clearly different colours (`palette.test.ts`
  measures the distance between them).
- The champion block (64K and up) is the same in every preset: dark with gold digits, and a gold ring on the
  dark board.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | After every move: `{ best, game, tutorialSeen, run, palette, ranked?, challenge? }` where `game` is the full state (rack, current, next, score, pressure, shipped, PRNG), `run` its leaderboard id, `palette` the player's colour preset (also saved when it changes) and `ranked` the ranked run in progress — its id, seed and every column fired. Opening the game resumes it. |
| `scores` | A live run (ADR 0014): `session.run(id).update(score)` after each move that scores, so the account's board shows the game in progress; `finish(score)` at game over, or when the player starts a new game (an unfinished game keeps the best score it reached). One run id per game, kept in the save. |
| `ranked` | Every new game asks for a ranked run (ADR 0030) and waits up to 2.5 s: with one, the game plays from the server's seed and records each column fired; at game over, or when the player starts a new game, it hands the columns and the score in. Without one — offline, a guest — it plays unranked, as before. The verify module (`src/verify.ts` → `verify.js`) replays a run with `logic.ts` itself (`replayMoves`); its `bot` fires into a column the run's own PRNG picks. With `init.rankedReplay` (ADR 0032) the game plays a run back instead of a game (`src/replay.ts`), with the same `replayMoves`, so it shows the game the server judged. The shake is derived from the moves (it follows the merges), so a run stays a list of columns. |
| entries | `share` (ADR 0045): a challenge link opens a challenge game; "Thách bạn" and "Thách lại" ask the hub to share one (above). `v: 2` is this game; `v: 1` is the game before the machine and is unsupported. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of an unranked new game; a ranked one plays from the server's seed. |

## Invariants (checked by the random-play bot)

- After every move, no two orthogonally adjacent blocks have the same value.
- No hole above a block: every block rests on the ceiling or on another block (each column is full from the top
  down to its lowest block).
- The score never decreases; the board never holds more than 35 blocks.
- The pressure is an integer from 0 to 8; a shot that fills it always shakes; after a shake it is 0.
- The game is over exactly when every column has a block in row 0, after the shake has had its chance.
- A save restores an identical game: replaying the same shots from a restored state gives the same result.
- A game saved before version 2 is not restored; it starts a new game.

## Technology

Phaser 4 + `@tohe/game-kit` ([research](../../docs/research/game-tech.md)), pure logic in `src/logic.ts`
emitting events the view animates.
