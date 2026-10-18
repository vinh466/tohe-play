---
title: "0033: Invite a profile to a table by its ID, as its owner allows; a child is never found from outside"
description: A player at a table finds a profile by its 12-digit ID, confirms its card and asks it; each profile says who may — anyone, people it played with, or only its account — a child only its account, and its ID is not found from outside; lookups, invitations and waiting invitations are limited.
sidebar:
  order: 33
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0023](0023-accounts-own-their-profiles.md) — inviting a profile by its ID, which it left for
  later; a profile says who may invite it. [ADR 0016](0016-online-rooms-for-turn-based-games.md) — invitations reach
  beyond the host's account

## Context

Every profile has a public ID, an address for strangers rather than a secret (ADR 0023), and invitations to a table
reach only the other profiles of the same account. D-17 decided how the ID is used to invite (the owner accepted it on
2026-10-17): "Mời bằng ID" in the waiting room; a setting on each profile, **ai được mời tôi** — anyone, people it
played with, or only its account (Q4: those three are enough); a child's profile is account-only, and **a child's ID
looked up from outside its account is "not found"**, so nothing says a child is there; at most about 20 invitations
sent an hour, and 10 waiting for one person.

## Decision

- **Find, confirm, ask.** In the waiting room, **Mời người chơi** offers the account's profiles, as before, and a
  profile ID: 12 digits, checked on the phone with the Damm digit, then looked up — `GET /api/profiles/by-id/{publicId}`
  answers the profile's card: name, avatar and ID. Names are free and not unique, so the inviter asks only by tapping
  that card ("Mời Mèo Vui"), never by a name (D-17). The invitation is the one rooms already have —
  `POST /api/rooms/{id}/invite` with the profile's id — now beyond the account too: shown on that profile's catalog for
  10 minutes, it opens a locked table but never the parent switch or a full one.
- **Who may ask a profile** (`invites`): `anyone` · `played-with` — someone it sat at a finished hand with · `account`.
  A child is always `account`, and its ID is not found from outside its account; nor is a profile of a suspended
  account — by its ID, or by its id asked straight. An adult whose setting turns the asker away says so
  (`invites_closed`): the ID is an address, and the asker can tell a typo from a closed door. A table kept to the
  account takes nobody else either.
- **Adults default to `anyone`.** D-17 sets only the children's template; asking someone you have not played with yet
  is what the ID is for. Each owner changes it per profile in Quản lý tài khoản.
- **Limits.** An account looks up 20 IDs an hour (`Identity:ProfileLookupsPerHour`), and every lookup counts — found
  or not — so IDs cannot be walked through. It asks 20 profiles of other accounts an hour (`Rooms:InvitationsPerHour`),
  asking again included, and at most 10 invitations from other accounts wait for one profile
  (`Rooms:InvitationsWaitingPerProfile`). All three live in the API's memory, as invitations do: one process serves
  everyone (ADR 0016), and a restart forgets an hour at most.

## Consequences

- Strangers can play together by sharing an ID, while a child stays out of reach of anyone outside its account.
- An adult who wants fewer invitations narrows its setting; the rest of the profile — boards, name, ID — is unchanged.
- "Played with" counts finished hands only, profile by profile: a table someone left before a hand ended does not.
- Invitations are not kept in the database: after a restart, people ask again.

## Alternatives considered

- **"Not found" for every refusal:** hides an adult's setting, which is no secret, and leaves the asker guessing at a
  typo; children are the ones who need not to be found.
- **Asking straight by ID, the card shown afterwards:** one request less, but a valid ID someone gave wrongly would
  reach a stranger before anyone sees whose it is — the confirmation D-17 asks for.
- **`played-with` as the adults' default:** fewer unwanted invitations, but a first game with someone new would need a
  room code instead, and the ID would invite almost nobody.
- **Invitations in the database:** they survive a restart, but last 10 minutes; the cost buys little.
