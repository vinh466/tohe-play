---
title: "0044: Every way into Tò He is an entry; share links are objects on the server; one pipeline in the hub gets the player there"
description: A link, a QR code or a code typed by hand is an entry intent; the hub resolves it, keeps it through sign-in and the terms, readies the player's identity and profile, and opens the table's lobby or the game at the right place. Share links are server objects with a typeable code, an expiry, limits and counts; link previews are rendered by the API for crawlers only, and a table's preview never names anyone.
sidebar:
  order: 44
---

- **Status:** Accepted — an `entry` share link is made on a game's request and given to the game in `init`, by
  [ADR 0045](0045-games-declare-identity-and-entries.md) (step I4)
- **Date:** 2026-10-20
- **Amends:** [ADR 0016](0016-online-rooms-for-turn-based-games.md) — a room's link goes through the entry pipeline, has a
  preview, and a closed table's code is not given out again for a day; [ADR 0043](0043-device-profiles-and-identity-levels.md)
  — the identity gate is one step of the pipeline, and making a link is a `named` feature
- **Decided by:** the owner, 2026-10-19 (plans/product-surface D-08: "ổn nha, theo đề xuất"). The agent added what an
  implementer needs, marked *(agent)* below where the owner should look — chiefly that **a table's preview names no one**,
  which is stricter than D-08's example. The Game Contract's part (a game receiving an entry, asking for a share) is decided
  by its own ADR with step I4; the first game to take a share entry is Ghép Khối ("Thách bạn").

## Context

Each way in works its own way today: `/r/<code>` opens a table's lobby, `/account/register?invite=` joins a community,
`/play/<gameId>` opens a game without knowing who invited whom, and inviting by ID happens inside the app. A game cannot
be opened at a place inside it, and cannot make a link (games make no network requests). The owner (2026-10-19): a link
must take people to the right lobby or the right game; the hub must make sure the player's identity and profile are ready
first, and games must care about the player arriving where the game wants.

On iPhone a link always opens Safari, never the installed app, whose storage is apart; so whoever installed the app needs
a way to type a code. Looking a table up by its code needs a session today and is limited per profile, because guessing
one of the 10^6 codes is the only way into a private table.

## Decision

### Every way in is an entry intent

| Kind | Address | Made by | Leads to | Least level (ADR 0043) |
| --- | --- | --- | --- | --- |
| `site` | `/`, `/games/<gameId>/` | public | the public pages | — |
| `play` | `/play/<gameId>` | anyone | the game's menu | the game's |
| `room` | `/r/<six digits>` (exists) | a player at a table | that table's lobby | the highest of the game's and the table's door — `named` by default |
| `share` | `/s/<eight characters>` (new) | a player, through the hub (and a game, from step I4) | the game's menu; from I4, a place inside the game | the highest of the game's and the link's |
| `community` | `/account/register?invite=` (exists, unchanged; not in the pipeline yet) | an operator | signing up into a community | `account` |
| `profile` | in the app, by 12-digit ID (ADR 0033) | an account | an invitation on the catalog | `account` |

**Codes**: a table's six digits, a share link's eight Crockford base32 characters. Typed codes are read case-insensitively,
ignoring spaces and hyphens, with I and L read as 1 and O as 0; six digits are a table, eight characters a share link. The
app has a **"Nhập mã"** box that takes either.

### Share links are objects on the server

- **Kinds**: `game` (opens the game's menu — the only kind the hub makes in step I3) and `entry` (carries a payload for the
  game — from step I4).
- **Fields**: the code, the kind, the game and its version when made, a **payload** of at most 2 KB of UTF-8 JSON (`entry`
  only) that the game alone interprets and must treat as untrusted — never shown in a preview nor written to a log, the
  **level** it asks for (`any`, `named` or `account`), an **expiry** (30 days by default; the maker may set between one hour
  and 90 days), an optional **maximum number of uses** (a use is a resolve that opens the game — not a crawler's fetch),
  and **revoked**.
- **Its maker** is a profile — of a device or of an account. Making a link is a **`named`** feature (others see the
  maker's name): a device profile goes to the server first, with the terms line (ADR 0043); an account's child profile
  makes links only while its "play with others" switch is on.
- **Limits**: 30 links a day per profile; *(agent)* 60 a day per device key, and resolving limited per IP at the API.
- **Counts**, per link and per day: opened, played (a resolve that opened the game), accounts made (the hub passes the
  code once when an account is made from that entry; nothing is stored on the account or the profile). Server-side
  totals, as plans/product-surface D-04 decided. **The maker** sees opened and played for their links; *(agent)* "accounts
  made" only once it reaches three, so a link sent to one friend never tells the maker that this friend signed up. The
  console sees all counts.

### One pipeline in the hub

1. **Resolve**: the address or the typed code becomes a **typed intent** — a kind and a code, never a free path (no open
   redirect).
2. **Still good?** What a dead link tells:
   - **unknown** (never existed, or a table that closed): a generic "Mã này không mở được nữa", with the catalog and the
     "Nhập mã" box;
   - **expired, revoked or used up** share link: the reason and the game, with a way out — the game's menu.

   A closed table's code is not given out again for a day *(agent)*, so an old table link does not open a stranger's table.
3. **Keep the intent** — on the device, for an hour, per tab — through signing in, a provider's round trip, an email code,
   the terms; cleared when it is reached, or when another profile is chosen on a shared device. Installing the app on
   iPhone does not carry it (separate storage): the "Nhập mã" box does.
4. **In an in-app browser** (Zalo, Messenger): suggest opening in the browser, without blocking.
5. **The identity gate** (ADR 0043): the level is the highest of the game's, the feature's and the link's.
6. **The profile is ready**: chosen, a child's switches respected, the terms accepted; the game is checked against the
   profile's age (a device profile has none, ADR 0043).
7. **Open**: the table's lobby (the hub draws it), or the game's menu; from step I4, the place inside the game.
8. **Afterwards**: the counts, and the nudges at their moment (installing, keeping progress).

### Link previews

- **Only crawlers get a rendered preview.** The hub's Caddy sends requests to `/r/<code>` and `/s/<code>` whose
  `User-Agent` is a known link-preview crawler (Zalo, Facebook, Messenger, Twitter/X, Telegram, Slack, Discord,
  WhatsApp, LinkedIn) to an API endpoint that answers a small HTML page: `og:` and `twitter:` tags and a link to the app.
  The API **renders and escapes** every value itself; Caddy never puts API output into a template. People always get the
  app's page, unchanged. A spoofed `User-Agent` only gets the same preview.
- The preview endpoint answers **200 every time**: an unknown, expired or revoked link gets the hub's generic preview. It
  has its own limit per IP (from the address the proxy chain trusts) and a global one.
- **A table's preview names no one** *(agent — stricter than D-08's "Lan mời bạn vào bàn Tiến Lên")*: it shows the game
  only when the table is listed publicly; otherwise it is the generic "Lời mời vào bàn chơi Tò He". So a preview never
  confirms that a private table's code exists, nor whose it is.
- **A share link's preview** shows the game and the maker's current name — the server's, so a name a moderator changed is
  the one shown. A child profile's name and avatar are shown only if its account's owner allows it in the child profile's
  settings (off by default), as D-08 decided.
- A preview that Zalo or Facebook already cached cannot be called back; deleting or revoking stops new previews only.

### Links and the profile's life

| Event | Its links |
| --- | --- |
| The maker is deleted, or cleaned up after 90 days (ADR 0034, ADR 0043) | revoked and deleted with their counts |
| Merged into another profile | move to the target (through the alias) |
| Moved to another device (transfer code) | stay with the profile (same id) |
| Its account is suspended or waiting to be deleted | stop resolving (as revoked) and show no name |

### Not done

- **Links without state** (a signed payload in the address): no revoking, no limits, no counts, long addresses.
- Counting who opened what: counts are totals.
- Games making links on their own, or reading the address: from step I4, through the hub only.
- `community` invite links in the pipeline: they keep their own path for now.

## Consequences

- The API gains a `Links` module (making, resolving, revoking, limiting and counting share links; the preview endpoint for
  room and share links; `IProfileData` for deletion and merging). A migration adds its tables. The rooms registry keeps a
  closed table's code reserved for a day.
- The hub gains the entry pipeline (one place for every way in, replacing the room link's own handling), the "Nhập mã" box,
  a "Chia sẻ" button that makes a `game` link with a QR code, a "Link của tôi" place to see counts, change the expiry and
  revoke, and the dead ends with their ways out. `/s` is a namespace in `@tohe/routes` (and so an app page of the service
  worker); the crawler routing is in the hub's Caddy.
- The console can find and revoke a share link (a namespace of the console's host first).
- The privacy notice and the terms cover share links — the maker, the payload, the counts — before step I3 ships (the
  owner, with E-05); ADR 0043's "Stored on the server" list gains them.
- `docs/architecture/` gains an entry-links page; identity.md, rooms.md and hosts-and-paths.md point to it.
- Tests: a preview with a hostile name renders escaped; a private table's preview is generic; an unknown and an expired
  link answer as above; limits hold. E2E: a share link opened on a new device keeps its intent through the named screen or
  the sign-in and lands in the game; the "Nhập mã" box takes both kinds of code; a crawler gets the preview and a person
  the app.

## Alternatives considered

- **Keep each way in as its own path, adding as needed.** Each new game would invent its own; the identity flows drift
  apart; nothing can be counted. Lost: the owner wants one rule for every way in.
- **Stateless links signed with a key.** No server object to manage, but no revoking, no limits, no counts and long
  addresses; a `play` link needs no token anyway.
- **Previews filled into the app's page by Caddy from the API.** One page for crawlers and people; but API output inside a
  template invites template injection, and an API error breaks the app's page. Lost to crawler-only rendering by the API.
- **A table's preview with the host's name and the game** (D-08's example). Friendlier; but it answers anyone, signed in or
  not, across only 10^6 codes, turning previews into a way to find private tables and their hosts.
