---
title: Identity, accounts and profiles
description: How people sign up and in by email, how one account plays as several profiles, how profiles are told apart, and how managing them is protected.
sidebar:
  order: 4
---

Decisions: [ADR 0024](../decisions/0024-email-identifies-an-account.md) (email identifies an account, codes bound to
attempts), [ADR 0023](../decisions/0023-accounts-own-their-profiles.md) (accounts own profiles, public IDs, names),
[ADR 0011](../decisions/0011-password-sign-in-first.md) (passwords, sessions, parent gate). ADR 0004 (households) is
superseded.

## Model

```mermaid
erDiagram
  ACCOUNT ||--|{ PROFILE : "owns 1 to 5"
  ACCOUNT ||--o{ AUTH_ATTEMPT : "resets, email changes"
  ACCOUNT {
    uuid id
    string email "unique, verified, signs in"
    string user_name "opaque, or an old account's sign-in until it adds an email"
    string display_name "names the first profile"
    string password_hash "PBKDF2"
    string security_stamp "changes with the password or the email"
    bool telemetry_enabled "ADR 0015"
  }
  PROFILE {
    uuid id
    string public_id "12 digits, unique, never changes"
    string name "free, 1 to 24 visible characters"
    string avatar "emoji"
    string kind "adult or child"
    string age_band "children: 3-5, 6-8, 9-12, 13-17"
    string pin_hash "optional"
    bool play_with_others "children: off by default"
  }
  AUTH_ATTEMPT {
    uuid id "held by the client, sent back with the code"
    string purpose "sign-up, reset, email change"
    string email "where the code went"
    string code_hash "none for a decoy"
    int tries_left "5"
    timestamp expires_at "15 minutes"
  }
```

- An **account** is someone who signs in, with one **verified email** that nobody else ever sees. It owns one to five
  **profiles**: the first is created with the account and named with its display name, and the last can never be
  removed. A family is one account with a profile per player.
- A **profile** is a player. Children only ever have profiles — never accounts, emails or passwords. Any profile may
  have a PIN.
- Every profile has a **public ID**: 12 digits shown as `1234 5678 9012`. The first 11 are random (the first never 0),
  the last is a [Damm](https://en.wikipedia.org/wiki/Damm_algorithm) check digit, so a single mistyped digit or two
  swapped neighbours never point at another profile. It never changes and is not a secret — an address, never a way to
  sign in (`ProfileIds`, mirrored in the hub's `session/profileIds.ts`).
- **Names** are free and not unique: the ID tells profiles apart. See [Names](#names).
- An **attempt** waits for a code sent by email: signing up, a forgotten password, a new sign-in email.
- Saves and scores belong to a profile; boards show the profiles of one account.

Tables live in the `identity` schema (`accounts`, `profiles`, `auth_attempts`). Data Protection keys (used to encrypt
session cookies) live in `platform.data_protection_keys`.

## Signing up

```mermaid
sequenceDiagram
  autonumber
  actor U as Person
  participant H as Hub
  participant A as API
  participant M as Email outbox
  U->>H: email, a name, a password
  H->>A: POST /api/auth/register
  A->>A: email on? · limits per IP and per address · password and name rules
  alt the address has no account
    A->>A: attempt {code hash, password hash, name, 15 min, 5 tries}
    A->>M: "Mã đăng ký Tò He: 482 913" + a link
  else the address has an account
    A->>A: decoy attempt — no code opens it
    A->>M: "Bạn đã có tài khoản Tò He" + a link to sign in
  end
  A-->>H: 202 {attemptId} — the same answer either way
  U->>H: the code (or the link, opened on any device)
  H->>A: POST /api/auth/register/confirm {attemptId, code}
  alt right code, open attempt, address still free
    A->>A: the account (email confirmed) and its first profile, in one transaction
    A-->>H: 200 + session cookie, playing as that profile
  else wrong code
    A-->>H: 400 code_invalid {triesLeft} — the fifth wrong one closes the attempt
  else expired, used, out of tries, or the address was taken meanwhile
    A-->>H: 400 attempt_closed — start again
  end
```

There is no "unverified" account: the password waits in the attempt until the code comes back. Since a code opens only
the attempt it was sent for, someone who signed up first with another person's address cannot use the code that
person receives, and the owner's own attempt is unaffected by theirs.

## One-time codes

| For | Sent to | Link in the email |
| --- | --- | --- |
| Signing up | the address signing up | `/register/confirm?attempt=…&code=…` |
| A forgotten password | the account's address | `/password/reset?attempt=…&code=…` |
| A new sign-in email | the new address | `/account/email?attempt=…&code=…` |

Every code: six random digits, stored hashed, used once, bound to its attempt, alive 15 minutes, five tries — counted in
the database, so tries made at the same moment all count. One address gets one code a minute and five an hour,
whatever they are for (`code_cooldown`, `too_many_codes`). Links need `App:PublicUrl`; without it the email carries the
code alone. Attempts a day past their end are deleted when the next one starts.

## Signing in

```mermaid
flowchart TD
  start["Email — or an old account's username — and password"] --> rl{"Under the per-IP limit?"}
  rl -- no --> slow["429"]
  rl -- yes --> find{"An account signs in with it<br/>and has a password?"}
  find -- no --> miss["401 invalid_credentials<br/>(after hashing anyway: a miss takes as long as a wrong password)"]
  find -- yes --> lock{"Locked out?<br/>10 wrong in a row → 5 min"}
  lock -- yes --> locked["429 locked_out"]
  lock -- no --> right{"Password right?"}
  right -- no --> fail["Count the failure"] --> miss
  right -- yes --> session["Session cookie"]
  session --> only{"One profile, no PIN?"}
  only -- yes --> play["Plays as it at once"]
  only -- no --> picker["Ai đang chơi?"]
```

An account from before email sign-in still signs in with its username. Right after it does, the hub asks for an email
and sends the password just typed along as the proof; once the code comes back, only the email signs in.

## A forgotten password

```mermaid
sequenceDiagram
  autonumber
  actor U as Person
  participant H as Hub
  participant A as API
  participant M as Email outbox
  U->>H: email
  H->>A: POST /api/auth/password/forgot
  alt an account signs in with it
    A->>A: attempt {code hash, 15 min, 5 tries}
    A->>M: "Mã đặt lại mật khẩu Tò He" + a link
  else no account does
    A->>A: decoy attempt, and no email
  end
  A-->>H: 202 {attemptId} — the same answer either way
  U->>H: the code and a new password
  H->>A: POST /api/auth/password/reset {attemptId, code, password}
  A->>A: password rules first — a weak one costs no try — then the code
  A->>A: the new password, a new security stamp, any lockout ended
  A->>A: a pending email change is cancelled
  A->>M: "Mật khẩu Tò He của bạn đã đổi"
  A-->>H: 200 + a fresh session here — every other one ends within 5 minutes
```

## A new sign-in email

```mermaid
sequenceDiagram
  autonumber
  actor U as Account owner
  participant H as Hub
  participant A as API
  participant M as Email outbox
  U->>H: a new email — the parent gate open, or the password with it
  H->>A: POST /api/account/email {email, password?}
  alt no account signs in with it
    A->>A: attempt for this account — replaces an earlier one
    A->>M: "Mã xác nhận email Tò He" to the new address + a link
  else another account does
    A->>A: decoy attempt
    A->>M: "Email này đã có tài khoản Tò He" to that address
  end
  A-->>H: 202 {attemptId}
  U->>H: the code
  H->>A: POST /api/account/email/confirm {attemptId, code}
  A->>A: the new email (confirmed), a new security stamp
  A->>M: to the old address: "Email đăng nhập Tò He đã đổi", the new one masked
  A-->>H: 200 — this device carries on, every other session ends
```

## Sessions

| What | How |
| --- | --- |
| Cookie | `tohe.session` — `__Host-tohe.session` behind an HTTPS hub (ADR 0021) — 90 days, sliding, HttpOnly, `SameSite=Lax` |
| In the cookie | the active profile and the parent gate's expiry |
| Checked against the account's security stamp | every 5 minutes (`Identity:SessionCheckInterval`) |
| The stamp changes when | the password is reset · the sign-in email changes |

## A device's life

```mermaid
sequenceDiagram
  actor P as Account owner
  actor C as Child
  participant H as Hub
  participant API

  P->>H: sign in (email, password)
  H->>API: POST /api/auth/login
  alt one profile without a PIN
    API-->>H: session cookie, already playing as that profile
  else several profiles, or a PIN
    API-->>H: session cookie
    H->>C: "Ai đang chơi?" profile picker
    C->>H: taps own avatar (+ PIN if set)
    H->>API: PUT /api/session/profile
    API-->>H: cookie now carries the active profile
  end
  C->>H: plays — catalog filtered by the profile's age band
  P->>H: "Quản lý tài khoản"
  H->>P: parent gate: password again
  H->>API: POST /api/session/parent-gate
  API-->>H: management unlocked for 10 minutes
```

Signing up plays the new profile at once, and so does signing in to an account with one profile and no PIN — nobody
else to choose, and one sign-in request fewer. The hub then sends the device through the picker with
`/profiles?auto=true`, which goes straight on (offering the guest's progress first, if this device has some), and
which also chooses a lone PIN-less profile by itself when a page needs a player and none is chosen. Opened by hand
("Đổi người chơi"), the picker always shows, so a one-profile account can still add a profile or manage the account.

## Names

| Rule | Why |
| --- | --- |
| 1 to 24 visible characters (grapheme clusters: an emoji family is one), at most 128 UTF-16 units stored | Fits a seat or a board row; a chain of emoji joined by zero-width joiners is one character of any length |
| Whitespace of any kind becomes one plain space; leading and trailing spaces go | "Bé   Na" and "Bé Na" look alike, so they are alike |
| No control, private-use, unassigned or format characters — except the zero-width joiner, variation selectors and tag characters emoji need | No direction overrides, zero-width tricks or invisible text |
| No letters that draw nothing (Hangul and braille fillers) | A name made of them looks empty |
| At most three combining marks on one character | Vietnamese needs two; more is "zalgo" |
| Not a reserved name — Admin, Moderator, Support, System, Official, Tò He, Quản trị (viên), Kiểm duyệt, Hỗ trợ, Hệ thống, Chính thức, Người chơi đã xoá — compared without case, marks, separators or hidden joiners | Nobody passes for the platform. "Tò-HE 🦊" is taken; "Admin Nhí" is not |

The API runs with invariant globalization (no ICU), where `string.Normalize` does nothing beyond ASCII. So the hub
sends names composed (`normalize('NFC')`), the rules hold for composed and decomposed text alike, and reserved names
are matched through a table of Latin letters with marks (`ProfileNames`). The hub counts characters with
`Intl.Segmenter` to warn early; the API decides.

## Rules

| Rule | Where it is enforced |
| --- | --- |
| One account per sign-in email; an account exists only once the code sent to it came back | `email_index` (unique) on `identity.accounts`; `AuthEndpoints` |
| A code opens only its attempt; five tries, 15 minutes; one address gets a code a minute and five an hour | `Attempts`, `Codes` |
| No answer tells whether an address has an account: decoy attempts, the same 202, a miss as slow as a wrong password | `AuthEndpoints`, `AccountEmailEndpoints` |
| Changing the sign-in email needs the password (with the request, or the parent gate) and a code at the new address | `AccountEmailEndpoints` |
| Managing the account and its profiles needs the parent gate (password within the last 10 minutes) | The parent-gate endpoint filter on `/api/account` and `/api/profiles/*` (`ProfileEndpoints.Gated`) |
| An account owns at least one and at most five profiles; changes to them are serialized on the account's row, so requests at the same time cannot break the limits | Identity module (`ProfileEndpoints`) |
| An account sees, manages and plays as its own profiles only; another account's profile is "not found" | Identity module, `IActiveProfile` |
| Public IDs are unique and given once, when the profile is made | `ProfileIds`, unique index on `public_id` |
| A PIN is exactly 4 digits and stored hashed; wrong PINs are rate limited | Session endpoints |
| Children see only games whose `minAge` is at most the lower bound of their age band | Registry, via `IActiveProfile` |
| A child plays online with other accounts only when the account's owner turned on "Chơi online với người ngoài" (`playWithOthers`, off by default); otherwise only at tables the account keeps to itself | Rooms, via `IActiveProfile` ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)) |
| Saves, scores and the leaderboard belong to the active profile; boards list the account's profiles | Progress, via `IActiveProfile` and `IAccountProfiles` |
| Unsafe `/api` requests from another origin (`Sec-Fetch-Site` ≠ `same-origin`) are rejected | `SameOriginGuard` middleware |
| Per client IP, 10 requests a minute in each of three buckets: signing in or asking for a code (`auth`), typing a code back (`auth-code`), a PIN or the parent gate (`auth-gate`) | Rate limiter policies; `Identity:AuthRequestsPerMinute` |
| 10 wrong passwords lock an account for 5 minutes; a password reset ends the lockout | ASP.NET Core Identity lockout |

## Guest mode

"Chơi thử" lets anyone play without an account, with one local guest profile per device (saves stay on the
device). The first time a real profile is chosen on that device, the hub offers to move the guest's progress to it.

## API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` | — | Start signing up: a code to the email — 202 and an attempt, whoever the address belongs to |
| `POST /api/auth/register/confirm` | — | The code creates the account and its first profile, which plays at once |
| `POST /api/auth/login` / `POST /api/auth/logout` | — / session | Sign in with the email (an old account's username until it adds one) / out |
| `POST /api/auth/password/forgot` | — | A code to set a new password, if the address has an account — 202 either way |
| `POST /api/auth/password/reset` | — | The code sets the new password; every other session ends |
| `GET /api/auth/me` | session | Account (with its email), its profiles (with public IDs), active profile, parent-gate expiry |
| `PUT /api/session/profile` / `DELETE` | session | Choose (PIN if set) / clear the active profile |
| `POST /api/session/parent-gate` / `DELETE` | session | Unlock / lock account management |
| `POST /api/account/email` | session + parent gate, or the password | A code to a new sign-in email |
| `POST /api/account/email/confirm` | session | The code makes it the sign-in email; every other session ends |
| `GET /api/profiles/options` | — | Allowed avatars and age bands; how many profiles an account may own |
| `PATCH /api/account` | parent | The account's telemetry switch |
| `POST /api/profiles` | parent | Add a profile: a child's with an age band, an adult's without |
| `PATCH` / `DELETE /api/profiles/{id}` | parent | Edit (incl. a child's `playWithOthers`) / remove a profile — never the last |

`GET /api/config` says whether the server sends email (`email`); without it, nothing that needs a code starts
(`email_unavailable`).

Errors are problem details; a machine-readable `code` lets the hub show a Vietnamese message: `invalid_credentials`,
`locked_out`, `email_invalid`, `email_unavailable`, `email_unchanged`, `code_invalid` (with `triesLeft`),
`attempt_closed`, `code_cooldown`, `too_many_codes`, `password_too_short`, `password_invalid`, `pin_required`,
`pin_invalid`, `parent_gate_required`, `too_many_profiles`, `last_profile`, `name_required`, `name_invalid_character`,
`name_too_long`, `name_reserved`.

## From households

The migration `AccountsOwnProfiles` moved UAT's households in place (ADR 0023): each adult kept their account and
profile; a household's children went to its first adult (the earliest account); its telemetry switch went to each of
its accounts; rooms, seats and results now name accounts; every profile got a public ID. `MigrationTests` runs it over
a seeded database of the old shape. The way back is the backup `deploy/uat/deploy.sh` takes before every deploy.
