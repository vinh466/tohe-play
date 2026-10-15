---
title: Online rooms technology research
description: How Tò He could run turn-based games for several players on their own phones — the transport, where the rules run, and the evidence behind the choice.
sidebar:
  order: 2
---

Question (owner, 2026-10-16): *Tiến lên miền Nam against other people on the platform — a list of public rooms,
private rooms, a room code to type or a link to share, room options including bots for empty seats — built
properly, as the reference flow for later multiplayer games; and which technology suits it for the long run.*
Proposed decision: [ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md). Design:
[Online rooms](../architecture/rooms.md). The game itself: [Tiến lên research](tien-len.md).

## What the platform already fixes

- Games run in a sandboxed iframe on their own origin, under a CSP with `connect-src 'self'`, and never call the
  API ([ADR 0002](../decisions/0002-games-in-sandboxed-iframe-on-own-origin.md)). Whatever connects to a server is
  the hub's, not the game's.
- One ASP.NET Core 10 API with PostgreSQL 18; Redis, message queues and microservices are excluded at this scale
  ([ADR 0003](../decisions/0003-backend-dotnet-modular-monolith-postgres.md),
  [ADR 0008](../decisions/0008-technology-baseline.md)).
- Games are pure logic plus a view; randomness lives in the state, and a random-play bot checks the invariants
  ([ADR 0012](../decisions/0012-phaser-and-the-game-kit.md)).
- Every feature answers "what happens offline?" ([ADR 0005](../decisions/0005-offline-first.md)).
- Game builds are immutable and versioned ([ADR 0007](../decisions/0007-immutable-game-builds-and-catalog.md)).
- [Vision](../vision.md) lists real-time multiplayer and chat as non-goals today, and a few dozen players at most.

## Requirements

| # | Requirement | Why |
| --- | --- | --- |
| R1 | Server-authoritative with hidden hands: the server deals, and each phone receives only what its seat may see | A card game is pointless if one phone holds every hand |
| R2 | Survives phones that sleep, lock, change network or take a call | iOS suspends background pages and their sockets close |
| R3 | Fits the platform: the hub owns the connection, cookie session, one API, PostgreSQL, compose on the homelab | ADR 0002, 0003, 0008 |
| R4 | Rooms are a platform feature: lobby, codes, links, seats, bots, timers and reconnection written once | The owner wants this flow to be the template for later games |
| R5 | One source of truth for a game's rules, tested the ADR 0012 way | Two copies of the rules drift apart |
| R6 | Still playable offline, against bots on the device | ADR 0005; a child in a car |
| R7 | An agent adds a multiplayer game mostly inside `games/<id>` | Vision: games built fast with AI help |
| R8 | Maintainable by the owner for years | The owner works with .NET and PostgreSQL daily |

## Question 1: the transport

| | Kind | Fits | Costs |
| --- | --- | --- | --- |
| **ASP.NET Core SignalR** | Part of ASP.NET Core 10 (LTS) | Runs in the API we have; groups; automatic reconnect; stateful reconnect (since .NET 8) buffers and replays messages across short drops; keep-alive and timeouts built in; JSON or MessagePack; the cookie session works because the hub is same-origin | The JS client (`@microsoft/signalr`, about 14 KB gzip) goes into the hub, not into games |
| Raw WebSockets | Kestrel middleware | No library | Reconnect, framing, keep-alive and groups would be ours to write |
| Server-sent events + POST | `TypedResults.ServerSentEvents` (.NET 10) | Plain HTTP; enough for turn-based traffic | One-way; presence, heartbeat and resume would be ours to write |
| Colyseus 0.17 (Feb 2026) | Node.js room server | The closest thing to rooms out of the box: lobby, `QueueRoom` matchmaking, `StateView` for hidden state (0.16), `onDrop`/`onReconnect` to hold a seat, rate limits | A second backend runtime and service; sign-in must be bridged from the .NET cookie; persistence through the API; its client would still need the hub as a relay, because games cannot open connections |
| Nakama | Complete game server (Go) | Matchmaker, parties, chat, leaderboards, authoritative matches in TypeScript, Go or Lua | Duplicates the identity, households and progress we already own; its own database and operations |
| PartyKit / Durable Objects, Photon | Hosted services | Nothing to run | Children's play leaves the home; vendor lock-in; against the first-party rule we kept for telemetry (ADR 0015) |

**Choice: SignalR inside the API, with the hub as its only client.** The game talks to the hub over `postMessage`,
as it already does for saves and scores. Caddy's `reverse_proxy` already passes WebSocket upgrades through
`/api/*`.

## Question 2: where the rules run

The server must decide what is legal (R1), and the phone must know the rules too: to grey out cards that cannot be
played, and to play offline against bots (R6). So the rules exist in at least two places. The options differ in
how many copies we keep.

| | A. C# rules in the API | **B. One TS rules module, run by the API in Jint** | C. TS rules on a Node sidecar | D. Nakama TS runtime |
| --- | --- | --- | --- | --- |
| R1 server-authoritative | ✅ | ✅ | ✅ | ✅ |
| R3 fits the platform | ✅ | ✅ one NuGet package | ❌ second runtime and service | ❌ second platform |
| R4 rooms written once | ✅ | ✅ | ✅ | ✅ |
| R5 one copy of the rules | ❌ C# + TS copy | ✅ | ✅ | ✅ |
| R6 offline with bots | ⚠️ needs the TS copy and a TS bot | ✅ same module on the phone | ✅ | ✅ |
| R7 agent works in `games/<id>` | ❌ every game also touches the API | ✅ | ⚠️ the sidecar per game | ⚠️ |
| Client and server rules match | ⚠️ kept in step by shared test cases | ✅ by construction: both load the same immutable build | ⚠️ two deploys | ⚠️ |
| Bot speed | ✅ native | ⚠️ interpreter: see the evidence below | ✅ V8 | ⚠️ goja interpreter |

Option B in one sentence: each multiplayer game ships a pure, deterministic `rules.js` built from TypeScript in its
own folder; the phone imports it for hints and offline bots; the API loads the **same file from the same immutable
build** the room was created with and runs it in [Jint](https://github.com/sebastienros/jint), a JavaScript
interpreter written in C#.

It is not a new idea. Nakama runs TypeScript match handlers the same way: in goja, a JavaScript VM embedded in its
Go server, sandboxed, with no Node or browser APIs. boardgame.io runs one game definition on clients and server.

Jint 4.17 (2026): 99.9 % of test262, ES modules, and an untrusted-code profile (timeouts, statement and memory
limits, no CLR access, no module loading or `eval`). Browser and Node APIs are not installed unless the host adds
them. Its README says the limits are cooperative and recommends a separate process for hostile code. Our rules
modules are code from this repository, reviewed in pull requests, never uploaded by players: the limits are there to
contain bugs, not attackers.

## Evidence: a spike on 2026-10-16

A throwaway Tiến lên core in plain JavaScript (combos, southern bombs, legal-move generation, a greedy bot, a
determinised Monte Carlo bot, per-seat views, JSON in and out) run unchanged in Node 24.18 (V8) and in Jint 4.17.0
under .NET 10.0.401, on this workstation (Xeon E5-2696 v3). Release builds, warmed up.

| Measurement | Node (V8) | Jint | Ratio |
| --- | --- | --- | --- |
| One action through JSON: parse, validate, apply, stringify, four seat views | 34 µs | 290–330 µs | ~10× |
| Greedy bot, one decision (legal moves over 13 cards) | 15 µs | 353 µs | ~24× |
| A whole random game (79 moves, every move generated legally) | 0.36 ms | 11.2 ms | ~31× |
| Monte Carlo bot, one decision of 270 greedy playouts | 30 ms | 1.3 s | ~44× |
| First engine in a process (Jint's own JIT warm-up) | — | ~1 s | |
| Each further engine with the rules loaded | — | 1.8 ms | |

Other findings:

- `TimeoutInterval(200 ms)` stopped `while (true) {}` after 205 ms; `require`, `process`, `fetch` and `System` were
  all `undefined`.
- `LimitMemory` counts the bytes allocated **during one call**, not live memory: the long benchmark tripped a 256 MB
  limit while the process held 5 MB. Limits are set per kind of call (an action, a bot decision).

What it means:

- **Actions cost nothing that matters.** 0.3 ms per action against 20–100 ms of network; one core would handle
  thousands of actions a second, and a family table makes a few.
- **Heavy bots are the weak spot.** Compute loops run 25–45× slower than V8. Bots are heuristic by default; a
  "hard" bot gets a playout budget and runs off the request path, behind the human-like thinking delay bots need
  anyway. If a much stronger bot is ever wanted, that bot alone can move to native V8 (ClearScript) or C#.
- **Warm up at start-up**, so the first room after a deploy does not pay the second of JIT.

**Measured again with the real module** (Tiến Lên 0.2's `dist/rules.js`, 17 KB, in Jint 4.17 on the same
workstation, 2026-10-16): an action with a view through JSON 0.16 ms; a Dễ or Vừa bot decision 2 ms (19 ms at most);
a Khó decision (40 playouts of Vừa) 0.5 s median, 1.7 s at most; the first call in a fresh process 0.18 s. The API's
tests keep a Khó decision under 5 s.

## Spikes before implementation

| # | Question | Why it matters |
| --- | --- | --- |
| S5 | SignalR through the hub into the game iframe on iPhone Safari and the installed PWA: screen locked 30 s and 5 min, Wi-Fi to 4G, a phone call. Does the hub reconnect and resync every time? Does the hub's CSP `connect-src 'self'` allow the same-origin `ws://` on iOS? | R2 is the most likely failure in real use |
| S6 | Build a game's `rules.ts` with Vite library mode into one ES module, load it in Jint, and map its stack traces back to TypeScript | The rules module is a new kind of build output |

## Sources

- [Configure ASP.NET Core SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/configuration?view=aspnetcore-10.0):
  stateful reconnect, keep-alive and timeouts.
- [What's new in ASP.NET Core 10](https://learn.microsoft.com/en-us/aspnet/core/release-notes/aspnetcore-10.0):
  server-sent events; SignalR endpoints answer 401/403 instead of redirecting.
- [`@microsoft/signalr` size](https://mcp.depscope.dev/pkg/npm/@microsoft/signalr) (third-party measure of 10.0.0;
  to be confirmed in the hub's own build).
- [Colyseus 0.17 is here](https://colyseus.io/blog/colyseus-017-is-here/) (2026-02-06).
- [Nakama TypeScript runtime](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/): goja VM,
  sandboxed, no Node APIs.
- [Jint](https://github.com/sebastienros/jint): test262 conformance, untrusted-code limits, benchmarks.
- [Apple Developer Forums: WebSocket in Safari after backgrounding](https://developer.apple.com/forums/thread/696310)
  and [WebKit bug 247943](https://bugs.webkit.org/show_bug.cgi?id=247943): sockets close on suspension, and `onclose`
  does not always fire.
