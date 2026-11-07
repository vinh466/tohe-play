# Plan — Ghép Khối: the evolution (orders, workshop, daily, brand)

- Goal: a next Ghép Khối that gives the family a reason to start a run and come back tomorrow — Orders, a light Workshop, a Daily Shift, Zen, a first screen and a brand mark that sell the machine — while the classic ranked run, its verifier and the platform's no-ads/no-IAP rules stay intact.
- Phase: **Close** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-08 · Branch: `plan/merge-block-evolution` · PR: [#191](https://github.com/vinh466/tohe-play/pull/191)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Log: [log.md](log.md)

## Closed — shipped in 3.0.0

The owner approved the whole recommendation on 2026-11-08 ("ok làm tất"), and the first slice landed as
`games/merge-block` **3.0.0**: the Máy Ghép mark, the title/mode select, Ca làm (orders and the four parts),
Ca hôm nay (local-date seed, streak and share), Thư giãn, the Xưởng (scrap, XP, rank, blueprints and the palette),
save v3, the daily `v: 3` entry, and the UI/UX pass. Cổ điển remains the only ranked mode and its replay is unchanged.

## Waiting on the owner

Nothing — the plan is closed.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | The next layer and its order | decision | done | — |
| D-02 | The Orders run structure | decision | done | D-01 |
| D-03 | In-run machine parts (1 of 3) | decision | done | D-02, D-12 |
| D-04 | The Workshop and its light meta | decision | done | D-01, D-12 |
| D-05 | The Daily Shift and its board | decision | done | D-01, D-12 |
| D-06 | The modes and the title/mode select | decision | done | D-01 |
| D-07 | The first screen and onboarding | decision | done | D-06, D-09 |
| D-08 | The UI/UX pass (HUD, Orders, Workshop, Daily, game over) | decision | done | D-02, D-04, D-05 |
| D-09 | The logo and brand system | decision | done | — |
| D-10 | The mascot "Máy Ghép" | decision | done | D-09 |
| D-11 | The funnel and retention telemetry | decision | done | D-05, D-06 |
| D-12 | The save/ranked/verify/contract shape | decision | done | — |
| D-13 | The phase split and the first slice | decision | done | D-01, D-02, D-04, D-09 |

## Graduation list

Filled in phase 4 (Converge): each ADR, doc change and pull request to write, in order, with the
items it comes from. Nothing yet — the plan is in Frame.
