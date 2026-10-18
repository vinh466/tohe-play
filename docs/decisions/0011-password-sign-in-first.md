---
title: "0011: Sign in with username and password first; OAuth later"
description: Adults sign in with a username and password; Google and passkeys are deferred. Details of sessions, parent gate, PINs and invites.
sidebar:
  order: 11
---

- **Status:** Accepted
- **Date:** 2026-10-13
- **Amends:** the sign-in method of [ADR 0004](0004-identity-households-and-profiles.md) (the household/profile model stands)
- **Amended by:** [ADR 0023](0023-accounts-own-their-profiles.md) — no invites; the parent gate guards the account and its profiles
  · [ADR 0024](0024-email-identifies-an-account.md) — accounts sign in with a verified email; usernames only for accounts from before
  · [ADR 0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md) — the parent gate opens with a manage PIN; account security needs the password or a code by email

## Context

ADR 0004 chose Google sign-in and passkeys, with email + password as a fallback. The owner wants the simplest
working option now and will ask for OAuth later. UAT is plain HTTP inside WireGuard (ADR 0010), which rules out
passkeys (they need a secure context) and makes OAuth redirects awkward anyway.

## Decision

- **Accounts are adults** with a **username** (3–32 chars, `a-z 0-9 . _ -`) and a **password** (at least 8 characters,
  no composition rules — length beats complexity). No email is collected.
- ASP.NET Core Identity stores accounts (PBKDF2 hashes, security stamps). Lockout after 10 failed attempts for
  5 minutes; sign-in, registration, PIN and parent-gate endpoints are rate limited per client IP.
- **Session:** an `HttpOnly`, `SameSite=Lax` cookie on the hub origin, 90 days sliding, `Secure` whenever the request
  is HTTPS. Data Protection keys live in PostgreSQL so restarts and deploys do not sign anybody out.
- **Cross-site requests:** besides `SameSite=Lax` and JSON-only bodies, unsafe `/api` requests whose
  `Sec-Fetch-Site` is not `same-origin` are rejected (games run on a different origin of the same site).
- **Active profile** is a claim in the session cookie, set by choosing a profile (with its 4-digit PIN if it has one).
- **Parent gate:** managing the household (profiles, invites, name) requires re-entering the signed-in adult's
  password; it unlocks management for 10 minutes on that device. A child holding a signed-in phone cannot change
  anything.
- **Invites:** an adult creates an 8-character code (no ambiguous characters), valid 7 days, to let another adult
  register into the same household.
- **Registration is open** on the network where the hub is reachable (family VPN/LAN). Revisit before any public
  deployment.
- OAuth (Google) and passkeys come later as additional sign-in methods for the same accounts, with a new ADR.

## Consequences

- Nothing external to configure; works over plain HTTP in UAT.
- Password reset needs another adult of the household or database access until email or OAuth exists — accepted
  for a family-sized system.
- Children never type passwords: an adult signs a device in once, children pick a profile.

## Alternatives considered

- **Google sign-in now:** needs an OAuth client, HTTPS redirect URIs and a public hostname — none exist for UAT.
- **Magic links by email:** needs email delivery infrastructure.
- **Shared household password, no personal accounts:** simplest, but no per-adult audit or parent gate.
