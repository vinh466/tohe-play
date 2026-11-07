# R-03 — UI/UX: one machine, one hand, 320 px

Status: research note for [D-06](../items/D-06-modes.md), [D-07](../items/D-07-first-screen.md),
[D-08](../items/D-08-ui-ux.md). Date: 2026-11-08.

## The question

The new layers (Orders, Workshop, Daily, Zen, a first-run) must feel like the same warm machine,
work at 320–430 px in one hand, in light/dark, for a child and an adult, without turning the title
into a wall of cards or the HUD into a dashboard.

## What the current game does well (keep)

- The title is one screen with one primary action and the tools in the thumb zone; the how-to is
  three picture hints; the play stage has a Menu, score, best, the machine and the loader; the
  quick panel holds the palette/sound/new game/menu; the game-over ticket; the replay bar.
- The kit's HUD, panel, cards, icons and tokens keep the family consistent (`docs/architecture/game-shell.md`,
  `docs/conventions/voice-and-look.md`, ADR 0019/0020/0049).
- The view already gives the pressure pips (hollow/full), the safety line (stripes + lamp +
  triangle), the aim/ghost, the merge preview, the reduced motion and the 320/390 layout.

## What the new layers need

**The title/mode select.** One primary: **Chơi tiếp** (if a run is in progress) or **Chơi** (the
classic/first-run). Below it, a short row of mode cards, not a grid of equal cards:
- **Cổ điển** — "Chơi mãi, tính điểm"; the current ranked game; a small "xếp hạng" mark.
- **Ca làm** — "3 đơn hàng, chọn 1 trong 3 phụ tùng"; the Orders; a progress ring (the last best).
- **Ca hôm nay** — the daily card with the date, the streak, the best today; a dot if unplayed; the
  "hôm nay" card is visually different (a stamp/date) so it reads as a ritual.
- **Thư giãn** — the Zen; a small leaf/moon; the "không áp lực" line.
Then the Workshop, the leaderboard, the settings, the how-to, the "Về Tò He". The **mark + wordmark**
at the top; the mascot can sit behind the primary card; the floating blocks stay subtle. At 320,
the cards stack vertically and the primary card is the first; the whole screen fits without scroll
(the four cards can be a 2×2 or a vertical list of compact rows; the primary + the daily are the
first two).

**The Orders HUD.** The order must be visible without covering the board:
- A slim **order rail** under the HUD (or on the top beam): the order icon/value ("Xuất 64"), the
  progress ("1/2"), the reward (the scrap), the next order's dot.
- On completion: a short **stamp** over the board ("Đơn 1 xong!"), the choice sheet (1 of 3) over
  the panel, then the next order; the player can keep the run.
- The parts' effects must be readable in the machine: the pressure tank shows the new max; the
  chute shows the ship value; the sorter shows the slide; the combo gear shows the multiplier. A
  small **part strip** beside the pressure gauge, not a second HUD.
- The classic has no order rail; the HUD stays as today.

**The Workshop.** A single screen, not a shop:
- The machine (the mascot) in the middle; the scrap counter; the blueprints as **three slots** at a
  time (not a list of 20); a tap opens a small card: what it does, the cost, the level.
- The machine levels (Tập sự → Kỹ sư) as a small plaque, not a battle pass; the XP from runs/orders.
- The cosmetics (the machine skin, the chute, the block palette) in a second tab; the palettes stay
  the player's existing setting.
- The stat sidegrades are **Orders-only** and labelled "chỉ trong Ca làm"; the classic is
  untouched. No timers, no energy, no purchase.
- The mobile: the machine at the top, the three slots in a row, the scrap and the level as pills;
  the thumb reaches the slots; the 320 fits.

**The Daily.** The title card is the door; the play is a normal run with a "Hôm nay" tag; the game
over has the date, the streak, the share; the title card shows the streak/ best. No calendar grid
in the first slice (a 7-day row is enough); the server board is later. The child sees a "Hôm nay"
stamp, not a countdown.

**The game over.** The ticket is the right shape; add the run's story: the mode, the orders done,
the blocks shipped, the biggest, the scrap, the XP/level, the parts taken; the primary "Chơi lại";
"Xưởng" (if scrap); "Thách bạn" (classic/daily); "Ca hôm nay" (if not played); "Menu chính". The
mascot's face reacts (proud/tired) — one expression, not an animation.

**Onboarding.** Four beats, each one action, not a modal wall:
1. Fire one block (the aim/ghost; the hand).
2. Merge one pair (the ring; the chain).
3. Fill the gauge to the shake (the gauge; the rows slide).
4. Ship one block (the chute; the first order: "Xuất một khối 16").
Then the choice sheet (the first part), the ticket and the Workshop unlock. The how-to's three
hints stay as the reference; the first-run is contextual and skippable; the child can replay it
from Cách chơi.

**The accessibility.** The new labels must not lean on colour: the order rail uses a value + a
progress shape; the daily uses a date stamp; the parts use an icon + a word; the gauge keeps the
hollow/full shapes; the safety line keeps the stripes/lamp/triangle. The canvas HUD gets ARIA
labels/roles for the score/order/next; the DOM HUD stays readable with large text; the reduced
motion still slides the rows but flashes the jolt; the haptics/sound have the settings. The 320
layout, the 360/390, the tablet and the phone-held-sideways (the game is portrait; the hub rotates
the app) are checked with screenshots.

**The brand.** The mark + wordmark at the title; the mark at the catalog; the lockup at the OG; the
badge (the 4→16 + gear + rail) on the ticket/daily card. The mascot's face in the title/OG; the
in-game reactions are a later polish (D-10).

## Recommendation

The first slice's UI: **the title with the four modes + Continue + the daily card**, the Orders
rail + the choice sheet, the Workshop's three slots + the level plaque, the daily card + the game
over story, the four-beat onboarding. The classic HUD stays. The stats/parts strip is a single
small row, not a dashboard. The a11y and 320 checks are part of the slice, not a later pass.

## Cost and risks

- The title/mode select and the four screens are a real layout job (the kit's components help);
  the 320 and the light/dark screenshots are the gate.
- The Orders HUD can crowd the top; the order rail must be one line + one value, or it moves to
  the top beam (the machine is already a HUD).
- The Workshop can read as a shop; the copy and the "no money/timers" design must be explicit.
- The onboarding can become a wall; four beats, one action each, skip/replay.

## What would change my mind

- The owner wants the classic as the only door: the title keeps the mode cards but the primary is
  Classic; the Orders/Daily are secondary (a "Ca làm" tab).
- The 320 title cannot hold four cards + Continue: the mode cards become a horizontal swipe with
  the primary above; the daily is the first card.
