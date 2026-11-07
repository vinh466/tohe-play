# R-05 — The funnel, the retention and the telemetry

Status: research note for [D-11](../items/D-11-telemetry.md). Date: 2026-11-08.

## The question

The new layers (Orders, Workshop, Daily, Zen, the brand) need an honest way to know whether they
work — for the family, the owner and the next decision — without turning the game into
surveillance or putting pressure on a child.

## What the platform already has

- The game reports through the kit's telemetry (`session.telemetry`, ADR 0015); the events are
  batched by the SDK; the console and the telemetry report (`pnpm --filter @tohe/telemetry-report`)
  read them; the `health-report` skill summarises the device/health signals. The game never calls
  the API. The data is opt-out, no personal data, a child's profile is handled by the platform.
- The scores/ranked/live run give the score side; the save gives the local state; the challenge
  gives the shares.

## The events that answer the questions

Name them by **what the player did**, not by the internals:

| Question | Event(s) |
|---|---|
| Did a newcomer start? | `session`/first app open (platform), `title.view`, `mode.start` (classic/orders/daily/zen) |
| Did they learn the core? | `tutorial.beat` (1–4), `shot.first`, `merge.first`, `shake.first`, `ship.first` |
| Did the first run finish? | `run.end` (mode, score, moves, over/left), `order.done` (index), `run.ticket` |
| Do they come back? | `daily.view`, `daily.start`, `daily.end`, `daily.streak` (the day count), `title.view` on a return |
| Which mode? | `mode.start`/`mode.end`/`mode.left` (mode) |
| Is the Workshop used? | `workshop.view`, `part.buy` (id, cost), `machine.level`, `cosmetic.equip` |
| Is the Daily a habit? | `daily.streak`, `daily.share`, `daily.end` |
| Is the brand pulling? | the catalog/OG clicks are the hub's (platform), the game's `title.view`/`share`; a share's `entry.open` |
| Is the run too long/short? | `run.end` (moves, duration bucket), `run.left` (at which order) |
| Is a part too strong/weak? | `part.pick` (id, at order), `run.end` (the build) |
| Is the child safe? | no personal data; the platform's child handling; a daily/streak must not become a "streak lost" pressure |

Keep the event payloads small: the mode, the order index, the part id, the score bucket, the
duration bucket, the streak bucket. No names, no free text, no per-move logs. The classic's
existing score/ranked data is separate.

## The funnel (first slice)

```
title.view → mode.start (classic | orders | daily | zen)
  → tutorial.beat 1..4 (newcomer)
  → shot.first → merge.first → shake.first → ship.first
  → order.done (1..3) → part.pick → run.end / run.left
  → run.ticket → workshop.view → part.buy
  → title.view tomorrow → daily.view → daily.start → daily.end → daily.share
```

The health report should answer: **% of first-run newcomers who complete the four beats and the
first order**; **% who return within 7 days and open the Daily**; **the median run length and the
order where runs end**; **the most/least picked parts**; **the Workshop's first purchase**; **the
share rate**. The targets are the owner's call; a reasonable first target: ≥ 70% of first runs
complete the first order, ≥ 25% of players who finish a first run open the Daily within a week.

## Privacy and the child

- The platform's telemetry is opt-out; the game's events follow the same rule; no personal data;
  the child's profile is not singled out; the daily/streak is a personal ritual, not a competition
  the child must keep.
- The event names and the payloads are in the game's code; the docs say what is collected (the
  health report/telemetry page); the owner can see the data in the console.
- No notifications/push; no "you lost your streak" dark pattern; the daily is an invitation.

## Recommendation

Add the events above with the modes/orders/workshop/daily, in the same slice as the layers (they
are cheap and answer the next decision); use the existing telemetry/report/console; put the
funnel and the targets in the plan's design and the game's docs; review after two weeks on UAT. The
brand's pull is measured by the share/catalog/OG clicks (the hub/platform), not by the game's
telemetry alone.

## What would change my mind

- The telemetry budget is too small for the new events: batch/name them by the run (one `run.end`
  with the counts) instead of per-order.
- The family/owner prefers no new telemetry: use the local save/score/console and the owner's
  playtest; the plan's decisions then rely on the visible numbers (the ticket/leaderboard) and the
  owner's word.

## Sources

`docs/architecture/telemetry.md`, ADR 0015; `packages/game-sdk` telemetry; the game's
`session.telemetry` use; `.claude/skills/health-report` (the platform's health report). Checked
2026-11-08.
