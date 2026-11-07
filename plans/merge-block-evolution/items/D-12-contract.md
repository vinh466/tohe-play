# D-12 — The save, the ranked boundary and the contract

Status: open. Kind: decision.

## Question

What is saved for the new layers, what stays ranked and verifiable, and what contract/challenge
versions change?

## Facts

The classic state is `version: 2`; the ranked run is `{ seed, moves: number[] }` replayed by the
API with the game's own `logic.ts`/`verify.ts`; the scores/live run and the challenge `v: 2` are
platform-level; the game never calls the API. The new layers are Orders (goals + 1-of-3 parts), the
Workshop (scrap/XP/level/blueprints/cosmetics), the Daily (local seed/date/streak) and Zen (no
pressure/jam). See [R-04](../research/R-04-contract.md) for the full analysis.

## Recommendation

- **Save v3** with separate slots: `game` (classic, unchanged shape), `orders` (seed, orders,
  parts, scrap/XP, finished), `workshop` (scrap, XP, level, blueprints, cosmetics), `daily` (date,
  seed, score, streak, last day), `ranked` (classic only), `challenge` (today's slot). The v2→v3
  migration keeps the classic `game`/best/ranked/challenge and defaults the new slots; the v1 saves
  still start fresh.
- **Ranked**: the classic only; the Orders/Daily/Zen are **unranked** and labelled in the UI; the
  parts/stat sidegrades never touch the classic; cosmetics may apply everywhere (visual only).
- **Challenge**: keep `v: 2` for the classic; add `v: 3` for the daily share (`{ v: 3, seed, score,
  mode: 'daily', date }`); the entry handler accepts both (the daily validated; the date a claim).
- **Daily**: local seed from the local date; the logic pure (the date string passed in; no
  `Date.now`); the score/streak local; **no server board in 2.2**; a server daily board is a later
  plan with an ADR/API slice (a T3 change: a board id/period, a timezone, the verify).
- **Scores**: the classic live run `update`/`finish` unchanged; the Orders/Daily/Zen do not open a
  live run or submit to the server board in 2.1/2.2; the ticket's scrap/XP is local; a later
  leaderboard for the Orders needs the parts in the moves + the verifier (a contract/ADR).
- **Tests**: the classic's logic/bot/verify/replay/conformance/API unchanged; the Orders' logic
  (orders/parts) with its own tests/bot; the daily's seed/save/streak; the Workshop's save; the
  view's modes; the 320/light/dark screenshots; the API's ranked/replay tests still green.

## Options and costs

| Option | Ranked | The cost | The risk |
|---|---|---|---|
| **A. The recommendation** | Classic only; the new modes unranked | The save v3 + the UI labels + the tests | The Orders not on the family board |
| B. Orders ranked too | The parts in the moves; the verifier extended | A contract/ADR + a larger verifier + the balance | The ranked runs' integrity/complexity; the classic's board muddied |
| C. Daily server board | A day board + a timezone + the verify | An API/board slice + an ADR + the daily seed authority | The most platform work; the child/timezone/privacy |

## What would change my mind

- The family wants the Orders on the leaderboard: B, with the parts logged and the verifier
  extended; a T3 change; the classic could stay a separate board.
- The daily becomes the retention bet: C; the local daily is the cheap test first.
- The save v3 migration is too risky for the family's data: keep v2 and store the new modes in
  separate keys/fields with a version guard; the plan's D-12 decides.

## ADR

A contract/API change (B or C) needs an ADR; the recommendation (A) is the game's own save/entry
version, documented in `games/merge-block/SPEC.md` and the pages, with no platform contract change.
