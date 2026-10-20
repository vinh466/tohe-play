---
title: "0016: Online rooms for turn-based games, refereed by the API with the game's own rules"
description: Players on different phones share a table through rooms owned by the hub and the API (SignalR); the API runs each game's rules module from its immutable build in Jint, and the same module plays offline on the phone.
sidebar:
  order: 16
---

- **Status:** Accepted — the seed's secrecy amended by [ADR 0017](0017-replays-of-finished-online-hands.md) (replays of finished hands);
  tables for the household are tables for the host's account since [ADR 0023](0023-accounts-own-their-profiles.md);
  the board of the week is the calendar week, and a hand counts on public boards only with two people at the table,
  since [ADR 0029](0029-integrity-engine-and-boards-by-trust.md); invitations reach beyond the host's account by ID
  since [ADR 0033](0033-invite-a-profile-by-its-id.md);
  a room admits `named` device profiles, and a seat and a player may carry no account, since
  [ADR 0043](0043-device-profiles-and-identity-levels.md) (its step I2a: a table's entry — anyone named, the default;
  accounts only; the host's account — the children rule both ways, results marked)
- **Date:** 2026-10-16

## Context

The owner wants to play Tiến lên miền Nam with other people on the platform, each on their own phone: public and
private rooms, a code or a share link, room options, bots for empty seats. The flow should be the reference for
later turn-based games. Research: [Online rooms](../research/online-rooms.md); design:
[Online rooms (proposal)](../architecture/rooms.md); the game: [Tiến lên](../research/tien-len.md).

Constraints:

- [Vision](../vision.md) lists real-time multiplayer and chat as non-goals, and expects a few dozen players.
- Games run sandboxed on their own origin and cannot open connections or call the API
  ([ADR 0002](0002-games-in-sandboxed-iframe-on-own-origin.md)).
- One .NET 10 API and PostgreSQL; no Redis, queues or extra services without a reason
  ([ADR 0003](0003-backend-dotnet-modular-monolith-postgres.md), [ADR 0008](0008-technology-baseline.md)).
- Game logic is pure, seeded and tested by a random-play bot ([ADR 0012](0012-phaser-and-the-game-kit.md));
  builds are immutable ([ADR 0007](0007-immutable-game-builds-and-catalog.md)); everything answers "what happens
  offline?" ([ADR 0005](0005-offline-first.md)).
- A card game hides each hand from the others, and phones suspend background pages and their sockets.
- Players include children.

## Decision

- **Turn-based online play becomes a platform feature: rooms.** The hub owns the lobby (public list, private rooms,
  6-digit codes, `/r/<code>` links, QR, sharing) and the waiting room; the API owns rooms, seats, bots, timers and
  reconnection. Real-time action multiplayer stays out of scope.
- **Transport: ASP.NET Core SignalR in the API**, in a new `Rooms` module with its own `rooms` schema. The hub is the
  only client; the game talks to the hub over `postMessage`.
- **The API referees.** It deals, validates every action, and sends each seat only that seat's view. The state and
  the seed never leave the server.
- **One rules module per game.** A multiplayer game ships a pure, deterministic `rules.js` (built from TypeScript in
  its folder) in its immutable build. The API runs the version the room was created with in **Jint** (untrusted-code
  limits, `Math.random` and `Date` replaced); the game imports the same module for hints and to play offline against
  bots.
- **Contract, additively:** a `rooms` capability, a `rooms` block in `game.json` (rules file, seats, bot levels,
  game options the hub renders), `init.room`, and `room.view` / `room.event` / `room.action` / `room.react`
  messages. The protocol stays at 1. The contract change, its docs and conformance (including determinism and limits
  of the rules module) land in the same pull request.
- **State:** live in memory, one actor per room; accepted actions appended to PostgreSQL with a snapshot per hand,
  so rooms survive an API restart. One API instance.
- **For a family:** no typed chat (preset reactions), no money or chips, names and avatars only, and playing with
  other households behind a parent switch on child profiles.
- **First game:** Tiến lên, offline against bots first (no platform change), then online.

Not done: matchmaking by skill, real-time games, typed chat, voice, public internet access (that is a production
ADR), several API instances.

## Consequences

- Later turn-based games get rooms for free: an agent writes a rules module and a view in `games/<id>`.
- The phone's rules and the server's rules cannot disagree: both come from the same immutable build.
- New code to keep: the `Rooms` module (actors, Jint engines, timers, bots, recovery), lobby and waiting-room pages
  and a `next` return path through sign-in in the hub, SDK and contract additions, conformance for rules modules,
  e2e tests for reconnection.
- Jint becomes a dependency of the API (this ADR is the one ADR 0008 asks for). It costs about 0.3 ms per action,
  which is nothing next to the network, but compute-heavy bots run 25–45× slower than in V8: bots stay heuristic
  with a fixed budget, and a much stronger bot would need native V8 or C# for that part.
- Game code now runs inside the API process. It is code from this repository, reviewed in pull requests, under
  timeouts and memory limits; players can never upload it.
- Online play needs the API; without it, games fall back to bots on the phone.
- Spikes S5 (reconnection on iPhone, CSP for the same-origin WebSocket) and S6 (building and loading a rules
  module) run before implementation.
- The vision's non-goal "Real-time multiplayer" became "real-time action multiplayer". The owner accepted every
  proposed answer to the design's open questions on 2026-10-16 ("theo đề xuất của ta hãy triển khai đi"); they are
  recorded in [Online rooms](../architecture/rooms.md#decisions-on-the-proposals-open-questions) and
  [Tiến lên](../research/tien-len.md#decisions-on-the-proposals-open-questions).

## Alternatives considered

- **Rules written in C# in the API, with a TypeScript copy in the game:** native speed and one language on the
  server, but two copies of every game's rules that drift, and every multiplayer game touches the API and its
  deploys.
- **A Node.js room server such as Colyseus 0.17:** the most complete rooms framework and TypeScript end to end, but a
  second backend runtime and service, sign-in bridged from the .NET cookie, and the hub would still have to relay for
  the sandboxed game.
- **Nakama:** a complete game server, but it brings its own accounts, leaderboards and database next to the ones we
  own.
- **Server-sent events and POST instead of SignalR:** plain HTTP, but presence, heartbeat and resume would be ours to
  build.
- **Hosted services (PartyKit, Durable Objects, Photon):** children's play would leave the home.
- **One phone hosts the game for the others:** that phone would hold every hand, and the table would stop when it
  sleeps.
