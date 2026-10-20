---
title: "0037: A self-hosted proof-of-work before a code by email, behind a switch of the console"
description: With the console's switch on — off by default — signing up and asking for a password reset take a SHA-256 puzzle solved on the device, sealed by Data Protection and spent once, so cheap bots cannot make the API send thousands of codes; no third party, no change to the CSP.
sidebar:
  order: 37
---

- **Status:** Accepted — the proof-of-work is also to guard making a device profile on the server and redeeming a transfer code, by [ADR 0043](0043-device-profiles-and-identity-levels.md) (its step I2)
- **Date:** 2026-10-18
- **Amends:** [ADR 0028](0028-sign-in-and-registration-at-run-time.md) — the console's run-time settings gain a switch

## Context

Bots that sign up in bulk can make junk accounts, make the API mail codes to other people's addresses, and burn the
email quota — on Resend's free plan, 100 messages a day shared by the whole account (E-02). In the `invite` and
`closed` modes the API checks the invite code before any email (ADR 0028), so a bot without a code sends nothing; in
`open`, only the per-address and per-IP limits stand in the way, and a bot rotates both.

The owner decided E-09 on 2026-10-18 ("ok như bạn đề xuất, làm đi"): launch by invite (Q1), and build **C** now — a
self-hosted proof-of-work behind a console switch, off by default — to turn on before registration opens to everyone
(Q2). Cloudflare Turnstile (B) can still come later behind the same kind of switch; edge rate limits (D) are
Cloudflare's configuration, outside this repository.

## Decision

- **The switch** is one more setting of the console's sign-in page (`registration.proof-of-work` in `admin.settings`,
  `proofOfWork` in `PUT /api/admin/settings` — the same permission, step-up and audit entry as the rest of ADR 0028),
  read by Identity through `ISignInSettings`. Off unless turned on. `/api/config` tells the hub (`proofOfWork`).
- **Where**: signing up by email (`POST /api/auth/register`) and asking for a password reset
  (`POST /api/auth/password/forgot`) — the two requests that send a code to any address without a session. Checked
  first, before the address is looked at, so the answer still says nothing about who has an account. The other codes
  need a session or a provider's sign-in first.
- **The puzzle** (in the way of ALTCHA, written here): `GET /api/auth/challenge` picks a random salt and a random
  number below `maxNumber` and sends the SHA-256 of salt + number, with a token — the salt and the hash sealed by Data
  Protection, expiring in 5 minutes. The device tries 0, 1, 2… until the hash matches and sends `proof: {token,
  number}`. The API unseals the token, checks the hash, and remembers the salt until the token would have expired, so
  an answer is spent once. Nothing is stored before an answer comes.
- **Difficulty**: `Identity:ProofOfWorkMaxNumber`, 50 000 — on average 25 000 hashes, about 0.1 second on a desktop
  and half a second on a phone with the hub's solver (200 000 hashes a second measured on Node).
- **The hub** solves with its own SHA-256 (`session/proofOfWork.ts`), not `crypto.subtle`, which exists only on HTTPS
  (UAT is plain HTTP) and would cost an asynchronous call per try. It pauses every 5 000 tries so the page keeps
  drawing. When the server asks anyway (`400 proof_of_work_required` — the switch changed since the page loaded, or
  the challenge expired), it solves a fresh one and sends once more.

## Consequences

- A bot pays half a second of CPU per code requested, and must solve before learning anything; a person waits about
  as long as the button's spinner turns. Someone with many machines is not stopped: the per-address and per-IP
  limits, invite codes and, later, Turnstile or the edge stay the answers to that.
- No third party, no change to the CSP or the privacy notice: the puzzle is computed on the device and sends nothing
  but its answer.
- Spent salts live in the API's memory, which one API process makes enough (ADR 0016); a restart forgets them, and a
  challenge sealed before still expires within 5 minutes.
- Raising the difficulty is a configuration value; the hub reads `maxNumber` from each challenge.

## Alternatives considered

- **Cloudflare Turnstile**: stronger, but a third party in the CSP and the privacy notice, kept for later (E-09 B).
- **ALTCHA's library**: the same idea, but a dependency on both sides for a few dozen lines; and its widget expects
  `crypto.subtle`.
- **A puzzle on every sign-in**: signing in sends no email; the lockout already limits password guessing.
- **Storing challenges in the database**: the sealed token makes it unnecessary until an answer comes.
