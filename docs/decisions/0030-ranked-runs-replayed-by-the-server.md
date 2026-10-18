---
title: "0030: Ranked runs — the server deals the seed, the game hands in its moves, the server replays them"
description: A one-player game that can be replayed declares it; each ranked run starts from a seed the server chose, ends with the moves played, and is verified by replaying them with the game's own verify module in the API.
sidebar:
  order: 30
---

- **Status:** Accepted — a ranked game also plays a run back to watch, since [ADR 0032](0032-watch-a-ranked-run-in-the-game-itself.md)
- **Date:** 2026-10-18
- **Amends:** [Game Contract v1](../contracts/game-contract-v1.md) — a capability, a manifest block and three messages,
  all optional (protocol stays 1); [ADR 0005](0005-offline-first.md) — a ranked run needs the network when it starts;
  [ADR 0014](0014-live-scores-for-long-runs.md) — a long ranked run is verified when it ends

## Context

Public boards take only results the server can trust (ADR 0029). A room hand is trusted because the server referees
it; a one-player game's score is what the device says, and the device also chooses the seed. Yet the games are pure
and seeded — "a seed and a list of moves replays exactly" (ADR 0012) — and the API already runs a game's own rules
module in Jint, within limits (ADR 0016, 0017). The owner chose to verify Ghép Khối before the launch (D-10, D-16 Q2).

## Decision

- **A game that can be replayed says so**: the `ranked` capability and a `ranked` block in `game.json` — `verify`, an ES
  module in the build that exports `verify`; the `board` its ranked runs count on; `minMsPerMove`, the time a person
  needs per move at the least; `maxMoves`. The module is pure like a rules module — no DOM, timers, network,
  `Math.random` or `Date.now` — and has two functions: `replay({ seed, moves })` → `{ score, over }`, or `{ error }`
  for a move that is not legal; and `bot({ seed, moves })` → a legal next move, or `null` when the run is over.
- **A ranked run**: when a new game starts, the game asks the hub for one (`ranked.start`); the hub asks the API, which
  opens a run with a seed of its own and the server's time — one open run per profile and game, a new one closing the
  last. The game plays from that seed and keeps its moves with its own state (in its save, so a long run continues on
  any device). When the run ends it hands them in (`ranked.finish`, with the score it reached); the hub sends them on,
  or keeps them until it is back online.
- **The server replays it** with the verify module of the build that started the run, in Jint and within limits, in the
  background. The same score: `verified` (the `ReplayVerifier`). Another score, or a move that is not legal: `rejected` —
  hard proof. Faster than a person — less server time between start and finish than `minMsPerMove` per move: `held`.
  The run's result joins the integrity engine with its own source and counts on its board like any other.
- **Offline, nothing changes**: without the network when a game starts, it plays as today, unranked (ADR 0005); an
  unranked run never becomes ranked later. A hub that cannot open a ranked run answers `ranked.start` with an error,
  and the game plays unranked.
- **Additive**: a new optional capability, block, messages and `result.value`; older games and hubs ignore them, so the
  protocol stays 1.
- **Conformance** proves the module before any run depends on it: with `ranked`, the verify module exists, is at most
  256 KB, mentions no browser API, loads on its own with `Math.random` and `Date.now` throwing, plays a run with its own
  `bot` to the end (or `maxMoves`), replays it twice to the same score, and its moves survive JSON.
- **Ghép Khối is first.**

## Consequences

- Ghép Khối's server board fills with verified runs, and its community boards stop taking `checked` ones (D-16 Q4) once
  its build declares `ranked`.
- A replay proves that the moves are legal and score what was claimed — not that a person played them (R-06,
  Trackmania); the engine's signals still look at every run.
- Cost: a Ghép Khối run of 2,000 moves replays in a fraction of a second; runs are replayed one at a time in the
  background, so a busy hour delays a verification, never a game.
- The verify module ships in the immutable build (ADR 0007), so a run is always replayed by the build that started it.
- Each new game of a ranked game needs a round trip to the API before its first move; a game shows nothing different
  while it waits, and plays unranked if the answer does not come.

## Alternatives considered

- **Plausibility rules only:** stop clumsy cheats; a score "just high enough" still passes.
- **Signing scores on the device:** the key would ship in the game's code.
- **The server plays every move live:** latency on every move, cost, and no offline play (ADR 0005).
- **The hub keeps the moves instead of the game's save:** a long run continued on another device could never be
  verified.
