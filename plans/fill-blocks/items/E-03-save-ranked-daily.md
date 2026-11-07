# E-03 — Save shape, ranked and daily platform

**Status:** done — the save shape and the local daily shipped in `prod-2026-11-08.4`; ranked and the platform daily board are deferred to V4. · **Kind:** enhancement · **Blocked by:** D-02, D-05

## What

The storage and platform details that a deeper Lấp Ô needs:

1. **Save shape** (≤ 64 KB), versioned:
   `{ v, best, game, tutorialSeen, run, journey, daily, stats, achievements, settings, ranked? }`.
   - `game`: board, tray, score, combo, PRNG, moves (compact).
   - `journey`: completed levels, stars per level, unlocked chapters.
   - `daily`: last date, result, stamps.
   - `stats`: games, total score, lines, best combo, perfect clears.
   - `achievements`: ids earned.
   - `settings`: palette, skin, hint/reduced-motion preferences.
2. **Seed handling**: the daily uses the raw `session.seed` (`YYYYMMDD`); endless mixes it with a run counter (or
   the previous RNG) so "Chơi lại" is a new board.
3. **Ranked**: not in MVP. Add in V4 only after `simulate` shows runs end within `maxMoves`; keep compact move
   codes; disable undo/rescue in ranked or record them.
4. **Daily platform**: PB-06 later — a server daily seed/board and a card on the shelf; needs an ADR, API and hub
   UI. The local daily is V3.
5. **Hub progress**: V1–V3 show progress in-game; the hub's "Tôi" shows only best for 3 recent games. A journey
   progress surface is V4 platform work.

## Why

- 64 KB is enough for journey/stats/achievements but not for unbounded ranked moves.
- `session.seed` is already the daily seed; reusing it naively would replay the same board on restart.
- Daily fairness (local clock, separate board) and ranked fairness (maxMoves, replay) are different problems;
  do not mix them.
- Cross-device sync works for account profiles only; device profiles stay local. The save shape must survive
  last-write-wins.

## Options

- **A — game-local save + local daily + no ranked in MVP (recommended).** Fast, self-contained, honest.
- **B — full platform now.** PB-06 + per-level boards + hub achievements; needs an ADR/API/UI and delays the game.
- **C — no persistence beyond the current run.** Loses the long progression; reject.

## Risks

- Save migration: a version field and a migration test; a save that cannot be read starts a new game.
- 64 KB with a long ranked run: compact moves, cap, and do not store a full board snapshot per move.
- Daily clock: local date can be changed; the stamp is personal, not a competition.
- Ranked `maxMoves`: simulate; if a human can exceed it, do not declare `ranked`.
- Conformance: `verify` must run with `Math.random`/`Date.now` throwing and a bot that ends or hits `maxMoves`.

## Evidence

- Save/score/ranked/seed facts: [R-03](../research/R-03-platform-and-reuse.md).
- Daily seed and PB-06: `apps/hub/src/launcher/manifest.ts:56-58`,
  `docs/roadmap/product-backlog.md`.
- 64 KB and ranked limits: `packages/contract/src/protocol.ts:15`,
  `services/api/src/Tohe.Api/Modules/Integrity/RankedRuns.cs:108-146`.
- Simulation's max moves: [R-04](../research/R-04-run-length-simulation.md).

## Discussion

**agent (2026-11-08):** recommend A. The plan should not let ranked/platform work delay the core; the save shape
should be designed now so V4 does not need a breaking migration.
