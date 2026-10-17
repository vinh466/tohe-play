---
title: "0028: Switch sign-in methods and registration at run time; communities join by invite code"
description: The deployment decides which sign-in methods can exist; the admin console decides which are on and whether new accounts may come — openly, by invite code or not at all — and every invite code belongs to a community the account remembers.
sidebar:
  order: 28
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0026](0026-sign-in-methods-and-account-linking.md) — a provider with secrets can still be off;
  [ADR 0024](0024-email-identifies-an-account.md) — signing up may need an invite code, or be closed

## Context

ADR 0026 lets a deployment offer Google, GitHub and an OpenID Connect issuer by giving them secrets — a redeploy for
every change. Opening Tò He to a few communities needs more, and sooner: let one community in this week and not
everyone; stop sign-ups for a while after a wave of abuse; turn a provider off when it misbehaves, without touching the
cluster. Leaderboards per community (D-09) need to know which community an account came with. And a switch that only
some ways of creating an account obey is a back door.

## Decision

- **Two layers.** The deployment decides what *can* exist — a provider needs its secrets, signing up by email needs
  email (ADR 0022). The admin console decides what *is on*, kept in the database (`admin.settings`), read through one
  service the Identity module asks: email and password, each configured provider, and the registration mode. The one
  API process (ADR 0027) caches them and forgets the cache whenever the console saves, so a change holds at once.
- **Turning a method off** stops both signing in and signing up with it — for email and password also a forgotten
  password, since a new one signs in; nothing else changes — a linked provider stays linked, a password stays set,
  step-up still uses either. Two guards: one method at least stays on, and the
  admin who switches keeps a way in. The console says how many accounts depend on a method before it goes off.
- **Registration modes**: `open` — anyone signs up; `invite` — signing up needs an invite code; `closed` — nobody new,
  everyone else signs in. Every way an account is made obeys it: signing up by email, when it starts and when its code
  comes back, and the first sign-in with a provider.
- **Communities and invite codes.** A community is a name. Its codes may expire, may be used a set number of times,
  and can be revoked; a code is counted in the same transaction that creates the account, so its limit holds when two
  people use it at once. The account remembers the community it came with — one, for now — and in `open` mode a code
  is welcome but not needed. Codes travel as links: `/register?invite=CODE`.
- Every change — a method, the mode, a community, a code — needs step-up level 2 and lands in the audit log
  (ADR 0027); `admin.settings.write` (owners and admins) allows them.

## Consequences

- `GET /api/config` tells the hub which methods are on and the registration mode; the hub shows only what works, and
  an invite field when a code is needed — or welcome when one is not.
- A deployment can run on providers alone: with email and password off, accounts that only have a password cannot sign
  in until it is on again or they get a provider linked — which is why the console counts them first.
- Leaderboards per community (D-09) and statistics per community in the console can rely on `community_id`.
- An account in several communities waits for a need; it would change the remembering, not the codes.

## Alternatives considered

- **Configuration only (ADR 0026's layer):** every switch a deploy, and an incident waits for one.
- **A registration toggle per method** (Google sign-ups closed, password sign-ups open…): a matrix nobody asked for; the
  mode and the methods already cover the needs above.
- **Invite codes per person** (one code, one account): heavier to hand out to a community at once; a code with a
  limit of uses and a revoke covers the same when needed.
- **Allow-lists of email domains:** communities here are groups of friends and families, not organisations with a
  domain.
