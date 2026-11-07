# D-02 — The Orders run structure

Status: open (blocked by D-01). Kind: decision.

## Question

What is an Orders run: how many orders, what goals, how it ends, what it rewards, and how the
machine speaks?

## Options

1. **3–5 ship orders** (recommended): each order is a ship goal ("Xuất một khối 16", "Xuất hai
   khối 32", "Làm một khối 64"), escalating with the run; the run ends at the jam or when the
   player leaves; completing an order offers one part of three; the ticket counts them.
2. **Levels** (Number Shoot): each order is a separate short level with a goal block; a world map;
   stars; the run resets each level. More content work; a different feel (the "run" is gone).
3. **Endless missions** (X2 Blocks): a list of missions active in the classic; no separate run.
   Cheap, but the missions and the classic mix; the ranked boundary gets messy.
4. **Boss order**: a final big goal (a 512/1K) after the 3–5; the run's climax. A nice 2.3 addition;
   not the first slice.
5. **Shift complete**: the run can "clock out" after the last order (the player chooses to end and
   bank the scrap); the jam is still the fail. A family-friendly option; recommend it in 2.1.

## Recommendation

1 + 5: **3 orders in 2.1** (the run's first slice), a 4th/5th and the boss in 2.2/2.3; the order
goal is a **ship** (the game's own verb), not a new currency; the orders escalate with the largest
block the player has made; the run can clock out after the last order (a "Về xưởng" button) or
continue for score until the jam. The machine speaks one short line per order (warm, dry; the
mascot's voice in D-10). The Orders are **unranked**; the classic is the ranked mode.

## Discussion

- The current core's ship (256+) is a natural goal but too high for a first order; the 2.1 orders
  should use the **lower** ship threshold (16/32/64), with the 256+ as the big late goal (the
  parts can lower the ship value). The UI shows the order's value and the progress.
- The order set should be seeded from the run's seed so the challenge/share/daily can replay the
  same orders (D-12).

## Cost

The order state machine, the goal checks after each round/ship, the HUD rail, the completion/choice
sheet, the ticket, the tests. The main risk is the balance (the first order must be achievable in
~60–90 seconds; the third in 3–5 minutes).

## What would change my mind

- The first order is too easy/too hard in the playtest: tune the values/thresholds, not the shape.
- The family prefers a level map: option 2 becomes the next plan.
- The orders should be daily/weekly instead of per run: the daily (D-05) carries them.
