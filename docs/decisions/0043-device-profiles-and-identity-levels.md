---
title: "0043: Every player is a profile — of this device or of an account; what is asked for is the highest level any source needs"
description: A device profile belongs to one device, needs no account and reaches the server only when its player does something that needs it; games, platform features and tables each ask for a level — any, named or account — and the hub asks for the highest, then brings a device profile into an account keeping its id when it safely can.
sidebar:
  order: 43
---

- **Status:** Accepted — steps I1 and I2 built. I2 came in two: **I2a** — the device key and its scheme, a device
  profile's copy on the server with the terms line and the `named` screen, tables open to `named` device profiles (the
  default), the children rule, results marked, bringing a copy into an account, the 90-day cleanup, moderation
  ([Identity](../architecture/identity.md#device-profiles-on-the-server),
  [Online rooms](../architecture/rooms.md#who-may-sit)); **I2b** — the transfer code, by QR code at once or by six
  digits the old device confirms ([Identity](../architecture/identity.md#the-transfer-code)), and merge aliases, so
  replays and links naming a merged id no longer break ([Identity](../architecture/identity.md#merge-aliases)). The
  identity gate is one step of the hub's entry pipeline, and making a link is a `named` feature, by
  [ADR 0044](0044-entry-links.md) (step I3)
- **Date:** 2026-10-20
- **Amends:** [ADR 0023](0023-accounts-own-their-profiles.md) — an account's profile, its first one included, may come
  from a device, keeping its id and name; [ADR 0024](0024-email-identifies-an-account.md) — a device profile has no
  email and no account; [ADR 0016](0016-online-rooms-for-turn-based-games.md) — a table admits `named` device profiles,
  and a seat may carry no account; [ADR 0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md) — the terms and
  age line is also asked the first time a device profile's data reaches the server, and a player under 16 may then go
  on with a parent's permission, which they confirm; [ADR 0029](0029-integrity-engine-and-boards-by-trust.md) — results
  earned by a device profile are in no public board's audience; [ADR 0037](0037-proof-of-work-before-a-code-by-email.md)
  — the proof-of-work also guards making a device profile on the server and redeeming a transfer code
- **Decided by:** the owner, 2026-10-19 (plans/product-surface D-06 and D-07: "ổn nha, theo đề xuất"); the agent filled
  in what an implementer needs, marked below where the owner should look

## Context

Today a player is either a **guest** — one local profile per device that never reaches the server — or a profile of an
**account** (ADR 0023). Everything with other people needs an account: a friend invited to a table must sign up and
wait for an email code before playing. Since 2026-10-20 the hub enters guest mode by itself, so newcomers play at once;
the step from "playing" to "playing with someone" is still a wall.

The owner (2026-10-19): some games need an account, others only a name that others see, and that name should be able
to live on the device and be brought into an account later — which also covers offline games and friends inviting
friends.

Constraints: offline-first ([ADR 0005](0005-offline-first.md)); collect as little as possible — no server record for
a visit that does not need one; games never call the API; a profile of a child in an account must not sit at a table
with strangers when its parent said so. On children's data, R-07 of plans/public-launch reads Decree 13/2023 article 20
and Law 91/2025 as applying once a possibly under-16 player's data is processed on the server; the owner checks the
wording against the texts — nothing here is legal advice.

## Decision

### Two kinds of profile

| | **Device profile** ("Hồ sơ trên máy này") | **Account profile** (ADR 0023) |
| --- | --- | --- |
| Belongs to | one device: a browser, or an installed app | an account: one profile up to the account's limit |
| Has | a name (suggested, editable), an avatar, saves and scores local-first | also a 12-digit ID, sync on every device |
| On the server | **only when needed**: a table, a link, a move to another device | always |
| Never has | an email, a 12-digit ID, public boards, ranked runs, invites by ID | — |
| Offline | yes | yes, synced later |
| Becomes | an account profile, keeping its id when it safely can (below) | — |

A device holds up to **five** device profiles. Today's guest becomes the device's **first device profile**, moved over
automatically with its saves and scores. Like today's guest, a device profile has no age: it sees every game (no
`minAge` filter); age is asked when its data first reaches the server (below). *The owner may revisit this.*

### Three levels, three sources, the highest wins

| Level | Means | When the player's profile is short of it, the hub |
| --- | --- | --- |
| `any` | any profile will do | makes a device profile **silently**, with a suggested name |
| `named` | others will see the name | shows **one screen**: name and avatar, then "Vào chơi" — and "Đã có tài khoản? Đăng nhập" |
| `account` | sync, an ID, a public board | shows **the sign-in sheet**: Google, or email; then brings the device profile in (below) |

| Source | Set by | Example |
| --- | --- | --- |
| The game | its manifest — field names indicative, decided by the I4 ADR with the Game Contract | a solo game: `any`; an economy synced across devices: `account` |
| The platform's feature | this ADR | an online table: at least `named`; ranked runs, public boards, inviting or being invited by ID: `account` |
| The table or the invitation | its creator | "Ai có link cũng vào" (`named`, the default for a new table) · "Chỉ tài khoản" (`account`) · "Chỉ hồ sơ trong tài khoản tôi" |

The hub asks for the highest of the three, at the moment the player needs it — opening a game, following a link, or a
game asking in the middle of play. A game only declares; the hub does the asking; a game never signs anyone in. Until
I4 every game asks for `any`, and until I2 a table still asks for `account`.

### Ids, and who may act for a device profile

- The device makes a device profile's id (a random UUID). The server takes it **only if it is unknown** — to profiles,
  to merge aliases and to retired ids (ADR 0034). Otherwise the server refuses, and the hub gives the device profile a
  new id on the device and moves its data under it. Profile ids are not secrets — boards and replays show them — so an
  id alone never proves anything.
- Once a device profile exists on the server, every operation on it — bringing it into an account, merging, a
  transfer, an upload — needs **its device's key**. Once it is in an account, the device key no longer speaks for it;
  the account's session does.
- Deleting a device profile, and the 90-day cleanup, go through ADR 0034's mechanism (the modules withdraw and purge
  its data; its seats read "Người chơi đã xoá") and retire its id. A device that later needs the server again for a
  profile whose server copy was cleaned up gets a new id for it, with its data moved under it.

### A device profile on the server

- **Lazily**: the first time its player does something that needs the server. The hub calls the API once.
- **One device key per device**, for up to five device profiles, in a cookie: `HttpOnly`; `Secure` and `__Host-` on
  HTTPS, a plain name on HTTP, as for the players' session; `SameSite=Lax`; `Path=/`; renewed on use and expiring
  after 90 days unused. When an account session and a device key are both present, the picker shows both kinds of
  profile; each kind is authenticated only by its own credential — the device key never acts for an account profile,
  an account session never for a device profile that is not in its account.
- **Stored on the server**: the device (the key's hash, when it was made and last seen); each device profile (id, name,
  avatar, the terms version and acceptance time, when it was made and last used); and, once it plays with others or is
  moved, its game data — saves and scores (uploaded for a transfer), seats and results at tables. Nothing else about
  the person. All of it is kept until the profile is deleted, cleaned up, moved, or brought into an account.
- **Abuse**: the proof-of-work of ADR 0037 (following the console's switch, as for codes by email), a limit per IP,
  the name filter of [ADR 0035](0035-filter-offensive-names-and-limit-renames.md), five per device.
- **Cleanup**: a device profile **unused on the server for 90 days** is deleted there; the copy on the device stays.
- **Boards**: its results keep the levels their evidence earns (ADR 0029), but they are in **no public board's
  audience** — they count at its tables only. The server marks every result it receives for a device profile, before
  or while it is brought into an account, as earned by a device profile; marked results never reach a public board,
  even once the profile is an account's.
- **Children**: an account's child profile whose "play with outsiders" switch is off never sits with a device profile —
  a device profile is always an outsider.
- **Terms and age**: the first time a device profile's data reaches the server — **by any path**: the `named` screen, a
  table, a transfer code — the player confirms one line: "Tôi đồng ý Điều khoản và từ 16 tuổi trở lên, hoặc bố mẹ đã cho
  phép"; "Nhờ bố mẹ" leads to a child profile in an account instead. The server keeps the terms version and the time,
  and asks again when the documents change, as ADR 0025 does. A device profile that stays on the device sends nothing
  about the profile (device telemetry, ADR 0015, names no profile). The owner reviews the wording with the terms.
- **Moderation**: the console can hide a device profile's name and remove it from a table, as for any profile
  (ADR 0035, ADR 0027).

### Bringing a device profile into an account

Keep the id when it is safe; when two profiles must become one, ask once per device profile with a sensible default;
never merge a profile of someone else on a shared device; lose nothing silently. Adding or merging a device profile is
**profile management**: step-up level 1, as adding a profile today (ADR 0025). Signing up needs none — the person has
just proved the address.

| Case | Default | Other choices |
| --- | --- | --- |
| A device profile **signs up** | "Hồ sơ 'Mèo Cam' là của bạn?" — yes: it **becomes the account's first profile** (same id, its name, an adult profile, a 12-digit ID given now); no empty profile is made | no, it is my child's: the account gets its usual first profile, and the device profile is added as a child profile (ADR 0025's template) |
| It **signs in** to an account below its profile limit | **added** to the account (same id) | merge into one of its profiles · keep on this device |
| The account is at its limit | **merge into** a profile (the hub suggests one with the same name or avatar) | keep on this device |
| A shared device with several device profiles | ask about **each device profile that has progress**; the default brings in only the one playing | "keep on this device" for the others |
| A device profile that already sat at tables | as above; its seats and results follow its id, or the alias after a merge | — |
| The same person on two devices | the second device suggests merging into a profile with the same name or avatar; the player picks | — |
| An iPhone moving from Safari to the installed app (storage is not shared) | suggest bringing it into an account first (the session cookie follows) | the transfer code |
| A new device, or a browser to be cleared, without an account | the **transfer code** (below), which moves the profile | — (a profile never on the server is lost with the browser's data; the hub warns before) |
| Signing out of an account | its profiles leave the device; device profiles stay | — |
| Deleting an account ([ADR 0034](0034-delete-accounts-and-profiles-for-good.md)) | profiles brought in go with it, like any account profile | device profiles not brought in stay |
| A suspended account | nothing can be brought in, as for any way into an account | device profiles still play |
| A child's device profile added to an account | the adult chooses the adult or child template right then (ADR 0025) | — |

*The owner may look at the first row's question — the agent added it so a parent signing up from a child's device
profile does not make that child an adult profile on public boards.*

**How the id travels at sign-up**: on the sign-up attempt (email, ADR 0024) or in the provider's state (Google); the
data goes up from the device that started it. When the email's link is opened on another device, the account is made
with its usual first profile and the original device offers to add the device profile the next time it is used.

**Merging**: a save present on one side is taken; present on both, the newer wins and the other is kept as the
previous version (ADR 0005); scores, table results and replays move to the target; an alias keeps the old id reachable
(from I2); links the device profile made move with it; results earned as a device profile stay marked (above); the
target keeps its name and avatar, the device profile's name goes into the name history. A device profile's name goes
through the name filter when it is brought in; a refused name is changed first.

**The transfer code** moves a device profile that is on the server to another device: six digits, or a QR code
carrying a long random secret; alive ten minutes; used **once**; redeeming it follows the proof-of-work and limits per
IP and overall (the `auth-code` bucket); a six-digit redemption is confirmed on the old device ("Máy mới muốn nhận Mèo
Cam?"). On redemption the old device's key stops speaking for the profile; the new device gets the profile, its saves
and scores. When the old device next opens the hub it says "Mèo Cam đã chuyển sang máy khác", and keeps anything saved
there since as a new device profile rather than dropping it.

### In steps

1. **I1 — device profiles in the hub**: the guest becomes the first device profile; up to five per device; renaming and
   adding device profiles (the `named` screen appears with I2, when a table first asks for it); bringing a device profile
   into an account on sign-up and sign-in (add; merge = upload under the target id, no alias yet); deleting a device
   profile. The API: adopting an id under the rules above, the server-side mark on results uploaded for a device
   profile, merging. The I1 pull request adds a migration if the mark or the adoption needs one.
2. **I2 — device profiles on the server**: the device key, the tables and the alias, the terms line, the 90-day
   cleanup, tables open to `named` device profiles (the default for a new table), moderation, the transfer code.
3. **I3 — entry links** and **I4 — the Game Contract's identity fields** follow their own ADRs.

### Not done

- An anonymous server account for every visitor (Firebase-style): a server record for every visit, against offline-first
  and data minimisation.
- Device profiles on public boards, ever — even backdated once brought into an account.
- Copying a profile to a second device (two divergent copies of one id): playing on several devices is what an
  account is for.

## Consequences

- The hub's session model changes: the guest is gone; a device profile is a profile like any other for saves, scores
  and games. The I1 pull request rewrites "Guest mode" in `docs/architecture/identity.md`.
- Rooms: a seat and a player may carry no account (`RoomActor.Player`, ADR 0016's "seats and results carry an
  account"), from I2.
- Every new way into a profile checks what `SessionWriter.SignInAsync` checks today: a suspension, the sign-in switches,
  `playWithOthers`, a pending deletion (`DeleteAfter`).
- The terms and privacy notice cover device profiles before I2 ships (the owner, with E-05).
- E2E: a new device plays as a device profile; sign-up keeps the id and its progress; sign-in offers add, merge, keep;
  an id already known to the server is refused and replaced.

## Alternatives considered

- **Keep the guest and accounts, add only OAuth.** Least work; no online play without an account, so the table link
  still walls off the invited friend. Lost: it does not cover the owner's second case.
- **An anonymous account on the server for everyone, at once.** One data model; but a record for every visit (abuse,
  cleanup), against offline-first, and solo games need no server at all.
- **Always add a device profile as a new account profile.** Simple; stuck when the account is full, and one person on
  two devices becomes two profiles.
- **Merge every device profile into the profile in use.** No questions; wrong on a shared device — a younger sibling's
  progress would end up in the elder's profile.
