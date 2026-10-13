---
title: Identity, households and profiles
description: How adults sign in, how children play without passwords, and how household management is protected.
sidebar:
  order: 4
---

Decisions: [ADR 0004](../decisions/0004-identity-households-and-profiles.md) (model) and
[ADR 0011](../decisions/0011-password-sign-in-first.md) (password sign-in, sessions, parent gate).

## Model

```mermaid
erDiagram
  HOUSEHOLD ||--|{ ACCOUNT : "adults"
  HOUSEHOLD ||--|{ PROFILE : "players"
  ACCOUNT |o--|| PROFILE : "own adult profile"
  HOUSEHOLD {
    uuid id
    string name
    string invite_code "8 chars, 7 days"
  }
  ACCOUNT {
    uuid id
    string user_name "unique"
    string display_name
    string password_hash "PBKDF2"
  }
  PROFILE {
    uuid id
    string name
    string avatar "emoji"
    string kind "adult | child"
    string age_band "3-5, 6-8, 9-12, 13-17"
    string pin_hash "optional"
  }
```

- An **account** is an adult who can sign in. Every account has one **adult profile** created with it.
- A **household** groups adults and the profiles they manage. Adults join an existing household with an invite code.
- A **profile** is a player. Children only ever have profiles — never accounts or passwords.
- Saves and scores belong to a profile (on the device today; synced with milestone M2).

Tables live in the `identity` (accounts) and `households` (households, profiles) schemas. Data Protection keys
(used to encrypt session cookies) live in `platform.data_protection_keys`.

## A device's life

```mermaid
sequenceDiagram
  actor A as Adult
  actor C as Child
  participant H as Hub
  participant API

  A->>H: sign in (username, password)
  H->>API: POST /api/auth/login
  API-->>H: session cookie (90 days, sliding)
  H->>C: "Ai đang chơi?" profile picker
  C->>H: taps own avatar (+ PIN if set)
  H->>API: PUT /api/session/profile
  API-->>H: cookie now carries the active profile
  C->>H: plays — catalog filtered by the profile's age band
  A->>H: "Quản lý gia đình"
  H->>A: parent gate: password again
  H->>API: POST /api/session/parent-gate
  API-->>H: management unlocked for 10 minutes
```

## Rules

| Rule | Where it is enforced |
| --- | --- |
| Household management needs the parent gate (password within the last 10 minutes) | `Parent` authorization policy on `/api/household/*` |
| Only child profiles can be deleted; an adult profile belongs to its account | Households module |
| An adult profile can only be edited by its own account | Households module |
| A PIN is exactly 4 digits and stored hashed; wrong PINs are rate limited | Session endpoints |
| Children see only games whose `minAge` is at most the lower bound of their age band | Registry, via `IActiveProfile` |
| Unsafe `/api` requests from another origin (`Sec-Fetch-Site` ≠ `same-origin`) are rejected | `SameOriginGuard` middleware |
| Sign-in, registration, PIN and parent gate: 10 requests per minute per client IP | Rate limiter policy `auth` |
| 10 wrong passwords lock an account for 5 minutes | ASP.NET Core Identity lockout |

## Guest mode

"Chơi thử" lets anyone play without an account, with one local guest profile per device (saves stay on the
device). The first time a real profile is chosen on that device, the hub offers to move the guest's progress to it.

## API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` | — | Create an account; new household, or join one with an invite code |
| `POST /api/auth/login` / `POST /api/auth/logout` | — / session | Sign in / out |
| `GET /api/auth/me` | session | Account, household, members, profiles, active profile, parent-gate expiry |
| `PUT /api/session/profile` / `DELETE` | session | Choose (PIN if set) / clear the active profile |
| `POST /api/session/parent-gate` / `DELETE` | session | Unlock / lock household management |
| `GET /api/profiles/options` | — | Allowed avatars and age bands |
| `PATCH /api/household` | parent | Rename the household |
| `POST /api/household/invite` / `DELETE` | parent | Create / revoke the invite code |
| `POST /api/household/profiles` | parent | Add a child profile |
| `PATCH` / `DELETE /api/household/profiles/{id}` | parent | Edit / remove a profile |

Errors are problem details; a machine-readable `code` (e.g. `invalid_credentials`, `pin_required`, `pin_invalid`,
`parent_gate_required`, `username_taken`, `invite_invalid`) lets the hub show a Vietnamese message.
