# Plan — Lấp Ô: một lõi yên, một hành trình dài

- Goal: a calm 8 × 8 block puzzle with a deep core, a long journey, and a UI/UX that brings players back without
  pressure.
- Phase: **Graduate** — the owner approved the recommended options on 2026-11-08 ("ok tốt nha, làm đi"); the game
  shipped in `prod-2026-11-08.4` (PR [#193](https://github.com/vinh466/tohe-play/pull/193)).
- Started: 2026-11-08 · Branch: `plan/fill-blocks` · PR: [#190](https://github.com/vinh466/tohe-play/pull/190) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)
- Research: [R-01 market](research/R-01-block-puzzle-market.md) · [R-02 UX](research/R-02-ux-and-retention.md) ·
  [R-03 platform](research/R-03-platform-and-reuse.md) · [R-04 simulation](research/R-04-run-length-simulation.md)

## Next — one item

**None — the game is built and released.** The plan is closed. Follow-ups outside this plan: ranked endless and a
platform daily board (V4), after a `maxMoves` simulation and PB-06.

## Waiting on the owner

Nothing. The owner approved the recommended options on 2026-11-08 and asked for a production release.

## Shipped

- **PR #193** — Lấp Ô, 18 journey levels, daily, stats, 15 achievements, 6 skins and the kit's `screens` API.
- **UAT** `uat-2026-11-08.4` — `pnpm check:uat` 20/20.
- **Production** `prod-2026-11-08.4` — `pnpm check:prod` 23/23; the game is the 6th catalog entry.
- Deviations: DOM + CSS instead of Phaser (a 64-button grid; 225 KB); the journey is a title tool + tabbed screens,
  not a second large title card (the title must fit 320×568); ranked and the platform daily board are deferred (V4).

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | [Positioning, age and promise](items/D-01-positioning-and-age.md) | decision | decided | — |
| D-02 | [Core loop, combo and assists](items/D-02-core-loop.md) | decision | decided | D-01 |
| D-03 | [Long progression model](items/D-03-long-progression.md) | decision | decided | D-01 |
| D-04 | [Journey content and difficulty](items/D-04-journey-content.md) | decision | decided | D-02, D-03 |
| D-05 | [Daily challenge and sharing](items/D-05-daily-challenge.md) | decision | decided | D-03 |
| D-06 | [UI, shell and screens](items/D-06-ui-and-shell.md) | decision | decided | D-02, D-03 |
| D-07 | [Art, palette and skins](items/D-07-art-and-skins.md) | decision | decided | D-01 |
| D-08 | [Scope and phasing](items/D-08-scope-and-phasing.md) | decision | decided | D-02…D-07 |
| E-01 | [Kit: custom screens](items/E-01-kit-screens.md) | enhancement | done | D-06 |
| E-02 | [Level validator and simulation](items/E-02-level-validator.md) | enhancement | done | D-04 |
| E-03 | [Save shape, ranked and daily platform](items/E-03-save-ranked-daily.md) | enhancement | done | D-02, D-05 |

## Graduation list — draft

| PR | Content | From | Needs |
|---|---|---|---|
| **V0** | Rewrite `games/fill-blocks/SPEC.md`; ADR for kit/contract changes; update docs | D-01…D-08 | Owner decisions |
| **V1** | Core: logic + tests + bot; endless; save/scores; HUD; juice; how-to; end card | D-02, D-08 | V0 |
| **V2** | Journey: 3 chapters × 6 levels; journey screen; stars; ranks; stats | D-03, D-04, E-01, E-02 | V1 |
| **V3** | Daily challenge; achievements; 6 skins; 3 more chapters | D-05, D-07 | V2 |
| **V4** | Ranked endless; platform daily board (PB-06); hub progress | E-03 | V3 |

## Not in this plan

- Online/PvP, level editor/UGC, ads/IAP/currency/energy/loot boxes, punishing streaks, countdowns, FOMO, a new
  engine, full 3D.
