---
title: "0026: Sign in with Google, GitHub or an OpenID Connect issuer; link a provider by its subject, after proof"
description: A deployment offers the providers it has secrets for. A provider's identity is its subject, never its email; an address it vouches for only finds the account it may belong to, whose owner proves it before the link.
sidebar:
  order: 26
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0011](0011-password-sign-in-first.md) — OAuth arrives, as more ways into the same accounts
- **Amended by:** [ADR 0028](0028-sign-in-and-registration-at-run-time.md) — a provider with secrets can still be
  switched off from the admin console, and its first sign-in obeys the registration mode

## Context

Email and a password (ADR 0024) are enough for the family. The communities Tò He opens to next expect "Tiếp tục với
Google", and ADR 0011 left OAuth for later, for the same accounts. Two things make it easy to get wrong:

- **Linking by email.** When a provider sends an address that already has an account, joining the two at once hands
  that account to whoever controls the provider's account. Providers vouch for addresses with very different care — a
  self-hosted OpenID Connect issuer may not check at all — so "the provider verified it" is only as strong as the
  weakest provider configured.
- **Our own guards.** The same-origin guard refuses cross-site POSTs to `/api`, which is how OpenID Connect answers by
  default (`form_post`). The handlers' correlation cookies need HTTPS. UAT is plain HTTP inside WireGuard (ADR 0010).

## Decision

- **Providers:** Google and any one OpenID Connect issuer (Dex, Keycloak…) through ASP.NET Core's OpenID Connect
  handler — the code flow with PKCE, answering in the query — and GitHub through the OAuth handler, with PKCE too,
  reading its primary address and only when GitHub verified it. A deployment offers exactly the providers it has a
  client ID and secret for (`Auth:Providers:*`); `GET /api/config` lists them and the hub shows a button for each.
  They are for production, which has HTTPS: UAT and development keep email and a password, unless a developer
  registers an app for `localhost`.
- **A provider's identity is its subject** — `(provider, subject)`, linked to one account at most. The address it
  sends is never an identity: it only finds the account it may belong to, and only when the provider says it verified
  it.
- **Joining an account that exists needs proof:** a code sent to the account's address (the default), or the account's
  password. When the person proved that very address with our own code during this sign-in — a provider that vouched
  for no address asks for one — that code is the proof and nothing more is asked.
- **No account has the address:** a name and the terms (ADR 0025) finish signing up. The account has no password, its
  address is confirmed, and its first profile plays at once (ADR 0023).
- **What waits between steps** is an attempt (ADR 0024: fifteen minutes, five tries for a code) bound to the browser
  that came back, by a sealed cookie only the API reads — never by a link, which could travel.
- **Managing them** in Quản lý tài khoản needs step-up level 2 (ADR 0025). Linking starts only from the hub's own page,
  comes back to the account that started it, and refuses a subject another account has. Unlinking never removes the
  last way in — a password or another provider stays — and gives the account a new security stamp, so its other
  sessions end. Every link and unlink is told to the account's address.

Not part of this: proving an account with a provider it already has (a code by email always works — the account was
found by its address); passkeys; switching providers on and off at run time, registration modes and suspended
accounts, which the admin console adds on top of these flows.

## Consequences

- Each production provider needs an app registered with the callback
  `<App:PublicUrl>/api/auth/external/{google|github|oidc}/callback`, its secrets in the deployment
  (`Auth__Providers__Google__ClientId`…), and players reaching the hub at `App:PublicUrl`, over HTTPS.
- An account may have no password: step-up level 2 then comes by email (ADR 0025), and it can set a password later.
- The flows hold across tabs and at the same moment: an address is proven once, the last check before a link refuses
  a subject another account took meanwhile, and signing up fails closed when the address or the subject was taken.
- No provider runs in CI or on UAT, so tests stand in: a fake remote scheme drives every flow through the real
  endpoints, and an OpenID Connect issuer in a container (`mock-oauth2-server`) proves the handler's configuration —
  the code in the query, PKCE, the callback path, the claims read. The owner tries Google and GitHub on production
  before it opens to everyone.
- The links are Identity's own table, `identity.account_logins`; `auth_attempts` gains the provider, its subject and
  whether the address is proven.

## Alternatives considered

- **Link at once when the provider says the address is verified** (what Clerk and Auth0 do by default): saves one code,
  and trusts every account to the weakest provider configured.
- **`form_post` with an exception in the same-origin guard:** a hole in a guard, for nothing — the query works with
  the code flow and PKCE.
- **The pending sign-in in the URL:** a link that travels — a shared screen, the history — carries the sign-in with it.
- **A hosted or separate identity service** (Auth0, Keycloak in front of the API): one more system to run or pay for,
  while accounts, profiles and step-up still live here.
