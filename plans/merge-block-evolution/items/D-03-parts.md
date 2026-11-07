# D-03 — The in-run machine parts (1 of 3)

Status: open (blocked by D-02, D-12). Kind: decision.

## Question

After an order, the player picks one of three parts. Which parts, what do they change, are they
per-run or permanent, and how do they stay out of the ranked classic?

## The parts (a first menu)

| Part | Effect (Orders only) | Why it is fun |
|---|---|---|
| **Bình áp** (pressure tank) | +1 pressure max (9, 10) or +1 starting pressure | Bigger shakes, more often |
| **Cửa xưởng** (chute) | Ship value down one step (128, 64) | Earlier relief; the order goal easier |
| **Lò xo** (spring) | The shot lands one row higher (or the loader faster) | Reaches a gap; changes the geometry |
| **Máy sàng** (sorter) | The shake slides one row further / the rows compact twice | Bigger horizontal merges |
| **Nam châm** (magnet) | The next shot pulls the nearest equal block one cell | Sets up a merge |
| **Dầu bôi trơn** (lubricant) | The gauge fills faster (or the pulse threshold lower) | More shakes |
| **Bánh răng combo** (combo gear) | The combo multiplier +1 (or the pulse multiplier ×3) | Score runs |
| **Ray an toàn** (safety rail) | The safety line one row lower (an extra row) | A safety net |
| **Khoang phụ** (extra bay) | The feeder shows two next blocks (or a second current) | Planning |
| **Máy tách** (splitter) | A block splits into two halves, fired at two columns | A rescue/creative part |

## Options

1. **Per-run, 1 of 3 after each order, 3–5 orders** (recommended): the build is the run's identity;
   the next run starts fresh; the Workshop unlocks **blueprints** (which parts can appear) rather
   than permanent stats.
2. **Permanent upgrades** (the Workshop): the parts are bought and kept; every run gets stronger.
   More meta, but the balance and the classic fairness suffer.
3. **Choice at the start** (a loadout): the player picks 2 parts before the run; no mid-run
   choices. Less variety; more planning.
4. **No parts** (orders only): the run is the goals; the Workshop is cosmetic. The smallest slice.

## Recommendation

1, with the first **5–6 parts** in 2.1 (pressure tank, chute, sorter, magnet, lubricant, safety
rail), the rest in 2.2/2.3; per-run; **Orders only**; the classic never sees them; the Workshop's
blueprints unlock the **pool** (not the power). The parts are deterministic from the run's seed
(the choice is the player's, the offer is seeded) so the share/challenge can replay the same offers.
The parts' effects are shown on the machine (the gauge max, the chute value, the sorter, the rail)
and in the part strip.

## Cost and risks

The part state (the parts, the modifiers), the offer generation, the effects in the logic (the
pressure max, the ship value, the slide, the shot, the gauge), the HUD, the balance. The effects
must not make the run trivial or unreadable; the order set and the parts are a small roguelite and
need a bot/playtest. The per-run parts keep the classic clean.

## What would change my mind

- The family wants the meta to matter more: 2 (permanent) with a separate "workshop run" mode, not
  the classic.
- The parts are too much for the 3-minute run: 3 parts, no choice (the order offers one), or
  option 4.
