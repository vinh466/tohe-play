---
title: "0025: Step up in two levels; sign up at 16 or older, accepting the terms"
description: A six-digit manage PIN opens profile management; the password or a code by email opens account security. Signing up asks for 16 or older and the terms, whose version the account keeps.
sidebar:
  order: 25
---

- **Status:** Accepted — the terms and age line is also to be asked the first time a device profile's data reaches the server, and a
  player under 16 may then go on with a parent's permission, by [ADR 0043](0043-device-profiles-and-identity-levels.md) (its step I2)
- **Date:** 2026-10-18
- **Amends:** [ADR 0011](0011-password-sign-in-first.md) — the parent gate opens with a manage PIN instead of the
  password; [ADR 0024](0024-email-identifies-an-account.md) — changing the email needs step-up level 2

## Context

The parent gate of ADR 0011 asks for the account's password before profiles can be changed, so that a child holding a
signed-in phone cannot. It mixes two threats that want different answers:

- a **child on a shared device** changing a profile's settings — the parent must get past quickly, many times a week;
- **someone holding a session** — a borrowed phone, a leaked cookie — changing the email or the password, which hands
  over the account for good. That needs real proof, every time.

Accounts that sign in with Google or GitHub come next and may have no password at all, so "type the password again"
cannot be the only proof. And opening to the public means a child might sign up alone: under Vietnamese law a child is
under 16 (Luật Trẻ em 2016), whose data a parent or guardian consents for.

## Decision

- **Level 1 — the manage PIN.** Six digits, set once per account, hashed. It opens profile management on the device
  for ten minutes (the parent gate's claim, as before). Five wrong PINs in a row lock it for five minutes, counted in
  the database so tries made at the same moment all count. An account without one yet — or whose owner forgot it —
  goes through level 2, which lets it set one.
- **Level 2 — real proof.** The password, or a six-digit code sent to the account's email (ADR 0024's codes: bound to
  their attempt, ten minutes, five tries). It opens account security for ten minutes on the device, and level 1 with
  it. It is needed to change the email, set or change the password, and set or change the manage PIN — and later to
  link sign-in methods and delete the account. Right after signing in, the password just typed counts as level 2 for
  adding a first email.
- **Both are claims of this device's session**, never of another device, and both close when someone is chosen to play
  or the owner locks the page.
- **A new password ends every other session** (a new security stamp, as with a reset) and the account's email is told.
- **Signing up asks for 16 or older and the terms**, in one sentence: "Tôi từ 16 tuổi trở lên và đồng ý với Điều khoản
  sử dụng và Chính sách quyền riêng tư". Under 16, a child plays as a profile a parent makes (ADR 0023) — the parent's
  consent. The hub names the version of the documents it showed; the account keeps it and when it was accepted, and
  the hub asks again — for accounts from before too — when its documents are newer.
- **A child's profile starts safe**: it plays only with its own account's profiles until the owner allows more, and
  others only ever see its name and picture (ADR 0016, 0023).

The two documents start as drafts written from what the code does, in the hub, marked as such: not legal advice. The
owner reviews them, and fills in how to reach the operator, before Tò He opens to everyone.

## Consequences

- The family's parents set a manage PIN once (after their password) and then open profile management with six digits.
- Level 2 by email code works for accounts without a password, which Google and GitHub sign-in will bring.
- Three request buckets per address (ADR 0024) cover the new endpoints: the PIN and the password with the parent gate,
  asking for a code with sign-in, the code itself with codes.
- Accepting newer terms is one more screen for every signed-in account after a change to the documents — so they
  change rarely, and deliberately.

## Alternatives considered

- **One level, always the password or a code:** safe, and slow on a family device — a code from an email for every
  change to a child's profile.
- **Asking the identity provider to sign in again** (Google's `prompt=login`): GitHub has no equivalent, and providers
  only exist in production.
- **Asking for a date of birth:** more personal data to protect, and those who lie about their age lie about their
  birthday as well.
