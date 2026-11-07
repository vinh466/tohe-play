# D-11 — The funnel and retention telemetry

Status: open (blocked by D-05, D-06). Kind: decision.

## Question

Which events do the Orders, Workshop, Daily and the brand need so the owner can tell whether they
work, without surveillance or pressure on a child?

## Recommendation

Use the platform's telemetry (ADR 0015) with small, behavioural events, batched by the run:

- **The funnel**: `title.view`, `mode.start`/`mode.end`/`mode.left` (mode), `tutorial.beat` (1–4),
  `shot.first`, `merge.first`, `shake.first`, `ship.first`, `order.done` (index), `part.pick` (id),
  `run.end`/`run.ticket` (mode, score bucket, moves bucket, orders done), `workshop.view`,
  `part.buy` (id), `machine.level`, `daily.view`/`daily.start`/`daily.end`/`daily.streak`/
  `daily.share`. No names, no free text, no per-move logs.
- **The questions**: does a first run complete the four beats + the first order? do people return
  and open the Daily? which mode/part is chosen? does the Workshop's first purchase happen? the
  share rate? The targets: ≥70% first-run completion of the first order; ≥25% of first-run players
  open the Daily within a week (a first proposal; the owner can change).
- **The privacy/child**: the platform's opt-out; no personal data; the daily/streak is not a
  competition; no "streak lost" messages; the health report/console is the reading surface; the
  game's docs say what is collected.

## Options

1. **The full set above in the same slice** (recommended): the events are cheap and answer the next
   decision; the budget is small.
2. **A minimal set** (mode/run/order/daily): cheaper; misses the parts/workshop.
3. **No new telemetry**: the owner's playtest and the visible scores/ticket/leaderboard; the
   decisions rely on the family.

## Cost and risks

The event calls, the names, the docs, the budget (the platform's telemetry limits), the console/
report reading. The risk is over-instrumentation or a child's data; the small behavioural set and
the platform's rules avoid it. The brand's pull is measured by the hub/catalog/OG/share, not by the
game alone.

## What would change my mind

- The telemetry budget is too small: one `run.end` with the counts instead of per-order events.
- The owner prefers no new telemetry: 3; the plan's decisions then rest on the owner's playtest and
  the visible numbers.
