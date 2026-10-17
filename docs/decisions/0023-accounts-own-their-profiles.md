---
title: "0023: Accounts own their profiles; every profile has a public ID and a free name"
description: Households and invite codes give way to accounts that own one to five profiles; a profile is told apart by a 12-digit public ID with a check digit, so its name can be anything fun.
sidebar:
  order: 23
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Supersedes:** [ADR 0004](0004-identity-households-and-profiles.md) (households) · **Amends:**
  [ADR 0011](0011-password-sign-in-first.md) (no invites; the parent gate guards the account and its profiles)

## Context

Tò He is opening to the public, for a few small communities. Most people who come will play on their own: one person,
one account. ADR 0004 put a family feature at the centre of the model instead — a household of adults sharing
profiles, joined with invite codes — and every module grew around it (rooms kept to a household, boards per
household, a telemetry switch per household).

Playing with strangers needs a way to point at one profile among many: to invite it by name, to show it on a board,
to report it. The owner wants profile names to be anything fun rather than unique handles, so something else has to
tell profiles apart. UAT holds a family's history (two adults, children, rooms, results) that has to come across.

## Decision

- **An account owns one to five profiles.** An account is someone who signs in. Its first profile is created with it,
  in the same transaction, named with the account's display name (the hub suggests a fun one, since profile names
  are public), and plays at once; signing in to an account with one profile and no PIN plays it at once too. The last
  profile cannot be removed. A family is one account with a profile for each player — households
  and invite codes are gone. The limit is served by `GET /api/profiles/options` (`maxProfiles`), so the hub never
  assumes it, and changes to an account's profiles are serialized on the account's row so concurrent requests cannot
  break the limits.
- **Profiles.** A name, an avatar, an optional 4-digit PIN (on any profile), and a kind chosen when the profile is
  made: a child's profile has an age band, which filters games, and may play with other accounts only when the owner
  allows it (`playWithOthers`, off by default). Only the owning account sees, manages or plays as its profiles, and
  only behind the parent gate (ADR 0011).
- **Every profile has a public ID:** 12 digits shown as `1234 5678 9012` — 11 random digits, the first never 0, then a
  Damm check digit. Random, so IDs reveal neither how many profiles exist nor their neighbours; the check digit catches
  every single-digit typo and every swap of two neighbouring digits, so a mistyped ID never reaches someone else. An
  ID is unique, given once, never changed, and not a secret: it is an address, never a credential. Inviting a profile
  by its ID comes later.
- **Names are free, not unique.** One to 24 visible characters (grapheme clusters, so an emoji family counts as one;
  at most 128 UTF-16 units stored), any script, Vietnamese marks, emoji. A few rails hold because names are shown to
  strangers: no control, private-use, unassigned or format characters, except the joiners and selectors emoji need;
  no letters that draw nothing (Hangul and braille fillers); at most three combining marks on one character; and none
  of the reserved names (Admin, Tò He, Quản trị, Hỗ trợ…), compared without case, marks, separators or hidden
  joiners. Every refusal is a code the hub explains (`name_required`, `name_invalid_character`, `name_too_long`,
  `name_reserved`).
- **The API does not normalize Unicode.** It runs with invariant globalization (no ICU in the chiseled image), where
  `string.Normalize` leaves anything beyond ASCII as it is. The hub sends names composed (NFC); the rules above hold for
  composed and decomposed text alike; reserved names are matched through a table of Latin letters with marks.
- **What was the household's is the account's.** The telemetry switch (ADR 0015). Rooms (ADR 0016): tables "for the
  household" become tables for the host's account (`accountOnly`); hosts, seats and results carry an account; room
  invitations reach the other profiles of the same account. Boards list the profiles of one account until boards
  across accounts arrive with their own ADR.
- **UAT's data moves in one migration** (`AccountsOwnProfiles`), written by hand so data moves before anything is
  dropped: each adult of a household keeps their account and profile; the household's children go to its first adult
  (the earliest account); its telemetry switch goes to each of its accounts; rooms, seats and results name accounts;
  every profile gets a public ID. A test runs the migration over a seeded copy of that shape. There is no way back
  but the backup `deploy/uat/deploy.sh` takes before every deploy.

We do not keep households as an optional layer, add co-owners to an account, or build a profanity filter, rename
limits or name history here; those are later work, each with its own decision.

## Consequences

- The second adult of a household keeps their own account and profile, but no longer manages or plays as the
  children, who belong to the first adult's account; a family signs its shared devices into that account. The owner
  accepted this; shared ownership of an account may come later.
- Every player has an address strangers can use without learning anything else about them; names can be playful
  without a race for handles.
- The parent gate now guards `/api/account` and `/api/profiles/*`; `/api/household/*` and invite codes are gone, as
  are the `room_household_only` and `not_in_household` codes (now `room_account_only`, `not_in_account`).
- Games display names they cannot predict: long, emoji, any script. They should truncate in one place (the game kit).
- Name checks run on the API only; the hub mirrors the counting and the Damm digit for instant feedback, and must
  keep sending NFC.

## Alternatives considered

- **Keep households, add personal accounts beside them:** two overlapping models for every module to respect, for
  the minority who play as a family.
- **A unique `@handle` per profile:** a race for names, rename rules, impersonation by near-duplicates — against the
  owner's wish for fun names. The numeric ID does the job without asking anyone to be original.
- **Sequential or shorter IDs:** sequential numbers reveal how many players there are and invite walking through
  them; fewer digits make collisions and guessing likelier. Twelve digits are still easy to read out in three groups.
- **Luhn instead of Damm:** Luhn misses some swaps of neighbouring digits (09 ↔ 90); Damm catches them all and needs
  no weights.
- **Turn ICU on to normalize names on the API:** a larger image and culture-dependent behaviour across the API for one
  feature; the hub already has full Unicode support.
