# D-04 — Journey content and difficulty

**Status:** decided — owner approved the recommended option on 2026-11-08 ("ok tốt nha, làm đi") · **Kind:** decision · **Blocked by:** D-02, D-03

## Question

How many levels, what goals, and how do we keep every level fair and fun?

## Shape

- **Chapters** are paper pages with a piece-set flavour:
  1. **Giấy** — small pieces, generous goals; place, clear, combo.
  2. **Mực** — L/T/S/Z; two-line clears.
  3. **Gấc** — 4-cell pieces; precision and combo.
  4. **Nghệ** — 3 × 3 and 5-cell pieces; board management.
  5. **Lá** — blocked cells / board shapes; planning.
  6. **Đêm** — mixed mastery; hardest goals.
- **Levels** are 6 per chapter. **MVP: 3 chapters × 6 = 18**; full journey: **6 × 6 = 36**. A later 6 × 8 = 48
  is possible if the content is cheap and the validator keeps quality.
- A level is data: `id`, `chapter`, `seed`, `pieceSet`, `boardMask`, `goals`, `starThresholds`, `intro`.
- **3 goals per level**, 3 stars: one star per goal, or 1 for completion + 2 for the harder goals. Recommended:
  1 star for completing the primary goal; 2 for the secondary; 3 for all three. A missed goal says which one.
- **Goals** (readable, icon + number): reach a score; clear N lines; clear 2+ lines in one move; make a perfect
  clear; finish within N moves; keep the board below X% full; clear a line using a given piece.
- **Fixed seed** per level, so every player gets the same pieces and a retry is fair. The endless mode mixes the
  daily seed with a run counter (E-03).
- **No energy**: replay any level, any number of times.

## Difficulty

- The first 3 levels teach: place, clear, two-line clear. No reading required; a pointing hand/pulse.
- A level's difficulty band comes from the validator (E-02): a bot plays the level, reports moves/score/stars and
  whether it is completable. Target: the greedy bot completes the primary goal in 60–90% of runs, and the
  perfect play gets 3 stars; a level the bot cannot complete is a bug.
- Later chapters add one new idea at a time, not five.
- The journey is optional; a player who only wants endless never sees it.

## Options

- **A — 18 levels for V2, 36 for V3 (recommended).** Ship the core + a real journey sooner; add chapters 4–6
  after the first playtest.
- **B — 36 levels in V2.** More content up front; more design/validation before the core is tested.
- **C — 48 levels in V2.** Too much for the first release; risk of filler levels.

## Recommendation

**A**. Content is cheap to add as data, but each level needs a design + validation pass; 18 is enough to prove
the journey and the shell screen, then 18 more in V3.

## Evidence

- Adventure levels with 1–3 stars are the genre's strongest long-progression pattern:
  [R-01](../research/R-01-block-puzzle-market.md).
- The simulation's run length (20–50 moves for 1–3 minutes) sets the goal window:
  [R-04](../research/R-04-run-length-simulation.md).
- Content-as-data pattern: `games/vuon-rau/src/content/`, `packages/game-kit/src/content/index.ts:28-118`.

## Discussion

**agent (2026-11-08):** recommend 18 for V2. A level that cannot be validated by a bot is not ready; the
validator is part of the content pipeline, not an optional tool.
