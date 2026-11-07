# Plan — Ghép Khối: the evolution (orders, workshop, daily, brand)

- Goal: a next Ghép Khối that gives the family a reason to start a run and come back tomorrow — Orders, a light Workshop, a Daily Shift, Zen, a first screen and a brand mark that sell the machine — while the classic ranked run, its verifier and the platform's no-ads/no-IAP rules stay intact.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-08 · Branch: `plan/merge-block-evolution` · PR: [#191](https://github.com/vinh466/tohe-play/pull/191)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Log: [log.md](log.md)

## Next — one item

**D-01 — the next layer and its order.** The owner's priority decides whether the first slice is
Orders + Workshop, the Daily Shift, or the brand first. Research is in
[research/R-01](research/R-01-modes-and-progression.md) and [research/R-02](research/R-02-brand-and-logo.md);
the recommendation is brand + Orders + Workshop (light) first, then Daily, then Zen.

## Waiting on the owner

1. **D-01** — which layer is the first slice, and how much of it (the recommendation is in the item).
2. **D-09 / D-10** — the logo direction: mascot + wordmark (recommended), symbol only, or wordmark only; and whether the mascot appears in the title/UI.
3. **D-05** — the Daily: a local date seed and a share/streak now, a server board later; or a server board in the first slice (contract + API).
4. **D-13** — the phase split: 2.1 brand + Orders + Workshop, 2.2 Daily + achievements + telemetry, 2.3 mascot + cosmetics + Zen, 3.0 versus? Or different.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | The next layer and its order | decision | proposed | — |
| D-02 | The Orders run structure | decision | open | D-01 |
| D-03 | In-run machine parts (1 of 3) | decision | open | D-02, D-12 |
| D-04 | The Workshop and its light meta | decision | open | D-01, D-12 |
| D-05 | The Daily Shift and its board | decision | open | D-01, D-12 |
| D-06 | The modes and the title/mode select | decision | open | D-01 |
| D-07 | The first screen and onboarding | decision | open | D-06, D-09 |
| D-08 | The UI/UX pass (HUD, Orders, Workshop, Daily, game over) | decision | open | D-02, D-04, D-05 |
| D-09 | The logo and brand system | decision | proposed | — |
| D-10 | The mascot "Máy Ghép" | decision | open | D-09 |
| D-11 | The funnel and retention telemetry | decision | open | D-05, D-06 |
| D-12 | The save/ranked/verify/contract shape | decision | open | — |
| D-13 | The phase split and the first slice | decision | open | D-01, D-02, D-04, D-09 |

## Graduation list

Filled in phase 4 (Converge): each ADR, doc change and pull request to write, in order, with the
items it comes from. Nothing yet — the plan is in Frame.
