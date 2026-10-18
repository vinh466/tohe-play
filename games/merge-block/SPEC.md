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

The kit's two stages, quick panel and HUD ([Game shell](../../docs/architecture/game-shell.md), ADR 0020); this game
brings its content:

1. **Title screen** (the menu stage, every time the game opens, no board running): 🧱 **Ghép Khối** over drifting
   blocks, the chip "Ván đang chơi dở: n điểm. · 👑 Kỷ lục m", **▶ Chơi** or **▶ Chơi tiếp** and **🔄 Ván mới**
   (asks first; the run ends); tools 🔊 ⚙️ 🏆 (signed-in players) ❓; **← Về Tò He** last, under the tools. **⚙️ Cài đặt**:
   🔊 and **🎨 Màu khối** — one row per [preset](#block-colours), with its name and sample blocks 2 … 256 in its
   colours. **❓ Cách chơi**: the three picture hints.
2. **How to play** (before the first **Chơi** only): three picture hints — tap a column; equal blocks merge; chains
   multiply points. **▶ Bắt đầu** starts, and the first move shows a pulsing hint over the columns.
3. **Playing** (the play stage, created on play from the save): the kit's HUD — ☰, score (counts up), the next
   block, best (lights up 👑 once the score passes it); the board with the current block above it.
4. **Quick panel** (☰, phone Back, Esc, or the hub hiding the game): **▶ Tiếp tục**; 🔊 Âm thanh as a switch;
   **🎨 Màu khối · (the preset) ›**, which opens the presets with their sample blocks over the panel — a tap repaints
   the board, the current block and the next block behind it at once, **Quay lại** returns to the panel; 🔄 Ván mới (asks) · ❓ Cách chơi · 🏠 Menu chính (saves; the title then offers Chơi tiếp).
5. **Game over:** board dims and settles, card with score/best, confetti for a record, **▶ Chơi lại**, **🏠 Menu
   chính**; Back goes to the title screen.

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
- **Blocks:** in the player's [colour preset](#block-colours), the same in both themes, so a value keeps its colour.
- **HUD and cards:** the platform's design tokens, through the kit.

## Block colours

Each player picks how the blocks look (**⚙️ Cài đặt → Màu khối**), with the same five presets as Chạm Ghép, so the two games
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
| `save` | After every move: `{ best, game, tutorialSeen, run, palette, ranked? }` where `game` is the full state (board, current, next, score, PRNG), `run` its leaderboard id, `palette` the player's colour preset (also saved when it changes) and `ranked` the ranked run in progress — its id, seed and every column dropped. Opening the game resumes it. |
| `scores` | A live run (ADR 0014): `session.run(id).update(score)` after each move that scores, so the account's board shows the game in progress; `finish(score)` at game over, or when the player starts a new game (an unfinished game keeps the best score it reached). One run id per game, kept in the save. |
| `ranked` | Every new game asks for a ranked run (ADR 0030) and waits up to 2.5 s: with one, the game plays from the server's seed and records each column dropped; at game over, or when the player starts a new game, it hands the columns and the score in. Without one — offline, a guest — it plays unranked, as before. The verify module (`src/verify.ts` → `verify.js`) replays a run with `logic.ts` itself; its `bot` drops into a column the run's own PRNG picks. |
| settings | Respects `muted`; follows `theme`. |
| seed | Seeds the PRNG of an unranked new game; a ranked one plays from the server's seed. |

## Invariants (checked by the random-play bot)

- After every move, no two orthogonally adjacent blocks have the same value.
- No hole under a block (every block rests on the floor or on another block).
- The score never decreases; the board never holds more than 35 blocks.
- The game is over exactly when every column is full.
- A save restores an identical game: replaying the same moves from a restored state gives the same result.

## Technology

Phaser 4 + `@tohe/game-kit` ([research](../../docs/research/game-tech.md)), pure logic in `src/logic.ts`
emitting events the view animates.
