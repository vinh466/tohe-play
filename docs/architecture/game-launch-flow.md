---
title: Launching a game
description: The sequence from tapping a game card to the game being closed, including offline behaviour.
sidebar:
  order: 2
---

```mermaid
sequenceDiagram
  autonumber
  actor P as Player
  participant H as Hub (host)
  participant G as Game iframe
  participant L as IndexedDB
  participant A as Platform API

  P->>H: tap game card
  H->>H: check entryUrl is on the games origin
  H->>H: createHost() starts listening
  H->>G: iframe.src = entryUrl
  G->>H: ready {gameId, sdkVersion}
  H->>L: load save (profile, game)
  H->>G: init {profile, locale, settings, save, seed}
  Note over G: game plays
  G->>H: save {id, data}
  H->>L: put save (synced = 0)
  H-->>G: result {replyTo: id, ok}
  G->>H: score {id, value, board}
  H->>L: add score (synced = 0)
  H-->>G: result {ok}
  Note over H,A: M2: background sync pushes unsynced rows to the API
  P->>H: switches tab
  H->>G: pause
  P->>G: ☰ → Về Tò He (shell games, ADR 0018)
  G->>H: exit
  H->>H: dispose host, iframe → about:blank
```

## Rules

- The hub **starts listening before** it sets `iframe.src`, so `ready` can never be missed.
- The hub only accepts messages whose `source` is that iframe's window **and** whose `origin` is the games
  origin; everything else is ignored.
- Every incoming message is validated with the Zod schemas from `@tohe/contract`. Invalid messages are dropped
  and reported through `onProtocolError` (logged to the console in the hub).
- `save` and `score` are only accepted if the game declared the `save` / `scores` capability in `game.json`.
- Saves are limited to 64 KB of JSON. Larger saves are rejected with `ok: false`.
- The seed is the local date (`YYYYMMDD`), so everybody gets the same randomness on the same day — the basis for
  daily challenges.

## Offline

- The hub's service worker precaches the hub; `GET /api/games` and `GET /api/config` are cached network-first,
  and the hub additionally keeps the last good copy in IndexedDB.
- Saves and scores are written to IndexedDB first. Nothing waits for the network.
- Game builds are immutable and served with long cache lifetimes, so a game played once is in the browser cache.
  A dedicated games-origin service worker is a planned spike ([walking skeleton](../roadmap/walking-skeleton.md#spikes)).
