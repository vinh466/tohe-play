# E-02 — Level validator and simulation

**Status:** done — shipped in `prod-2026-11-08.4` · **Kind:** enhancement · **Blocked by:** D-04

## What

A script that plays every journey level with a bot and reports:

- **Completable?** Does the primary goal pass within the move limit?
- **Stars**: which of the 3 goals pass; is 3 stars reachable?
- **Difficulty band**: moves/score, greedy vs random; a level too easy or impossible is flagged.
- **Seed sanity**: the same seed and moves produce the same result (the logic is pure).

Command: `pnpm --filter @tohe/game-fill-blocks simulate` or a script in `src/simulate.ts`, like tap-merge's
`simulate` (see `games/tap-merge/package.json`). The bot uses the game's own `logic.ts`, not a copy.

## Why

- 18–36 levels written by hand will contain impossible or trivial levels; a bot catches them before a player does.
- The same tool tunes the endless piece bag and the rank thresholds.
- The plan's simulation (R-04) is throwaway; the graduated game needs a repeatable one.
- It is the level-content equivalent of the random-play bot in the logic tests.

## How

- `simulate.ts` reads the level catalog, runs N seeded games per level with a simple greedy bot and a random bot,
  prints a table, and exits non-zero if a level is impossible or has no 3-star path.
- The bot is not shipped in the game bundle; it is a dev script. Tests can assert the table for a few levels.
- The tool can also run a level with a fixed move list for a replay check.
- Keep it small; do not build a level editor.

## Options

- **A — a `simulate` script + a test on the catalog (recommended).** Cheap, repeatable, catches impossible levels.
- **B — manual playtest only.** Slower, unreliable at 36 levels.
- **C — a full level editor.** Out of scope.

## Evidence

- Tap-merge's long-game simulation and tuning: `games/tap-merge/SPEC.md:107-141`.
- The simulation's method and caveats: [R-04](../research/R-04-run-length-simulation.md).
- Level data design: [D-04](../items/D-04-journey-content.md).

## Discussion

**agent (2026-11-08):** recommend A. A level without a bot pass is not ready to ship; the validator is part of
the content pipeline, not an optional extra.
