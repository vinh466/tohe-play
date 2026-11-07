# Plan — Lấp Ô: một lõi yên, một hành trình dài

- Goal: a calm 8 × 8 block puzzle with a deep core, a long journey, and a UI/UX that brings players back without
  pressure.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-08 · Branch: `plan/fill-blocks` · PR: [#190](https://github.com/vinh466/tohe-play/pull/190) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)
- Research: [R-01 market](research/R-01-block-puzzle-market.md) · [R-02 UX](research/R-02-ux-and-retention.md) ·
  [R-03 platform](research/R-03-platform-and-reuse.md) · [R-04 simulation](research/R-04-run-length-simulation.md)

## Next — one item

**Confirm the brief and D-01/D-03** (positioning + long-progression model). Everything else follows: journey
content, daily, UI, art, scope. The owner's answers unblock the map.

## Waiting on the owner

1. Direction: endless + journey + daily + mastery? [D-03](items/D-03-long-progression.md)
2. Age and promise: 3+ with assists or 6+? [D-01](items/D-01-positioning-and-age.md)
3. Combo and assists: soft decay, rescue/undo/hint? [D-02](items/D-02-core-loop.md)
4. Journey size for MVP: 18 or 36 levels? [D-04](items/D-04-journey-content.md)
5. Daily: local-first or platform? [D-05](items/D-05-daily-challenge.md)
6. Kit screens API: yes/no? [D-06](items/D-06-ui-and-shell.md) · [E-01](items/E-01-kit-screens.md)
7. Palette: 8 colours + shape or one colour per shape? [D-07](items/D-07-art-and-skins.md)
8. Phasing: what ships first? [D-08](items/D-08-scope-and-phasing.md)

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | [Positioning, age and promise](items/D-01-positioning-and-age.md) | decision | proposed | — |
| D-02 | [Core loop, combo and assists](items/D-02-core-loop.md) | decision | proposed | D-01 |
| D-03 | [Long progression model](items/D-03-long-progression.md) | decision | proposed | D-01 |
| D-04 | [Journey content and difficulty](items/D-04-journey-content.md) | decision | proposed | D-02, D-03 |
| D-05 | [Daily challenge and sharing](items/D-05-daily-challenge.md) | decision | proposed | D-03 |
| D-06 | [UI, shell and screens](items/D-06-ui-and-shell.md) | decision | proposed | D-02, D-03 |
| D-07 | [Art, palette and skins](items/D-07-art-and-skins.md) | decision | proposed | D-01 |
| D-08 | [Scope and phasing](items/D-08-scope-and-phasing.md) | decision | proposed | D-02…D-07 |
| E-01 | [Kit: custom screens](items/E-01-kit-screens.md) | enhancement | proposed | D-06 |
| E-02 | [Level validator and simulation](items/E-02-level-validator.md) | enhancement | proposed | D-04 |
| E-03 | [Save shape, ranked and daily platform](items/E-03-save-ranked-daily.md) | enhancement | proposed | D-02, D-05 |

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
