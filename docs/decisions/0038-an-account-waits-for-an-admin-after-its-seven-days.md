---
title: "0038: After its seven days, an account waits for an admin to delete it; nothing deletes it by itself"
description: Asking to delete an account still stops it at once and gives seven days to change one's mind; after them it waits, counted on the console's overview and listed under "Chờ xoá", until an admin deletes it for good with every profile and their data — while the law's deadlines are not known, the operator decides when.
sidebar:
  order: 38
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0034](0034-delete-accounts-and-profiles-for-good.md) — the `account-deletion` job is gone; an admin
  deletes an account whose seven days are over, from the console

## Context

ADR 0034 deleted an account by itself: the hourly `account-deletion` job took every account whose seven days had
passed. How soon the law wants someone's data deleted once they ask (E-07 Q7, Decree 13/2023 and Law 91/2025) is the
owner's to check against the original texts, and is not settled. On 2026-10-18 the owner decided: "nếu k rõ thời gian
xóa thì cứ làm thiết kế dạng cho vào đang chờ xử lý và admin sẽ action theo thời điểm" — while the deadline is not
clear, a deletion waits as pending and an admin acts on it at the right time.

Profiles are not concerned: their owner deletes one at once, behind the parent gate, as before. This ADR is not legal
advice.

## Decision

- **Asking stays as it was** (ADR 0034). `DELETE /api/account` sets `DeleteAfter` seven days ahead, ends every
  session, withdraws the profiles from tables, boards and the ID directory, and sends "Tài khoản Tò He sắp bị xoá".
  Signing in keeps the account.
- **After the seven days, nothing deletes it by itself.** The `account-deletion` worker and its settings
  (`Identity:DeletionCheckInterval`, `Identity:DeletionBatch`, `Identity:DeletionEnabled`) are removed. The account
  stays as it was during its wait — stopped, its profiles out of sight — and signing in still keeps it, until an admin
  deletes it.
- **An admin deletes it from the console**: `POST /api/admin/users/{id}/delete`, with `admin.users.write` (owner,
  admin — not a moderator) and step-up level 2, never on one's own account (`admin_self`) nor a stronger one
  (`admin_rank`), like every change to an account there. It answers `204`; `404` when the account is gone;
  `409 deletion_not_requested` when its owner never asked, or signed in since; `409 deletion_not_due` while the seven
  days are not over. The deletion is the one ADR 0034 gave the job, in one transaction with the audit entry: the
  account's row locked and read again — a sign-in at that moment either kept it already, or waits and finds it gone —
  then every module withdraws and purges, the profiles' public IDs are retired, the sign-in attempts and the account go.
- **The audit log keeps it**: `user.delete`, with the account's label (its email, or an old username) and how many
  profiles went with it — for the audit log's year (ADR 0034).
- **The admin sees there is something to do**: the console's overview counts the accounts due ("Tài khoản đến hạn
  xoá"); the Users page lists the accounts waiting, the soonest due first ("Chờ xoá", `GET /api/admin/users?deleting=true`);
  Prometheus gets `tohe_account_deletions_due`.
- **What people read says so**: the email and the hub say the account is deleted for good *after* its day, not *on*
  it; the privacy notice says that after seven days the operator deletes it (`TERMS_VERSION` `2026-10-18.4`, so
  signed-in accounts accept it once).
- **Not done here:** a deadline by which an admin must act, and an alert on `tohe_account_deletions_due` — both wait
  for the owner's reading of the law (E-07 Q7); deleting an account whose owner never asked — suspending it is the tool
  for that.

## Consequences

- An account may outlive its seven days for as long as nobody acts. Someone has to look: the overview shows the count,
  and once the deadline is known it becomes an alert on the metric, or a job again (a new ADR).
- Its owner can still keep it by signing in after the seven days, until an admin deletes it. Nothing promised is
  broken: the email and the hub say "after" the day.
- One background worker fewer on the System page; `audit-retention` stays.
- The deleted account's email stays in its `user.delete` entry, and in the entries about it before, for the audit
  log's year — what answers "was my account deleted?". The owner reviews this with the rest of E-07 Q7.
- Tests: the console deletes only an account its owner asked to delete, only once its seven days are over, only for an
  admin; the entry is in the audit log; the overview's count follows.

## Alternatives considered

- **Keep the hourly job** (ADR 0034). Deletes on time with nobody involved, but on a deadline nobody has checked
  against the law; the owner chose to decide when.
- **An admin approves, then a job deletes.** Two steps for one decision, and the job comes back.
- **Let an admin delete any account at once.** Takes away the seven days someone was promised to change their mind;
  for an account that harms others, suspending it stops it without deleting what its owner may still want.
