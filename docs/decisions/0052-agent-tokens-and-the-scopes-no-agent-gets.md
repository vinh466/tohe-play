---
title: "0052: Give agents named tokens with scopes, and keep a list of scopes no agent ever gets"
description: An agent signs in to Tò He with a token the owner gives it in the console — named, with a closed set of scopes, an expiry and an audit of every use; endpoints refuse agent tokens unless they name a scope; scopes that touch players, sign-in, roles, deletion, approval or secrets do not exist and a test keeps it so.
sidebar:
  order: 52
---

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** the owner, 2026-10-22 and 2026-10-23, in plans/asset-studio D-11 ("D-11 ổn nha") and D-15 ("ổn đó").
  The owner's aim, beyond the Studio: "có đường cho bạn (Agent) có thể cùng quản lý trên đó luôn (monitoring, update tự
  động, nhạy cảm thì k, ...)".

## Context

Until now only people sign in to Tò He: a player's session on the hub's host, an operator's on the console's
([ADR 0027](0027-platform-admin-and-the-first-owner.md)). The Studio ([ADR 0051](0051-an-asset-studio-for-game-assets.md))
lets agents create drafts, and the owner wants agents to help run the platform later — read its health, make updates
that are safe. An agent signing in as a person could do whatever that person can, and the audit could not tell a person
from a machine. Two kinds of token, one for the Studio and another later for operations, would mean two sets of rules,
two places to revoke and two logs.

## Decision

### A token belongs to a named agent

- The owner creates an **agent** in the console — a name ("studio-agent on the workstation") and a note — and gives it
  **tokens**. A token is shown once; only its hash is kept.
- A token has a **set of scopes**, an **expiry** (30 days unless the owner chooses otherwise, at most 90) and can be
  **revoked** at once. Disabling an agent revokes all of its tokens.
- A token is sent as `Authorization: Bearer tohe_at_…`; the prefix lets secret scanners find a leaked one. No cookie,
  so no cross-site request forgery.
- The token, the agent and the scope are read again on **every request**, so a revocation holds at the next request,
  like an operator's role.
- **Every use is in the audit log**: which agent, which token, which scope, what it did and with what result.

### Scopes are a closed list, and endpoints opt in

- The scopes are a list **in code**, each with what it allows. A new scope is a code change, reviewed, with its
  area's ADR ([ADR 0050](0050-a-game-declares-what-it-depends-on.md)).
- **An endpoint refuses agent tokens** unless it names the scope that allows it. Nothing is open to agents by default.
- The first scope is **`studio.draft`**: create and change the agent's own drafts in the Studio, upload draft files, run
  the checks without saving ([ADR 0051](0051-an-asset-studio-for-game-assets.md)).
- Later scopes, for agents that help run the platform (`ops.read` to read health and metrics, say), come with their own
  plan and ADR.

### What no agent ever gets

These scopes do not exist, and **a test fails** if an endpoint in their areas accepts an agent token, or if a scope is
named in their families:

| Never | Because |
| --- | --- |
| players' data: accounts, profiles, progress, scores, messages | it is people's, often children's |
| signing in, sessions, sign-in methods, two-factor authentication | an agent would let itself in further |
| roles, studio roles, agent tokens | an agent would widen its own power |
| deleting anything, approving or withdrawing assets | a person decides those |
| secrets and settings | they protect everything else |

The list is the platform's rule, not configuration: no setting turns one on.

### Where agents call

Each app's own host, at the API routes that name a scope: the Studio's on `studio.` for `studio.draft`. A host behind
Cloudflare Access (the console's) would need an Access service token as well; no scope needs the console's host now.

### Not done here

No scopes beyond `studio.draft`; no tokens for people; no agents creating agents.

## Consequences

- New: `docs/architecture/agent-tokens.md`; tables for agents and tokens; a scope check every endpoint goes through; a
  console page to create agents and give and revoke tokens, behind the owner's role and its second factor.
- `AGENTS.md` and *Working with agents* name the exception for `studio.draft` in production; any further exception is a
  new scope with its ADR.
- The test of forbidden areas runs with the API's tests in `pnpm verify`.

## Alternatives considered

- **A token made just for the Studio:** quick, but the operations plan would build a second one.
- **Agents sign in as a person:** no limit on what they do, and the audit cannot tell them apart.
- **Scopes in configuration:** flexible, but a setting could then hand an agent a power the owner ruled out.
