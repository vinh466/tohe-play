---
title: "0017: Replay finished online hands with the game's own rules module"
description: A finished hand's seed and actions go to the people who played it; the game replays it with the rules module of the build that refereed it (init.replay).
sidebar:
  order: 17
---

- **Status:** Accepted
- **Date:** 2026-10-16
- **Amends:** the seed's secrecy in [ADR 0016](0016-online-rooms-for-turn-based-games.md) (it now ends with the hand)

## Context

[ADR 0016](0016-online-rooms-for-turn-based-games.md) keeps the state and the seed on the server. The rooms design the
owner accepted on 2026-10-16 plans hand history and replays for phase 3, and its
[Who sees what](../architecture/rooms.md#who-sees-what) table already lets a seat's hand be seen in the replay once
the hand is over. The server keeps every hand's seed and accepted actions (they rebuild a room after a restart), and
the build that refereed a hand is immutable ([ADR 0007](0007-immutable-game-builds-and-catalog.md)), so that build's
rules module replays the hand exactly.

## Decision

- **A finished hand belongs to the people who played it.** `GET /api/rooms/{id}/hands/{hand}` answers only a profile
  that sat at it, and only once the hand is over: seats (names, avatars, bot levels), seed, options, starting carry,
  actions, result and the build's version. During a hand the seed never leaves the server, as before.
- **The game replays it itself.** The hub opens the game with `init.replay`
  (`seats`, `seat`, `seed`, `options`, `carry`, `actions`) instead of `init.room`; the game sets the hand up with its
  own rules module and plays the actions back, showing the asking seat's view. The SDK exposes it as
  `session.replay`. A game declaring `rooms` must replay; conformance opens it with a hand its own bots played and
  checks that it plays back without errors.
- **Only with the build that played it:** when the catalog has a newer version, the hub says the hand cannot be
  replayed rather than let another rules module tell it differently.
- **Kept with the room:** a hand's record and its seats' results live in the `rooms` schema next to its actions, for
  statistics and the household's board. Spectators never get a replay, and a household's board shows only its own
  profiles.

Not done: replays shared outside the table, exports, showing every seat's cards in the game's replay view.

## Consequences

- Phase 3's history, replays and statistics need no second copy of any game's rules, and a replay can never disagree
  with what the server refereed.
- The contract grows additively (protocol 1): `init.replay`, SDK 0.6.0 `session.replay`, a conformance replay check.
- A player can work out every seat's cards in a hand they played from its seed once it ends; the cards no longer
  matter then, and the replay of a hand is for the people who played it.
- After an update, older hands stay in the statistics but cannot be replayed: the games image holds only the current
  builds. Keeping old builds, the cleanup policy [ADR 0007](0007-immutable-game-builds-and-catalog.md) leaves open,
  would bring them back without any change here.

## Alternatives considered

- **The server sends a recorded view per step:** no seed leaves it, but the server would store or compute a view for
  every action and seat, and the game would need a second "draw a stored view" mode.
- **A video or image recording:** large, not interactive, and the phone would have to record while playing.
- **No replays:** the history would be a list of numbers; the seed and actions are kept anyway.
