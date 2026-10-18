---
title: "0034: Delete a profile at once and an account after seven days, with everything of them; the append-only logs get one way out each"
description: Deleting a profile deletes its data in every module at once; deleting an account stops it at once and deletes it with all its profiles after seven days unless someone signs in; finished hands keep a deleted player's seat with nothing of them; public IDs are never given again; a result's decisions go only with it, in the purge; the audit log keeps a year.
sidebar:
  order: 34
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0029](0029-integrity-engine-and-boards-by-trust.md) and
  [ADR 0027](0027-platform-admin-and-the-first-owner.md) — the decisions log and the audit log stay append-only, each
  with one way out; [ADR 0023](0023-accounts-own-their-profiles.md) — "never reused" holds past a profile's deletion;
  [ADR 0017](0017-replays-of-finished-online-hands.md) — a finished hand shows a deleted player's seat as such

## Context

Opening Tò He to strangers needs an answer to "delete my data" (E-07). Before this, deleting a profile removed only its
row: its saves, scores, results on boards, ranked runs and seats at tables stayed behind, unseen but not deleted. An
account could not be deleted at all — the privacy notice said to ask the operator. For a child's profile, deleting it is
its parent taking the consent back (R-07: Decree 13/2023 art. 20 and Law 91/2025 ask that processing then stops).

Two tables refuse to forget by design: `integrity.decisions` (ADR 0029) and `admin.audit_log` (ADR 0027) have triggers
that reject `UPDATE`, `DELETE` and `TRUNCATE`. The audit log also names accounts, some by their email.

The owner decided E-07 on 2026-10-18 ("ok như bạn đề xuất, làm đi"): an account waits **seven days** (design §3.14);
results on boards are **deleted**, not orphaned, through a single exception to the append-only tables; the audit log
keeps **one year**. The legal deadlines themselves (Q7) are the owner's to check against the original texts — this
ADR is not legal advice.

## Decision

- **Every module that keeps something under a profile's id implements `IProfileData`**: `WithdrawAsync` lets go of
  the profiles at once (they leave the tables they sit at or watch — a bot finishes a hand in progress — and
  invitations to them end) and `PurgeAsync` deletes what the module stores, in the caller's transaction. Progress
  deletes saves and scores; Integrity deletes ranked runs and results, each result's decisions with it; Rooms rewrites
  finished hands and closed tables (below). Identity deletes the profile and its name history, and **retires its
  public ID** in `identity.retired_profile_ids`: a new ID is never one a profile has or ever had, so an ID someone
  shared never reaches a stranger.
- **A profile is deleted at once**, behind the parent gate as before (`DELETE /api/profiles/{id}`, never the last
  one): withdraw, purge and retire in one transaction holding the account's row.
- **An account is deleted after seven days** (`Identity:DeletionWait`). `DELETE /api/account` needs step-up level 2;
  it sets `DeleteAfter`, gives the account a new security stamp (every session ends at the next session check), signs
  this device out, withdraws its profiles, and sends "Tài khoản Tò He sắp bị xoá" with the day (Việt Nam time) when
  email is on. While it waits, its profiles are on no public board and found by no ID (the board audience and the
  profile directory leave the account out, as for a suspended one), and a session it still holds cannot renew itself:
  writing a session for it answers `401 session_ended` and signs that browser out.
- **Signing in keeps it.** Every sign-in — password, a password reset, a provider, finishing a provider link — goes
  through `SessionWriter.SignInAsync`, which clears `DeleteAfter` (and sends "Tài khoản Tò He sẽ không bị xoá")
  before the session starts. There is no separate "cancel" button: the email and the hub's notice say to sign in.
- **The `account-deletion` job** (hourly, `Identity:DeletionCheckInterval`) deletes accounts whose day has passed,
  one transaction each: it locks the account's row and reads it again, so a sign-in at that moment either kept the
  account already or waits and then finds it gone; then withdraw, purge every profile, retire their IDs, delete the
  account's sign-in attempts and the account — its profiles, name history, provider links, roles and keys go with it
  by their foreign keys.
- **Finished hands stay for the others at the table.** A deleted player's seat in `rooms.hands` and in closed
  `rooms.rooms` becomes `{ProfileId: <fresh random uuid>, Deleted: true}` with no account, name or avatar — a random
  id per seat, so no two of their seats can be tied together; a closed table they hosted is hosted by nobody
  (`00000000-…`). Their rows in `rooms.results` keep the place and points (the hand still counts its players) with no
  profile or account. A replay shows the seat as **"Người chơi đã xoá"** (`ReplaySeat.Deleted`).
- **The append-only logs get one way out each**, and only in a transaction that says so with the transaction-local
  setting `tohe.purge` (`SELECT set_config('tohe.purge', …, true)`):
  - `integrity.decisions`: with `profiles`, a decision may be deleted **only once its result is gone** — the foreign
    key from decisions to results now cascades, so deleting a deleted profile's results takes their decisions. A
    decision is still never updated, never deleted while its result stays, never truncated.
  - `admin.audit_log`: with `audit`, an entry may be deleted **only past 365 days** by the database's clock. The
    `audit-retention` job runs daily and deletes exactly those, with the trigger's own expression.
- **What stays, and for how long:** sent email records (recipient, kind, time) 30 days (ADR 0022); device telemetry,
  which names no account (ADR 0015); audit entries until their year is up. The console's Users pages show an account
  waiting to be deleted ("Chờ xoá") and when it goes.
- **Not done here:** exporting one's data ("Tải dữ liệu của tôi") — after launch, unless the law needs it first (Q7);
  a report button for names (Q6, after launch); deleting an account from the console.

## Consequences

- Deleting really deletes: a deleted profile leaves no save, score, board result, decision or ranked run, and its
  public ID cannot come back. Two tests per side guard the triggers: a decision cannot go while its result stays, even
  in a purge; an audit entry younger than a year cannot go, even in the retention job.
- The privacy notice describes the flow instead of "ask the operator"; `TERMS_VERSION` changes, so signed-in accounts
  accept the new version once. The owner still reviews all of it, and the deadlines against the law (E-07 Q7).
- Two new background workers on the console's System page: `account-deletion` and `audit-retention`.
- A moderator's label (their email, or an old username) stays on the decisions they made about other people's
  results, and in audit entries for their year: deleting a moderator's account does not rewrite other people's
  history. The account itself and its roles go.
- Deleting the last platform owner leaves the deployment without one; the command in the API's container
  (`admin grant`, ADR 0027) is the way back, as for any lost owner.
- The append-only guarantee is now "append-only except one narrow, named path": it still stops mistakes and ordinary
  code, not someone who controls the database role — as before.

## Alternatives considered

- **Delete an account at once.** Simpler, but one mistaken tap loses everything; the owner chose the wait (Q1).
- **Wait 30 days.** Kinder to mistakes, but keeps data long after someone asked to delete it.
- **Keep board results with an id that points nowhere.** Cheaper — no exception to the triggers — but "deleted" would
  not be deleted (Q2).
- **Disable the triggers during a purge** (`ALTER TABLE … DISABLE TRIGGER`). Takes a lock on the whole table and
  opens it to every transaction meanwhile; the transaction-local setting opens one path, for one transaction.
- **A cancel button instead of signing in.** Signing in already proves it is the owner; a second path would need its
  own proof.
