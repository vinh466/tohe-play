---
title: "0031: People decide what the engine held — the console's review, and profiles hidden from public boards"
description: Whoever may review sees the held results oldest first with the profile's history and approves, rejects or reopens one after step-up, never about their own; a result left to people keeps its value; a moderator can hide a profile from public boards over its owner's switch, and the owner is told.
sidebar:
  order: 31
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0029](0029-integrity-engine-and-boards-by-trust.md) — a result left to people keeps its value, not
  only its level

## Context

The integrity engine only hides: anything unusual is `held`, seen only by its player as "Đang được xem xét", and once
held only a person releases it (ADR 0029). D-16 asked for a queue in the console, "Chờ xem xét": the score, the
profile's history, the signal that fired, a replay of the run in the game itself; approve to `verified` or `checked`,
reject — and maybe suspend the account — reopen an old decision, everything in the audit log. D-09 asked that an admin
can take a result off the boards, hide a profile from them and suspend an account. Moderators already rename profiles
(ADR 0027).

One more thing showed while building it. A final run reported again with a higher value took the new value, held or
decided: a reviewer could approve one number and see another on the board, and an approved run could climb afterwards
with nothing looking at it again.

## Decision

- **The review** lists the held results oldest first, fifty at a time, and under "Đã quyết" the results people decided
  about or the engine rejected, the latest decision first — where an old decision is found again. A result shows where
  it stands and why, its evidence (`device`, `refereed`, `replayed`), a ranked run's numbers, the profile's best and
  number of results on the board with its last ten, and every change of level.
- **Three decisions, made by a person:**

  | Decision | From | To |
  | --- | --- | --- |
  | Approve | `held` | `verified` when the server refereed or replayed it, `checked` when it is only the device's number |
  | Reject | any level but `rejected` | `rejected` |
  | Reopen | `rejected`, `checked`, `verified` | `held` |

  Each needs the permission `admin.results.review` — owners, admins and moderators — and step-up level 2. It is logged
  in `integrity.decisions` with the person and an optional note, and in the audit log. Nobody decides about their own
  account's results. The result's row is locked while a decision is made, so two people deciding at once decide one
  after the other.
- **A result left to people keeps its value.** Held, rejected, or decided by a person, the engine judges it no more,
  and a report of it again changes nothing: a person decides on the number they see, and an approved run cannot climb
  afterwards. A run grows only until it ends (ADR 0014), so no honest run loses anything.
- **Rejecting does not suspend.** The result links to its account, where whoever may suspend does (ADR 0027).
- **A moderator hides a profile from public boards**, with a reason, and lets it back; the owner's switch stays as it
  is and does not bring the profile back, and the hub tells the owner why. The account's own board is unchanged. The
  same guards as renaming hold: not one's own account, not one whose role is as strong.
- **Watching a run in the game itself** (E3b) waits for its own change: the Game Contract needs a way to show a run
  without playing it, and the console a frame for the games origin.

## Consequences

- Moderators review results as they rename profiles; the overview shows how many results wait.
- An approved jump counts in the profile's history, so a later honest run near it does not fire `personal_jump` again.
- Hiding is per profile; to take a whole account off every board, suspend it.
- A decision is undone only by another decision: mistakes are cheap to reverse and never silent.

## Alternatives considered

- **Judging a decided run again when it grows:** the approved jump would fire on every report of the same run, and
  reviewers would see one run again and again — for a run that has no honest reason to grow.
- **Refusing a decision when the value changed since the page loaded:** the console would have to send what it saw;
  keeping the value makes the question go away.
- **Suspending with every rejection:** one false score is not always cheating — children tap fast, a verify module can
  have a bug — and suspending stays with those who may.
- **Hiding by turning the owner's switch off:** the owner could turn it on again, and one field would mix the owner's
  choice with a moderator's decision.
