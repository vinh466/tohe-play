# D-02 — Core loop, combo and assists

**Status:** proposed · **Kind:** decision · **Blocked by:** D-01

## Question

Which rules and assists make the 8 × 8 core deep enough to play for months, and fair enough for a child?

## The baseline (current spec)

8 × 8, tray 3, no rotation, 1 point/cell, `10 × n²` per clear, streak ×2/×3… that resets on a non-clear,
perfect clear +300, helpful draw, game over when no tray piece fits. Tap-to-place and drag.
`games/fill-blocks/SPEC.md`.

## Options

### A — Keep the core, soften the combo, add three assists (recommended)

- **Combo**: a clear raises the multiplier by 1 (cap ×5); a non-clear lowers it by 1, floor ×1. A visible meter
  shows the next step. It rewards planning without a cliff.
- **Đổi khay** (rescue): once per run when no piece fits; reshuffles the tray. Earned at 1,000 points and by a
  perfect clear, max 2. No ads, no purchase.
- **Undo**: one step per journey level; disabled in endless/ranked.
- **Hint**: after 8 s idle, pulse one legal placement; can be turned off.
- **Helpful draw**: always on; at least one piece in a fresh tray fits while any shape fits.
- **Bag**: weighted small-early; at most one very large piece per early tray; large pieces appear as score grows.
- **Scoring** stays 1/cell + `10 × n²` × combo; perfect clear +300.

**Cost:** more logic/test cases (undo, rescue, hint state); ranked must record or disable assists; the combo
meter needs a clear UI.

### B — Pure spec: hard streak, no assists

- The current rules, no rescue/undo/hint. Sharper mastery, less friendly.
- A random child ends in ~15 moves (R-04); the end card is the only recovery.

### C — More radical: 9 × 9 boxes, rotation, timer, power-ups

- Closer to Woodoku/Block Blast's later modes.
- Rejects the "calm, no timer, no rotation" identity; much more rule/testing work. Not recommended.

## Recommendation

**A**. The core is proven; the change is about fairness and feel, not a new genre. Soft combo is a feel choice
(the simulation shows little score difference), and the three assists directly answer the "no undo / rigged"
criticisms in the genre. If the owner prefers a sharper game, keep hard reset and only the rescue; decide after
the first playtest.

## Invariants to keep

- A placement never overlaps or leaves the board.
- After a placement no row/column is full; every full line is cleared.
- Score never decreases and equals the rules.
- The tray holds 1–3 pieces; refill exactly when empty.
- The game is over exactly when no piece fits and no rescue is left.
- A save restores an identical game.
- Ranked replays the same moves to the same state.

## Evidence

- The genre's core: [R-01](../research/R-01-block-puzzle-market.md).
- Error prevention, undo, touch targets: [R-02](../research/R-02-ux-and-retention.md).
- Run-length simulation and the gentle bag: [R-04](../research/R-04-run-length-simulation.md).
- Existing rescue pattern: `games/tap-merge/src/logic.ts:331-374`.

## Discussion

**agent (2026-11-08):** recommend A. The hard/soft combo is a feel decision, not a balance one; soft is kinder
and still rewards chains. The rescue is the calm version of tap-merge's shuffle, not a monetised continue.
