---
title: "0043: Every player is a profile — of this device or of an account; what is asked for is the highest level any source needs"
description: A device profile belongs to one device, needs no account and reaches the server only when its player does something that needs it; games, platform features and rooms each ask for a level — any, named or account — and the hub asks for the highest, then links a device profile into an account keeping its id.
sidebar:
  order: 43
---

- **Status:** Accepted
- **Date:** 2026-10-20
- **Amends:** [ADR 0023](0023-accounts-own-their-profiles.md) — an account's profile may come from a device, keeping its
  id; [ADR 0024](0024-email-identifies-an-account.md) — a device profile has no email and no account;
  [ADR 0016](0016-online-rooms-for-turn-based-games.md) — a room admits `named` device profiles;
  [ADR 0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md) — the age and consent line moves to the first time a
  device profile goes online; [ADR 0029](0029-integrity-engine-and-boards-by-trust.md) — a device profile's results
  have the lowest trust
- **Decided by:** the owner, 2026-10-19 (plans/product-surface D-06 and D-07: "ổn nha, theo đề xuất")

## Context

Today a player is either a **guest** — one local profile per device that never reaches the server — or a profile of an
**account** (ADR 0023). Everything with other people needs an account: a friend invited to a table must sign up and
wait for an email code before playing. Since 2026-10-20 the hub enters guest mode by itself, so newcomers play at once;
the step from "playing" to "playing with someone" is still a wall.

The owner (2026-10-19): some games need an account, others only a name that others see, and that name should be able
to live on the device and be linked to an account later — which also covers offline games and friends inviting
friends.

Constraints: offline-first ([ADR 0005](0005-offline-first.md)); collect as little as possible — no server record for
a visit that does not need one; games never call the API; a profile of a child in an account must not sit at a table
with strangers when its parent said so; the law on children's data (Nghị định 13/2023, Article 20) applies the moment
a profile of a possibly under-16 player is processed on the server.

## Decision

### Two kinds of profile

| | **Device profile** ("Hồ sơ trên máy này") | **Account profile** (ADR 0023) |
| --- | --- | --- |
| Belongs to | one device: a browser, or an installed app | an account: one to five profiles |
| Has | a name (suggested, editable), an avatar, saves and scores local-first | also a 12-digit ID, sync on every device, higher trust |
| On the server | **only when needed**: a table, a link, a move to another device | always |
| Never has | an email, a 12-digit ID, public boards, ranked runs, invites by ID | — |
| Offline | yes | yes, synced later |
| Becomes | an account profile **with the same id**, when linked | — |

A device holds up to **five** device profiles. Today's guest becomes the device's **first device profile**, moved over
automatically with its saves and scores.

### Three levels, three sources, the highest wins

| Level | Means | When the player's profile is short of it, the hub |
| --- | --- | --- |
| `any` | any profile will do | makes a device profile **silently**, with a suggested name |
| `named` | others will see the name | shows **one screen**: name and avatar, then "Vào chơi" — and "Đã có tài khoản? Đăng nhập" |
| `account` | sync, an ID, trust | shows **the sign-in sheet**: Google, or email; then links the device profile (below) |

| Source | Set by | Example |
| --- | --- | --- |
| The game | its `game.json`: `identity.play` (default `any`), `identity.rooms` | a solo game: `any`; an economy synced across devices: `account` |
| The platform's feature | this ADR | an online table: at least `named`; ranked runs, public boards, inviting or being invited by ID: `account` |
| The table or the invitation | its creator | "Ai có link cũng vào" (`named`, the default for a new table) · "Chỉ tài khoản" (`account`) · "Chỉ hồ sơ trong tài khoản tôi" |

The hub asks for the highest of the three, at the moment the player needs it — opening a game, following a link, or a
game asking in the middle of play. A game only declares; the hub does the asking; a game never signs anyone in.

### A device profile on the server

- **Lazily**: the first time its player does something that needs the server. The hub calls the API once and gets a
  **device key** in an `HttpOnly`, `__Host-` cookie; the server keeps the profile's id, name, avatar, when it was made
  and last used, and a hash of the key — no email, nothing else about the person.
- Abuse: the proof-of-work of [ADR 0037](0037-proof-of-work-before-a-code-by-email.md), a limit per address, the name filter of
  [ADR 0035](0035-filter-offensive-names-and-limit-renames.md), five profiles per device.
- Cleanup: a device profile **unused on the server for 90 days** is deleted there; the copy on the device stays and
  goes up again when needed.
- **Lowest trust** (ADR 0029): its results count at its tables and on its own boards, **never** on public boards — not
  even later, once it is linked to an account.
- **Children**: an account's child profile whose "play with outsiders" switch is off never sits with a device profile —
  a device profile is always an outsider.
- **Age and consent**: the `named` screen, the first time a device profile goes online, carries one line — "Tôi đồng ý
  Điều khoản và từ 16 tuổi trở lên, hoặc bố mẹ đã cho phép"; under 16, "Nhờ bố mẹ" leads to a child profile in an
  account. A device profile that stays on the device sends nothing and needs no consent. The owner reviews the wording
  with the terms; this is not legal advice.
- **Deleting** a device profile deletes it on the device and on the server.

### Linking a device profile into an account

Keep the id whenever possible; when two profiles must become one, ask once per device profile with a sensible
default; never merge a profile of someone else on a shared device; lose nothing silently. Linking is managing an
account, so it needs the step-up of [ADR 0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md).

| Case | Default | Other choices |
| --- | --- | --- |
| A device profile **signs up** | it **becomes the account's first profile** (same id); no empty profile is made | — |
| It **signs in** to an account with room (fewer than five) | **added** to the account (same id) | merge into one of its profiles · keep on this device |
| The account is full | **merge into** a profile (the hub suggests one with the same name or avatar) | keep on this device |
| A shared device with several device profiles | ask for **each one with progress**; the default links only the one playing | "keep on this device" for the others |
| The same person on two devices | the second device **merges into** the profile linked from the first | — |
| An iPhone moving from Safari to the installed app (storage is not shared) | suggest linking to an account first (the session cookie follows) | the transfer code |
| A new device, or a browser cleared, without an account | the **transfer code**: six digits or a QR, alive ten minutes, for a profile already on the server; it **moves** the profile — the old device's copy is removed | — |
| Signing out of an account | its profiles leave the device; device profiles stay | — |
| Deleting an account ([ADR 0034](0034-delete-accounts-and-profiles-for-good.md)) | linked profiles go with it, like any account profile | unlinked device profiles stay |
| A suspended account | no linking, as for any way into an account | device profiles still play |
| A child's device profile added to an account | the adult chooses the adult or child template right then (ADR 0025) | — |

Merging: a save present on one side is taken; present on both, the newer wins and the other is kept as the previous
version ([ADR 0005](0005-offline-first.md)); scores, table results and replays move to the target, an old id stays
reachable through an alias; links the device profile made move with it; results earned as a device profile never reach
a public board; the target keeps its name and avatar, the device profile's name goes into the name history.

### In steps

1. **I1 — device profiles in the hub**: the guest becomes the first device profile; up to five per device; the `named`
   screen (local until step 2); linking on sign-up (same id) and on sign-in (add, merge, keep), deleting a device
   profile. The API gains the adoption of a device profile's id and the merge.
2. **I2 — device profiles on the server**: the device key, the table, abuse limits, the 90-day cleanup, the age and
   consent line, tables open to `named` device profiles (the default for a new table), the lowest trust, the transfer
   code.
3. **I3 — entry links** and **I4 — the Game Contract's `identity`** follow their own ADRs. Until I4, every game asks for
   `any`.

### Not done

- An anonymous server account for every visitor (Firebase-style): a server record for every visit, against offline-first
  and data minimisation.
- Device profiles on public boards, ever — even backdated once linked.
- Copying a profile to a second device (two divergent copies of one id): playing on several devices is what an
  account is for.

## Consequences

- The hub's session model changes: the guest is gone; a device profile is a profile like any other for saves, scores
  and games (`init.profile` gains `kind: "device" | "account"` with I4).
- New API surface: adopting a device profile id into an account and merging (I1); device keys, device profiles, the
  transfer code (I2). Every new way into a profile checks suspension, switches and a pending deletion, as
  `SessionWriter.SignInAsync` does.
- A migration with I2 (the device profiles table, the alias table); I1 needs none if an account profile can take a given
  id — otherwise it says so.
- `docs/architecture/identity.md` describes both kinds, the levels and linking; the hub's copy says "Hồ sơ trên máy
  này"; the terms and privacy notice cover device profiles before I2 ships (the owner, with E-05).
- E2E: a new device plays as a device profile; sign-up keeps the id and its progress; sign-in offers add, merge, keep.

## Alternatives considered

- **Keep the guest and accounts, add only OAuth.** Least work; no online play without an account, so the room link
  still walls off the invited friend. Lost: it does not cover the owner's second case.
- **An anonymous account on the server for everyone, at once.** One data model; but a record for every visit (abuse,
  cleanup), against offline-first, and solo games need no server at all.
- **Always add a linked device profile as a new account profile.** Simple; stuck when the account is full, and one
  person on two devices becomes two profiles.
- **Merge every device profile into the profile in use.** No questions; wrong on a shared device — a younger sibling's
  progress would end up in the elder's profile.
