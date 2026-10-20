---
title: "0045: A game declares the identity it needs and the entries it takes; it asks the hub for more, and to share"
description: The Game Contract gains, in protocol 1, a game's identity level and entry kinds in game.json, the profile's kind, an entry and what the game may ask for in init, and three messages — the game's answer to an entry, a request for a higher identity level, and a request to share — so a game opens at the place a link names, and never signs anyone in or makes a link itself.
sidebar:
  order: 45
---

- **Status:** Accepted
- **Date:** 2026-10-20
- **Amends:** [ADR 0043](0043-device-profiles-and-identity-levels.md) — the game's source of the level is `identity` in
  its manifest; [ADR 0044](0044-entry-links.md) — an `entry` share link is made by the hub on a game's request and given
  to the game in `init`; [ADR 0019](0019-game-shell-2-title-screen-hud-and-first-screen.md) — a game opened by an entry
  it handles opens play, its title screen behind it; [ADR 0030](0030-ranked-runs-replayed-by-the-server.md) — a game
  played from an entry is not a ranked run
- **Decided by:** the owner, 2026-10-19 (plans/product-surface D-06 §5 and D-08 §6: "ổn nha, theo đề xuất"; D-08 Q3:
  Ghép Khối's "Thách bạn" first). The agent added what an implementer needs, marked *(agent)* below where the owner
  should look — chiefly: **the hub's name and sign-in sheets never show a game's words**, and a share message is
  checked; **a link is made only when the player sends or copies it**; **becoming an account opens the game again**.
  The owner confirmed them on 2026-10-20 ("chốt").

## Context

ADR 0043 lets three sources ask for an identity level — the game, the platform's feature, the table — and left the
game's field to this ADR; until now every game asks for `any`. ADR 0044 made every way in an entry and share links
objects on the server, and left to this ADR how a game receives an entry and asks for a link. A game makes no network
requests and never calls the API (Game Contract v1, runtime rules), so whatever it needs from the platform it asks
the hub for, through the protocol.

What a game should be able to do: say what opening it needs (a solo game: nothing; an economy kept across devices: an
account); open at the place a link names ("beat my 12,340 on this board"); ask in the middle of play for more (a name,
before others see it; an account, before a public board); and ask the hub to share something only it can open again.
Four games exist; none should have to change until it wants one of these.

The hub learns about games from the API (the registry, filled from each build's `game.json`), and makes links through
the API, which anyone can call directly: what matters for safety is enforced there.

## Decision

All of it is **additive in protocol 1**, like `shell` (ADR 0018) and `ranked` (ADR 0030). "Entry" is ADR 0044's word
for a way in; it is not the manifest's `entry`, the game's HTML file.

### The manifest

```json
"identity": { "play": "any", "rooms": "named" },
"entries": ["share"]
```

| Field | Values | Means |
| --- | --- | --- |
| `identity.play` | `any` (default) · `named` · `account` | what opening the game asks for (ADR 0043's levels) — at a table too |
| `identity.rooms` | `named` (default) · `account` | the least a table of this game asks for; only with `rooms`. A table asks for the highest of `play`, `rooms` and its creator's door (ADR 0043) |
| `entries` | `["share"]` (the only kind today) | the kinds of entry the game opens itself. A game without it is opened at its menu, as today. With it, the build ships `entries/share.json`: one to five payloads its share makes, for conformance *(agent)* |

### `init`

| Field | Means |
| --- | --- |
| `profile.kind` | on `init.profile` only (not on a table's seats): `device` or `account` (ADR 0043; a child profile is `account`) — so a game can, say, offer its leaderboard only to an account. Absent from older hubs |
| `entry` | `{ kind: "share", payload, version, from? }`: the payload of the share link it was opened by (JSON, at most 2 KB as UTF-8), the game's version when the link was made, and its maker's name and avatar when they may be shown (ADR 0044's rule for a child profile). Sent only to a build that declares the kind; never together with `room`, `replay` or `rankedReplay` |
| `can` *(agent)* | `{ require: boolean, share: boolean }`: whether the hub answers `identity.require` and `share` in this session. Both are false at a table, in a replay and in a ranked replay; `share` also for a child profile whose "play with others" switch is off, and for a game without `entries`. Absent from older hubs |

### Messages from the game

| Message | Answered by | Means |
| --- | --- | --- |
| `entry { result }` | — | the game's answer to `init.entry`, once, within **3 s** of `init`: `handled` (it opened at the place), `unsupported` (not a kind or a version it opens) or `invalid` (the payload is not one it accepts) |
| `identity.require { id, level, reason }` | `result` | `level` is `named` or `account`; `reason` is one of `others` (others will see the name), `ranked` (a public board), `sync` (progress on every device) or `friends` (playing with friends by ID) *(agent)*. For `named`: `ok` with `value` the profile as it is now (the same id, its name). For `account`: `ok` at once when the profile is one already; otherwise, once the player has signed in, the game is **opened again** and the request never settles *(agent)*. Not `ok`: `declined`, `busy` or `unavailable` |
| `share { id, payload, text?, level? }` | `result` | the hub shows its share sheet for an `entry` share link of this game (ADR 0044). `payload` at most 2 KB; `text` the message the player sends with the link; `level` what opening the link asks for — raised to the game's `identity.play`. `ok` once the player sent or copied the link; not `ok`: `cancelled`, `busy`, `limit`, `offline`, `not_allowed` or `unavailable` |

### What the hub does

- **Opening a game** asks for the highest of the game's `identity.play`, the feature's and the link's level (ADR 0043,
  ADR 0044 step 5).
- **An entry**: the hub sends `init.entry` only to a build that declares its kind. It waits 5 s for the answer. On
  `unsupported`, `invalid`, no answer, or a build that does not declare the kind, it shows its own notice over the
  game's menu ("Lời mời này không mở được trong bản game này").
- **One sheet at a time** *(agent)*: while a sheet is open, or before the game showed its first screen, a request is
  answered `busy`. The hub sends `pause` when a sheet opens and `resume` when it closes.
- **`identity.require`**: the hub shows its own sheet — the name screen for `named`, the sign-in sheet for `account`
  (ADR 0043) — with **its own words for the reason, never the game's** *(agent)*, so a game cannot make the hub's
  sign-in say anything. After the player declines, every request of that game for that profile is answered `declined`
  without asking for 10 minutes *(agent)*. A game asking for a level the profile already has gets `ok` at once.
- **Becoming an account opens the game again** *(agent)*, for the profile the player ends up on — the same id when the
  device profile was brought into the account, another when it was merged (ADR 0043) — because what the hub gives a
  game (synced saves, ranked runs, the shell's leaderboard) is decided when it opens. Signing in with a provider leaves
  the page anyway. Before leaving or closing the game, the hub sends `pause` and waits up to 1 s. It keeps the game to
  open again — with its entry's payload, if it was opened by one; the link is not resolved again, so no second use is
  counted.
- **`share`**: the hub asks for `named` first (making a link is a `named` feature, ADR 0044), then shows its sheet:
  the game's text as the message, and "Gửi" (the system's share), "Chép link" and "Mã QR". **The link is made only
  when the player taps one of them** *(agent)* — with the game's id, the payload and the level — so a game cannot spend
  the player's links of the day, and cancelling leaves nothing behind. **The text** is checked *(agent)*: one line, at
  most 120 characters, no address, domain or email, no run of seven digits or more, through the name filter (ADR 0035);
  otherwise the hub uses its own words ("Chơi {game} với mình nhé!"). It goes only into the message the player sends:
  never stored on the server nor shown in a preview, as the payload never is.
- **The API enforces** what matters when it is called directly: it keeps each build's `identity` and `entries` in the
  registry; makes an `entry` link only for a game whose current build declares `entries: ["share"]`; raises the link's
  level to the game's `identity.play`; takes the game's version from the registry, never from the request; and admits
  a table's players by the highest of `play`, `rooms` and the table's door.

### What a game must do

- **Treat the payload as untrusted**: anyone can make a share link for any game that takes them, through the API.
  Check everything; answer `invalid` for anything else. Put a version of its own in the payload.
- **Never lose the game in progress**: an entry opens beside it (a slot of its own in the save) or asks first.
- **Save before asking for `account`**: the game is opened again.
- **A game played from an entry is not a ranked run**: its seed is not the server's (ADR 0030 — and the server would
  replay a ranked run from its own seed, so nothing needs refusing). A regular game started later in the same session
  may be ranked. A score from an entry's game is a normal score.
- Opened by an entry it handles, a `shell` game skips its title screen and opens play, its title screen behind it,
  reached from the main menu as usual (ADR 0019).

### SDK and kit

- **SDK**: `session.profile.kind`; `session.entry` (`kind`, `payload`, `version`, `from`, and `answer(result)`);
  `session.identity.require(level, reason)` and `session.identity.canRequire`; `session.share({ payload, text, level })`
  and `session.canShare`. `identity.require` and `share` have **no timeout** — a sign-in or a share sheet takes as long
  as the player does; with `can` absent they reject with `unavailable` at once. The SDK updates `session.profile` before
  a `named` request resolves. Sizes are checked before sending.
- **Kit**: `createShell` takes the game's entry handler and answers for the game: `handled` opens play with the title
  screen behind it (a new way to open); anything else opens the title screen. A game without a handler answers
  `unsupported` — so the four games need no change until they take entries (every game uses the kit, ADR 0012). The
  end-of-game card takes more than one extra action.

### Conformance

- **Every game**: opened with an `init.entry` of kind `share`, it shows its title screen and logs no error (the kit
  answers `unsupported` for a game without a handler).
- **With `entries`**: `entries/share.json` holds one to five payloads, each at most 2 KB; opened with each, the game
  answers `handled` within 3 s and opens play (no title screen over it). Opened with hostile payloads (`null`, a
  string, wrong types, deep nesting, close to 2 KB), it answers `invalid` or `unsupported` within 3 s, shows its title
  screen and logs no error. Under the random input, the fake hub answers `identity.require` with `declined` and `share`
  with `cancelled`, and the game plays on.
- The game's own tests check that its share makes payloads like those in `entries/share.json` and opens them; the
  `/new-game` skill says so.

### Ghép Khối: "Thách bạn"

- A game remembers the seed it started from (a new field of its state; a game saved before has none, and offers no
  "Thách bạn").
- On the end-of-game card: **"Thách bạn"** shares `{ v: 1, seed, score }` with the text "Mình được {score} điểm Ghép
  Khối. Bạn vượt được không?" and the level `any`, so a newcomer plays at once.
- Opened by it: a challenge game from that seed, in a slot of its own with its own score run, leaving the regular game
  (and its ranked run, if any) untouched; its target in the HUD ("Vượt {score} của {name}", or "Vượt {score}" without
  `from`); at its end, whether it was beaten, **"Thách lại"** (sharing this score on the same seed) and the usual way to
  the title screen. The score in the payload is the maker's claim, shown as such.

### Not done

- **Entries while a game is open**: an entry comes in `init` only; following another link opens the game again.
- **Changing `can`, `shell` or `profile.kind` during a session**: the game is opened again instead.
- **A verified challenge**: the score is the maker's claim. Tying a challenge to a ranked run the server replayed is a
  later decision.
- **Games reading the address or making links themselves**: only through the hub.
- **Other entry kinds** (a notification, a daily challenge): each is a new kind, added the same way.
- **`identity.require("any")`**: every profile is at least `any`.

## Consequences

- `packages/contract`: the manifest's `identity` and `entries` (`identity.rooms` only with `rooms`); `init`'s
  `profile.kind`, `entry` and `can`; the messages `entry`, `identity.require` and `share`; their tests and the
  regenerated JSON schema.
- `packages/game-sdk` (game side and `/host`) and `packages/game-kit` (the entry handler, opening play with the title
  screen behind, an end-of-game card with more actions), a minor version each.
- The API: registry columns for `identity` and `entries` (an additive migration), read by `CatalogSync` and returned
  with each game (the OpenAPI document and `schema.gen.ts` regenerated); `Links` (ADR 0044) enforcing the rules above;
  tables admitting by the game's levels.
- The hub: the game's levels in the gate (from the API's game summary); `init.entry` from ADR 0044's pipeline; the
  `identity.require` and `share` sheets, their reasons and the fallback message in `i18n.ts` for the owner to review;
  the entry notice; opening the game again after becoming an account. The console shows a build's `identity` and
  `entries`.
- Conformance: the checks above; docs/contracts/game-contract-v1.md (the manifest, init, messages, SDK, conformance and
  versioning sections); docs/architecture/identity.md and the entry-links page point here; the `/new-game` skill.
- Ghép Khối: a minor version with "Thách bạn", `entries/share.json` and the tests.
- ADR 0019, 0030, 0043 and 0044 note the amendment in their status lines.
- Lands with step I4, after step I3 (ADR 0044) — the share link it makes is I3's.

## Alternatives considered

- **Entries in the address the game is opened at** (a query or a hash). Games would parse addresses, and a game's
  build would decide what a link means outside the hub's pipeline; lost to one typed `init.entry`.
- **The game's own words on the hub's sheets.** Friendlier copy per game, but the sign-in sheet is the hub's trusted
  screen: a game must not be able to make it say anything. Lost to a short list of reasons the hub words.
- **The game's share text as it is.** It goes out under the player's name next to a real Tò He link, so a game could
  slip in an address; lost to a checked text with the hub's words as the fallback.
- **Making the link when the sheet opens.** Simpler, but a game could spend the player's 30 links a day and leave live
  links behind; lost to making it on the player's tap.
- **An `account` request that settles with `ok`, the session updated in place.** It would need `shell`, `can` and the
  hub's handlers to change during a session; lost to opening the game again, which a provider's sign-in does anyway.
- **A conformance check on shares made under random input.** Four seconds of random taps rarely reach a game's end;
  lost to payloads the build ships for the purpose, as `ranked` ships its bot.
- **Other words than "entry"** (`arrival`, `opening`), to stay apart from the manifest's `entry`. ADR 0044 and the hub
  say "entry"; one word across the platform won, with the manifest's field noted.
- **A new protocol number.** Nothing here can trip a v1 game: older hubs send no entry and answer neither request
  (the game sees `can` absent); games that do not declare `entries` are opened as today.
