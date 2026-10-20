---
title: "0044: Every way into Tò He is an entry; share links are objects on the server; one pipeline in the hub gets the player there"
description: A link, a QR code or a code typed by hand is an entry intent; the hub resolves it, keeps it through sign-in and the terms, readies the player's identity and profile, and opens the table's lobby or the game at the right place. Share links are server objects with a typeable code, an expiry, limits and counts, and both room and share links carry their own link preview.
sidebar:
  order: 44
---

- **Status:** Accepted
- **Date:** 2026-10-20
- **Amends:** [ADR 0016](0016-online-rooms-for-turn-based-games.md) — a room's link goes through the entry pipeline and
  carries its own preview; [ADR 0043](0043-device-profiles-and-identity-levels.md) — the identity gate is one step of
  the pipeline
- **Decided by:** the owner, 2026-10-19 (plans/product-surface D-08: "ổn nha, theo đề xuất"); the Game Contract's part
  (a game receiving an entry, asking for a share) is decided by its own ADR (step I4)

## Context

Each way in works its own way today: `/r/<code>` opens a table's lobby, `/register?invite=` joins a community,
`/play/<gameId>` opens a game without knowing who invited whom, and inviting by ID happens inside the app. A game cannot
be opened at a place inside it, and cannot make a link (games make no network requests). The owner (2026-10-19): a link
must take people to the right lobby or the right game; the hub must make sure the player's identity and profile are
ready first, and games must care about the player arriving where the game wants.

On iPhone a link always opens Safari, never the installed app, whose storage is apart; so whoever installed the app
needs a way to type a code.

## Decision

### Every way in is an entry intent

| Kind | Address | Made by | Leads to | Least level (ADR 0043) |
| --- | --- | --- | --- | --- |
| `site` | `/`, `/games/<gameId>/` | public | the public pages | — |
| `game` | `/play/<gameId>` | anyone | the game's menu | the game's own |
| `room` | `/r/<six digits>` (exists) | a player at a table | that table's lobby | max(the game's rooms level, the table's door) — `named` by default |
| `share` | `/s/<eight characters>` (new) | a player, through the hub (and a game, from step I4) | a game, at a place inside it when the game supports it | the game's own, or what the link asks |
| `community` | `/account/register?invite=` (exists) | an operator | signing up into a community | `account` |
| `profile` | in the app, by 12-digit ID (ADR 0033) | an account | an invitation on the catalog | `account` |

Every link that names something has a **code people can type**: the table's six digits, a share link's eight characters.
The app has a **"Nhập mã"** box that takes either.

### Share links are objects on the server

- A **code** of eight Crockford base32 characters (no I, L, O, U), the **kind** (`game` or `share`), the **game** and its
  **version** when made, an optional **payload** of at most 2 KB that the game alone interprets and must treat as untrusted,
  the **level** it asks for (`any`, `named` or `account`), an **expiry** (30 days by default, the maker may change it), an
  optional **maximum number of uses**, and **revoked** when its maker or an operator withdraws it.
- Its **maker** is a profile — of a device or of an account. A profile makes at most **30 links a day**.
- **Counts**, per link and per day: opened, played, accounts made. Totals only, tied to nobody (ADR 0015's promise and
  plans/product-surface D-04).
- **Resolving** a code is limited per IP; an unknown, expired or revoked code answers the same way.

### One pipeline in the hub

1. **Resolve**: the address or the typed code becomes an intent; a room code or share code asks the API.
2. **Still good?** An expired link, a closed table or a game hidden for this player's age leads to a dead end **with a way
   out** ("Bàn đã đóng — chơi với bot?", the game's menu).
3. **Keep the intent** — in the address and on the device — through signing in, a provider's round trip, an email code,
   the terms, and installing the app.
4. **In an in-app browser** (Zalo, Messenger): suggest opening in the browser, without blocking.
5. **The identity gate** (ADR 0043): the level is the highest of the game's, the feature's and the link's.
6. **The profile is ready**: chosen, a child's switches respected, the terms accepted.
7. **Open**: the table's lobby (the hub draws it), or the game — with the entry handed over from step I4; until then the
   game opens at its menu.
8. **Afterwards**: the counts, and the nudges at their moment (installing, keeping progress).

### Link previews

`/r/<code>` and `/s/<code>` are the hub's page with **their own** `og:` and `twitter:` tags: who invites, to which game,
with the game's image ("Lan mời bạn vào bàn Tiến Lên"). The hub's Caddy fills them in at request time from the API; the
app then runs as on any of its pages. A child profile's name and avatar are never shown in a preview. A preview of an
unknown, expired or revoked link is the hub's generic one.

### Not done

- **Links without state** (a signed payload in the address): no revoking, no limits, no counts, long addresses.
- Counting who opened what: counts are totals.
- Games making links on their own, or reading the address: from step I4, through the hub only.

## Consequences

- The API gains a `Links` module: making, resolving, revoking, limiting and counting share links, and the preview data
  for room and share links. A migration adds its tables.
- The hub gains the entry pipeline (one place for every way in, replacing the room link's own handling), the "Nhập mã"
  box, a "Chia sẻ" button that makes a `game` link with a QR code, and the dead ends with their ways out.
- The hub's Caddy serves `/s/` as an app page with its preview (a namespace in `@tohe/routes`), and fills in the previews
  of `/r/` and `/s/`.
- The console can find and revoke a share link.
- `docs/architecture/` gains an entry-links page; identity.md, rooms.md and hosts-and-paths.md point to it.
- E2E: a share link opened on a new device keeps its intent through the named screen or the sign-in and lands in the game;
  a dead link offers a way out; the "Nhập mã" box takes both kinds of code; previews carry the link's own tags.

## Alternatives considered

- **Keep each way in as its own path, adding as needed.** Each new game would invent its own; the identity flows drift
  apart; nothing can be counted. Lost: the owner wants one rule for every way in.
- **Stateless links signed with a key.** No server object to manage, but no revoking, no limits, no counts and long
  addresses; a `game` link needs no token anyway.
