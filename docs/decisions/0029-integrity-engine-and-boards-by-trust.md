---
title: "0029: One integrity engine gives every result a trust level from its evidence; boards read by trust"
description: Runs and room hands go to one module that stores each with a level — reported, checked, verified, held or rejected — decided by pluggable verifiers and signals and logged with the rule version; each board takes only the levels its audience can trust.
sidebar:
  order: 29
---

- **Status:** Accepted — a result left to people keeps its value, not only its level, since
  [ADR 0031](0031-people-decide-what-the-engine-held.md); a deleted profile's results go with their decisions since
  [ADR 0034](0034-delete-accounts-and-profiles-for-good.md);
  results earned by a device profile keep their levels but are in no public board's audience, by [ADR 0043](0043-device-profiles-and-identity-levels.md) (from its
  step I1; since I2a also its hands at tables, a result with no account until it is brought into one)
- **Date:** 2026-10-18
- **Amends:** [ADR 0014](0014-live-scores-for-long-runs.md) — a run's place on a board follows the server's clock and
  its level; [ADR 0016](0016-online-rooms-for-turn-based-games.md) — the weekly board is the calendar week, and a hand
  counts on public boards only with two people at the table

## Context

Scores of one-player games are what the device says: anyone signed in can send any number with the developer tools
(`POST /api/progress/scores` checks only the game's name and that the number is finite). The boards were fine for one
household; public boards (D-09) for people who do not know each other would be wrong on the first day. Room hands are
different: the server referees them (ADR 0016) and can replay them (ADR 0017). Two needs follow — say how far each
result can be trusted, and let each board take only what its audience can trust — and the owner asked for one engine
to do it, conservative because "mọi người cũng legit": hiding something by mistake is cheaper than punishing someone
by mistake.

## Decision

- **One module, `Integrity`**, takes every result a profile claims — a run's score, a finished hand's outcome; later
  daily challenges, achievements, tournaments — and stores it with a **level** that follows the evidence, never the
  player:

  | Level | Means |
  | --- | --- |
  | `reported` | Only the device's number |
  | `checked` | Passed the plausibility rules |
  | `verified` | The server refereed it, or reproduced it |
  | `held` | A signal fired; it waits for a person, and its player sees "Đang được xem xét" |
  | `rejected` | Hard proof that it is false, or a person decided |

- **Verifiers and signals plug in.** A verifier turns evidence into `verified`: `RoomVerifier` for a hand the server
  refereed; the replay verifier of ranked runs (D-10) comes next. A signal is a small rule that answers *fine*, *unusual* or *impossible*,
  with a reason: `Bounds` (a game the catalog knows, a board it may keep), `PersonalJump` (a best far above the
  profile's own history), `Rate` (results arriving faster than a person plays). Unusual holds; impossible rejects.
  The two-people rule of D-11 is a scope, not a signal: a hand with fewer than two people at the table is verified,
  and counts on the account's board but on no public one — playing with bots is not suspicious, only not comparable.
- **Three hard rules.** Automation only hides — `rejected` needs hard proof, everything else that looks wrong is
  `held`, once held only a person releases it, and suspending an account is always a person's decision. The level follows the evidence: no player is
  trusted past their evidence; later reputation may change how closely a result is looked at, never its level. The
  player sees where their results stand.
- **Every decision is logged** in `integrity.decisions` — the level before and after, the reason, the signals, the
  rule version, the engine or the admin who decided, when — append-only by a trigger, as the audit log is (ADR 0027).
  A later decision can reverse one; rules carry a version, so results can be looked at again when a rule changes.
- **Boards read by trust.**

  | Board | Takes | Who is on it |
  | --- | --- | --- |
  | The account's | `reported`, `checked`, `verified` — and the viewer's own `held`, labelled | The account's profiles |
  | A community's | `verified`; for a game no verifier can reproduce yet also `checked`, labelled "chưa xác minh" | Profiles on public boards of the community's accounts |
  | The server's | `verified` | Profiles on public boards |

  Two periods: this week — the calendar week from Monday 00:00 in Việt Nam (`Asia/Ho_Chi_Minh`) — and all time. A run
  board ranks each profile's best; a room board ranks the points of the period, with hands and firsts. Ties go to
  whoever got there first by the server's clock; a result belongs to the week the server received it. Public boards
  show the first 50 and the viewer's place with two on each side.
- **Boards are read from the results**, through indexes on game, board and time: nothing has to be kept in step when a
  decision, a profile's switch or a suspension changes who counts. At the scale of a few communities a board is one
  grouped query; when a board outgrows that, the next step is D-09's one row per profile, board and period, rewritten
  with each decision.
- **Public boards are opt-in per profile**: on for adults, off for children; a parent turning it on for a child says
  "Tôi đã hỏi ý bé" (D-06). Suspended accounts are off them. Names and avatars come from Identity; a tap shows the
  profile's ID, never an email.

## Consequences

- Progress and Rooms hand their results to the engine; boards no longer read `progress.scores` or `rooms.results`.
  The account's board replaces the household-era one, and the rooms' 7-day board becomes the calendar week.
- One-player games have no server board until a verifier can replay them (ranked runs, D-10 — Ghép Khối first);
  until then their community boards take `checked` results, labelled, as D-16 decided.
- Held results wait for the console's review queue (E3); until it exists they stay held, visible only to their player.
- A stricter rule needs a new rule version; results already decided keep the version that decided them.

## Alternatives considered

- **Checks scattered in Progress and Rooms:** cheap today; every later feature (daily challenge, achievements,
  tournaments) would redo trust, without one review queue or one log.
- **An outside anti-cheat service:** none fits small web games in iframes, and players' data would leave the server.
- **One row per profile, board and period now (D-09's sketch):** a rank becomes an index lookup, but every decision,
  every switch of a profile and every suspension must rewrite rows in step — worth it once a board outgrows a grouped
  query, not before.
- **Holding hands played with bots:** would flood the review queue with ordinary play and tell children their games
  are "being reviewed"; a scope says what D-11 asked without suspicion.
