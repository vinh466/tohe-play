# Ghép Khối (`merge-block`) — spec (3.0.0)

Fire numbered blocks up into a rack that hangs from the ceiling; equal blocks that touch merge into bigger
numbers. The machine above the rack shakes when its pressure is full: every row slides toward the centre, and the
blocks that meet merge in a chain. Build a big block and let it leave through the top chute before the rack reaches
the loader. **Four ways to play** — the endless **Cổ điển**, the **Ca làm** orders, the **Ca hôm nay** daily and the
free **Thư giãn** — with a light **Xưởng** that keeps what the family earns.

The core (2.0.1) is unchanged in every mode: the same machine, physics and aim.

## Modes

| Mode | The run | Ranked | Saved | Best |
| --- | --- | --- | --- | --- |
| **Cổ điển** | The endless 2.0.1 game; the jam ends it | **Yes** (the classic ranked run) | `game` | `best` |
| **Ca làm** | 3 orders from the machine, a 1-of-3 part after each; the jam or **Về xưởng** (clock out) ends it | No | `orders` | `bests.orders` |
| **Ca hôm nay** | One classic run on a seed from the **local date**; a streak; share | No (local) | `daily` | `bests.daily` + `daily.best` |
| **Thư giãn** | The classic without pressure or the jam; the player leaves by choice | No | not saved | none |

The **title screen** (the shell) has one primary (Chơi tiếp / Chơi) and the tools; with a run in progress its second
action is **Chế độ**, which opens the mode hub without ending anything. The **mode select** is a screen of the menu
stage: the four modes, the **Xưởng**, the day's **Ca hôm nay** card (the date, the streak, the best), and the
classic's ranked mark. A mode with a saved run leads with **Chơi tiếp · điểm**; its **Ván mới** (Ca mới for the
daily) is a small second action behind a confirmation, so one mode can be restarted without touching the others. It
opens from Chơi with no run, from the title's **Chế độ**, from the panel's **Đổi chế độ**, and from the ticket's
**Đổi chế độ**; Back returns to the title or the panel, never into a dead end. A challenge link opens its challenge
at once.

## The board and the shot (unchanged)

- **5 columns × 7 rows.** Row 0 is the bottom, row 6 the ceiling. The rack hangs from the ceiling.
- The **loader** under the rack: the current block in its breech, the next on the feeder. The pressure gauge on
  the beam, the safety line under the rack, the chute at the top.
- A drag (or tap) fires the current block up its column; it lands in the cell just below the lowest block, or at
  the ceiling in an empty column. A column with a block in row 0 is blocked (clunk, no shot).
- Merge: every orthogonal equal neighbour is absorbed; absorbing *k* multiplies the value by 2^k. Gravity pulls
  the rack **up**; chains repeat; each round is a combo. A block takes part in at most one merge in a round.
- Score: the resulting value × the combo × the mode's multiplier.
- **Pressure**: each merge in a shot adds the mode's gain (1, or 2 with **Dầu**); at the gauge's max (8, or 10
  with **Bình áp**) the machine shakes: rows slide to the centre, equal pairs merge ×2 (×3 with **Bánh răng**),
  ships happen, gravity up; the gauge resets.
- **Ship**: a block at the ceiling of the mode's ship value or more leaves for value × 3; the rack pulls up.
  In Cổ điển/Ca hôm nay/Thư giãn the ship value is **256** (2^8). In Ca làm it is the **current order's value**
  (16, 32, 64), lowered by **Cửa xưởng**, so the orders can be shipped; after the last order it is 256 again.
- The jam: every column has a block in row 0 at the end of a shot and its shake → over (Cổ điển/Ca làm/Ca hôm
  nay); Thư giãn never jams.

## Ca làm — the orders

- **Three orders**, seeded with the run: **ship a 16**, **ship two 32s**, **ship a 64**. The order rail shows the
  current goal, the progress and the reward; the ship threshold is the current order's value, so the player can
  ship early.
- When an order completes, the run pauses and offers **1 of 3 parts** from the unlocked blueprints (repeats are
  allowed while fewer than 3 are unlocked). The part applies at once and lasts the run; the next order begins.
- After the third order the player can keep playing for score or press **Về xưởng** to bank the run; the jam still
  ends it.
- Rewards: each order gives scrap (4/6/10) and scrap comes from the shipped blocks (value/16, at least 1); XP is
  the run's score/100 at the end. The ticket prints the orders, the shipped, the scrap, the XP.
- The run is **unranked**; no live score run, no server board. The parts never appear in Cổ điển.

### The parts (first set)

| Part | Effect (Ca làm only) |
| --- | --- |
| **Bình áp** | +2 pressure max (the gauge 10) |
| **Cửa xưởng** | the ship value one step lower |
| **Dầu** | +1 pressure per merge |
| **Bánh răng** | the shake's score multiplier +1 (×3) |

The Workshop starts with **Bình áp** and **Cửa xưởng** unlocked; **Dầu** and **Bánh răng** cost scrap.

## Xưởng — the light meta

- **Scrap** is earned by playing (the ships, the orders, the daily); it is never bought. **XP** (the run's
  score/100) raises the machine's level: **Tập sự, Thợ phụ, Thợ chính, Trưởng ca, Kỹ sư, Bậc thầy**
  (0/40/120/280/560/1000).
- The Workshop shows the machine, the scrap, the level, the **blueprints** (the four parts, the two to buy), and
  the **cosmetics** (the block colours — the existing preset picker; the machine level's plaque/stamp). No timers,
  no energy, no purchase.
- The blueprints decide which parts the Ca làm offers; the parts themselves are per run. The cosmetics never
  change the rules; the stat parts never appear in Cổ điển or Ca hôm nay.

## Ca hôm nay — the daily

- The seed is derived from the **local date** at the start (`YYYY-MM-DD` → a 32-bit seed); everyone who plays that
  local day gets the same blocks. The logic is pure; the stage passes the date and seed in.
- A **streak** counts consecutive local days started (the save's `lastDay`); the card shows the date, the streak,
  the best today; the game over shows the date/streak and **Chia sẻ**.
- The share is the entry **`v: 3`**: `{ v: 3, seed, score, date, mode: "daily" }`; opening it starts a same-seed
  challenge (a normal score, never ranked). The date is the sender's local date, shown as a claim.
- The daily is unranked and local; no server board in 3.0.0.

## Thư giãn

The same rack, no pressure, no jam, no score run, no save; the aim/merge/ship for the joy of it; leaves by choice.
If the rack fills, the game offers **Ván mới** / **Đổi chế độ**; nothing is recorded.

## The classic, ranked and the challenge

- **Cổ điển** is the ranked game: the server deals the seed, records the columns, replays them with this logic
  (`verify.js`); the pressure/shake/ships derive from the state. The mode-specific fields are absent.
- **Thách bạn** keeps the `v: 2` classic challenge (`{ v: 2, seed, score }`); the daily share adds `v: 3`. The
  entry handler answers `unsupported` for a newer version, `invalid` for a malformed one.

## Screens

1. **Title** (the menu stage, every open): the **mascot mark** (Máy Ghép) and **Ghép Khối** over drifting blocks;
   the chip "Ván đang chơi dở: …" (the mode + score) or the best; **Chơi / Chơi tiếp**, **Ván mới**; tools Âm
   thanh, Cài đặt (Màu khối, **Xưởng**), Xếp hạng (signed-in) and Cách chơi; **Về Tò He** last.
2. **Mode select** (a menu-stage hub): the four modes + the Workshop; the daily card; the ranked mark on Cổ điển;
   the first run defaults to **Ca làm**. A saved run leads with **Chơi tiếp**; **Ván mới** is a smaller action with
   a confirmation. Back goes to the title, or to the panel when it was opened from a run. The Workshop opens over
   it and Back returns to the modes.
3. **Playing**: the kit's HUD — Menu, score, best (the mode's) — the **order rail** (Ca làm) or the daily/zen tag,
   the **part strip**; the machine: the gauge (8–10 lamps, hollow/full), the rack, the safety line, the chute,
   the loader/feeder, the aim/ghost/merge preview.
4. **Choice sheet** (after an order): 1 of 3 parts, each with an icon/name/one line; the chosen part is applied;
   the next order.
5. **Workshop** (title's Cài đặt and the mode select/game over): the machine, the scrap, the level, the four
   blueprints (buy), the block colours, a short "no timers/no money" line.
6. **Game over**: the ticket — the mode, the score/best, the orders, the shipped, the scrap, the XP/level; a record
   if it is one; **Chơi lại**, **Đổi chế độ**, **Xưởng** (if scrap), **Thách bạn** (classic/daily), **Menu chính**;
   the jam or the clock-out.
7. **Quick panel**: Tiếp tục; Âm thanh; **Đổi chế độ** (the mode hub); Màu khối; Xưởng; **Ván mới** (the current
   mode, asked first); Cách chơi; Menu chính.
8. **Watching a ranked run** (the admin console, ADR 0032): the classic replay, unchanged: Menu, score, Nước n/m;
   the slider/Lùi/Phát-Dừng/Tới, the speeds; the panel; Thoát xem lại.

## Onboarding

Before the first Chơi: the three picture hints (drag/merge/shake) + the first order. The first run defaults to
Ca làm: the hand at the loader, the first shot, the merge preview, the gauge filling to the first shake, the
first ship → the first order → the choice sheet → the Workshop. The how-to stays available in Cách chơi. A
returning player sees no onboarding; a child can replay the how-to.

## Feel, themes, block colours, accessibility

The 2.0.1 feel stays: shot/steam, merge/pop, chain banner, pressure flash/click, the shake (rows, dust,
KA-CHUNK), the gold ship, the record confetti, the jam ticket. The parts add their own cues (the gauge's max,
the chute's value, the combo, the lubricant). Light/dark follow the hub; the machine frame, gauge (hollow/full
by shape), safety line (stripes + lamp + triangle), the order rail (a value + a progress shape), the daily date
stamp and the parts (icon + word) never rely on colour alone. Reduced motion: the loader snaps, the machine's
jolt is a flash, the rows still slide. The five block-colour presets stay the player's; the brand's mascot mark
is the game's own.

## Brand

The game's mark is **Máy Ghép**, the machine as a character: a block-shaped head (the 16 as its face plate), two
pressure-gauge eyes, a chute mouth, gear ears, the loader rail. **Ghép Khối** is the wordmark (the platform's
type); the 4→16 + gear + rail is the machine's **badge** (the ticket, the daily card, the OG corner). The mark
is the icon/catalog/favicon, the title, the game over, the Workshop and the OG; it is readable at 32, 96, 192,
512 and 1200×630, light/dark and monochrome, and can animate the eyes in the title/OG (CSS/SVG; the menu stage
has no canvas, ADR 0020).

## Save, contract and invariants

| Capability | Use |
| --- | --- |
| `save` | `{ best, bests, game, orders, tutorialSeen, run, palette, ranked?, challenge?, workshop?, daily?, last }`. `game` is the Cổ điển state; `orders` the Ca làm state; `daily` the day/streak/best; `workshop` the scrap/XP/level/blueprints; `ranked` the classic run; `challenge` the last link; `last` the mode the title's Chơi tiếp resumes first. A v2 save upgrades its classic `game` to v3; v1 starts fresh. |
| `scores` | The classic live score run (update/finish) as today. The Ca làm/Ca hôm nay/Thư giãn do **not** open a live run or a server board; they are local. The challenge keeps its normal score run (never ranked). |
| `ranked` | Cổ điển only: the server's seed, the columns, the verify/replay. The new modes' states/parts are not in the ranked run. |
| `entries` | `share`: the v2 classic challenge and the v3 daily challenge; the shell answers `unsupported` for newer versions, `invalid` malformed. |
| `settings` | `muted`; the theme; the block palette. |

Invariants (the bot/unit tests): no equal orthogonal neighbours after a move; no hole above a block; the score
never decreases; ≤35 blocks; the pressure 0…the mode's max, the shake resets it; the game over at the jam for
Cổ điển/Ca làm/Ca hôm nay, never for Thư giãn; the orders complete exactly on their ships; the choice blocks the
next shot until a part is chosen; a save restores the same state (v3); the classic replay/verify unchanged. Each
mode keeps one run: moving to another mode saves the old one (its ranked run keeps recording if it is Cổ điển), a
new run of a mode replaces that mode's run behind a confirmation, and a run with no shots is not offered for resume.

## Technology

Phaser 4 + `@tohe/game-kit`; pure logic in `src/logic.ts` (the modes/orders/parts included, no DOM/timers/
random), the view animates the events; the app/save/daily in `src/app.ts`, the Workshop in `src/workshop.ts` and the pre-play mode screen in `src/modes.ts`;
the menu stage in `src/main.ts`, the play/mode select/choice/workshop/game over in `src/stage.ts`, the replay in
`src/replay.ts`.
