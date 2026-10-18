---
title: "0032: Watch a ranked run in the game itself, in the admin console"
description: A ranked game also plays a run back from its seed and moves, recording nothing; the console opens the build that played the run and hosts it, framing the games origin for that alone.
sidebar:
  order: 32
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [Game Contract v1](../contracts/game-contract-v1.md) — `init.rankedReplay`, optional (protocol stays 1),
  and every `ranked` game shows one; [ADR 0030](0030-ranked-runs-replayed-by-the-server.md) — a ranked run can be
  watched as well as replayed; [ADR 0027](0027-platform-admin-and-the-first-owner.md) — the console's CSP frames the
  games origin

## Context

A held ranked run waits for a person (ADR 0031), who sees its numbers: the moves, the time the server measured, the
score claimed and replayed. D-16 asked for more: watching the run in the game itself, as ADR 0017 lets players watch a
hand they played at a table. The server keeps every run's seed and moves, the build that played it is immutable
(ADR 0007), and a ranked game's logic is pure and seeded (ADR 0030) — the same logic shows the same run.

## Decision

- **The game plays the run back.** Opened with `init.rankedReplay` (`seed`, `moves`) instead of a game, a `ranked`
  game starts from the seed and plays the moves back with the logic its verify module replays them with, and records
  nothing: no save, no score, no ranked run. A move that is not legal ends the playback there, so a run refused for
  one can still be watched. The SDK (0.9.0) exposes it as `session.rankedReplay`; conformance opens every `ranked`
  game with a run its verify module's bot played and checks that it plays back without errors and sends no `save`,
  `score`, `ranked.start` or `ranked.finish`.
- **The console is the host.** "Xem lại run trong game" on a ranked result asks the API for the run's seed and moves
  and the build that played it, and opens that build in a sandboxed iframe with the host side of the SDK, keeping
  nothing the game sends. The console's CSP gains `frame-src` for the games origin and nothing else; the host and the
  contract's schemas load only with the viewer.
- **Only with the build that played it.** The games origin serves the catalog's builds alone, so once the catalog
  moved on to a newer build the run can no longer be watched — the console says so, and the numbers stay. Another
  build's logic could show a different game.

## Consequences

- Reviewers see how a run was played, not only what it scored: a run held as too fast, or rejected for an illegal
  move, can be watched up to where it went wrong.
- Every `ranked` game carries a playback mode; Ghép Khối 1.10.0 has back, forward, play and pause at three speeds and
  a slider to any move.
- The console frames the games origin. A game there runs in a sandboxed iframe on another origin and talks to the
  console only through the contract's validated messages, as it does with the hub.
- Runs played on a build the games origin no longer serves cannot be watched; keeping old builds — the cleanup policy
  ADR 0007 leaves open — would bring them back without any change here.

## Alternatives considered

- **Watching in the hub, on a page for admins:** no CSP change, but the hub would carry admin-only pages and data,
  which ADR 0027 keeps in the console.
- **Drawing the run in the console from the moves:** every game's drawing would have to live twice.
- **A recording of the screen:** large, and the phone would have to record while the player plays.
