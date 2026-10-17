---
title: "0004: Identity: households, adult accounts and child profiles"
description: Netflix-style model — adults sign in, a household has profiles, children pick an avatar.
sidebar:
  order: 4
---

- **Status:** Superseded by [ADR 0023](0023-accounts-own-their-profiles.md) (accounts own their profiles; no households) — sign-in method amended by
  [ADR 0011](0011-password-sign-in-first.md) (username + password first)
- **Date:** 2026-10-13

## Context

Players are one family (including young children who cannot type passwords) and some friends. Data about
children must be minimal. The skeleton currently uses one local guest profile per device.

## Decision

- **Adult accounts** sign in with ASP.NET Core Identity: Google sign-in and passkeys; email + password as fallback.
  No hand-written crypto or token handling.
- A **household** belongs to one or more adults. Adults invite other adults (friends get their own household).
- A household has **profiles**: name or nickname, avatar, optional 4-digit PIN, an age band. Children only ever
  *pick a profile* on a device an adult has signed in.
- Sessions are **cookies on the hub origin** (same-origin `/api`), `HttpOnly`, `Secure`, `SameSite=Lax`, with
  anti-forgery for unsafe methods. Data Protection keys are persisted in PostgreSQL so several pods share them.
- Saves and scores belong to a profile. Local guest data from the skeleton is migrated to the first profile on
  first sign-in.
- No personal data about children beyond the profile name and avatar.

## Consequences

- One sign-in per device by an adult; children never see a login form.
- The API needs rate limiting on sign-in endpoints and audit logging of household changes.
- Installed iOS PWAs keep their own cookie jar: users sign in once more after installing (documented in the hub).

## Alternatives considered

- **Per-person accounts for everyone:** unworkable for small children.
- **External IdP (Keycloak, Authentik, Zitadel):** strong, but another service to run for a handful of users.
- **Bearer tokens in localStorage:** exposed to XSS; cookies on a same-origin API are simpler and safer here.
