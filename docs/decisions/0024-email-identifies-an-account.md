---
title: "0024: Email identifies an account; a code opens only the attempt it was sent for"
description: An account signs in with one verified email — it exists only once the code sent there comes back, every code is bound to its attempt, and no answer tells whose address has an account.
sidebar:
  order: 24
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0011](0011-password-sign-in-first.md) — accounts sign in with a verified email; a username only
  still signs in an account from before, until it adds an email
- **Amended by:** [ADR 0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md) — changing the email needs step-up level 2 rather than the parent gate

## Context

ADR 0011 signs in with a username and a password and collects no email. A forgotten password then needs another adult
or the database, and nothing can tie a later sign-in method (Google, GitHub) to an account safely. Opening Tò He to
the public needs all three: recovery, a key that sign-in methods can share, and an address for security notices.

Public sign-up also brings attacks a private one did not have: *account pre-hijacking* — signing up with an address
one does not own and waiting for its owner (Sudhodanan and Paverd, USENIX Security 2022) — and learning whose address
has an account from what the sign-up, reset and email-change forms answer.

## Decision

- **One verified email per account** identifies it: for signing in, for recovery, and later for linking other
  sign-in methods. It is never shown to other people — players see each other's profiles (ADR 0023). A unique index
  holds it.
- **Verified first, created after.** Signing up stores an *attempt* — the address, the password's hash, the first
  profile's name — and emails a six-digit code. The account exists only once the code comes back: there is no
  "unverified" account, so nobody can hold an address they do not read, and nothing is left to clean up.
- **A code opens only its own attempt.** The client keeps the attempt's id and sends it with the code; a code alone,
  or one sent for another attempt at the same address, opens nothing. Codes are random, stored hashed, used once, live
  15 minutes and allow five tries, counted in the database so tries made at the same moment all count. Each email
  carries a link to the hub page that takes its code. One address gets at most one code a minute and five an hour,
  whatever they are for.
- **Nothing leaks.** Signing up with an address that has an account, resetting the password of one that has none, and
  moving to an address another account has all answer exactly like the real thing: 202 and an attempt — a decoy no
  code opens. The address's owner learns what matters by email ("Bạn đã có tài khoản"); a reset for an unknown address
  sends nothing. A sign-in with an unknown address takes as long as a wrong password.
- **A reset ends every other session.** A new password changes the account's security stamp, which sessions check
  every five minutes (`Identity:SessionCheckInterval`). The reset also ends a lockout, cancels a pending email change,
  and tells the account's address.
- **Changing the email** needs the password — typed with the request, or proven to the parent gate within ten
  minutes — and a code sent to the new address. The old address is told, with the new one masked.
- **Accounts from before email** sign in with their username until they add an email. The hub asks for one right
  after such a sign-in, with the password just typed as the proof. From then on only the email signs in.
- **Per-IP limits in three buckets**, each `Identity:AuthRequestsPerMinute` (10): signing in or asking for a code,
  typing a code back, and typing a PIN or the parent gate's password. Each guards a different secret, so a family
  behind one address does not use one up with another.
- **Without email** (`Email:Mode=Disabled`, ADR 0022) nothing that needs a code starts: signing up and resets answer
  `email_unavailable`, `GET /api/config` says `email: false`, and the hub explains. Existing accounts sign in as
  before.

Not part of this: a stronger step-up for account security (a code by email), age and consent at sign-up, OAuth and
linking, deleting an account — each comes with its own change.

## Consequences

- UAT needs a working relay (ADR 0022's `TOHE_UAT_SMTP_*`) before this is deployed there, or nobody new can join. The
  family's accounts keep their usernames until each adds an email at its next sign-in.
- The end-to-end runs read codes from the local stack's Mailpit.
- A code is in its email's subject, to copy from a notification: alone, it opens nothing.
- The per-address limits let someone delay another person's sign-up or reset by up to an hour. Per-IP limits bound
  how often; a challenge on the forms (Turnstile) can come later.

## Alternatives considered

- **Create the account at once, unverified, and verify later:** the pre-hijacking window itself, plus accounts to
  clean up.
- **Magic links only, no passwords:** every sign-in waits for an email — slow on a family's shared device, and
  impossible while mail is down.
- **One code per address, not per attempt:** whoever started first could race the owner with a code meant for the
  owner, and a leaked code would work from anywhere.
- **Say "this email already has an account":** convenient, and a free lookup of who plays here.
