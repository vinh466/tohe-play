# D-08 — Scope and phasing

**Status:** decided — owner approved the recommended option on 2026-11-08 ("ok tốt nha, làm đi"). V1–V3 shipped in `prod-2026-11-08.4`; V4 (ranked, platform daily) deferred. · **Kind:** decision · **Blocked by:** D-02…D-07

## Question

What ships first, and what is deliberately later?

## Options

### A — Four small releases (recommended)

| Release | Content | Why |
|---|---|---|
| **V0** | Spec rewrite + ADR/docs | Rules and decisions written before code |
| **V1** | Core + endless + save/scores + how-to + end card | The pure game, shippable and testable |
| **V2** | Journey 3 × 6 + journey screen + stars + ranks + stats | The long progression |
| **V3** | Daily + achievements + 6 skins + 3 more chapters | The return loop and expression |
| **V4** | Ranked endless + platform daily board + hub progress | Competitive/platform, after data |

**Cost:** four PR sets; the core is tested before the meta layer. The owner sees a playable game after V1.

### B — Big bang

- All features in one release. Faster on paper, but the core is not tested until the meta is built; a weak core
  hides behind content. High risk.

### C — Endless only

- The current spec. Meets the smallest scope, but not the owner's "tiến trình dài" ask.

## Recommendation

**A**. Ship V1 as soon as the core is fun; then V2 proves the journey; V3 adds the daily/achievements; V4 is
platform work with its own ADR.

## Effort (rough, agent time)

- **V1**: 1–2 weeks — logic/tests/bot, view, save/scores, how-to, end card, conformance, public pages.
- **V2**: 1–2 weeks — 18 levels + validator, journey screen (kit), stars, ranks, stats.
- **V3**: ~1 week — daily, 15 achievements, 6 skins, 18 more levels.
- **V4**: platform work — ranked simulation, PB-06 ADR/API/UI.

The estimates assume the kit screens API is available; if the kit change is delayed, V2 slips.

## What "done" means for V1

- `pnpm verify` green; conformance pass; 8 × 8 on a phone in light/dark, portrait and desktop.
- Save after every placement; resume exact; end card with retry.
- Public pages `/games/fill-blocks/` and `/en/games/fill-blocks/`.
- The owner plays it and says the core is fun. If not, stop before V2.

## Evidence

- The core loop is the product; the genre's meta layers only work on a good core:
  [R-01](../research/R-01-block-puzzle-market.md).
- The kit change and level validator are the two technical costs: [E-01](../items/E-01-kit-screens.md),
  [E-02](../items/E-02-level-validator.md).

## Discussion

**agent (2026-11-08):** recommend A. The plan should protect the core from the meta; V1 is a real game, not a
demo. The owner's "long progression" is V2/V3, but it must not delay the first playable.
