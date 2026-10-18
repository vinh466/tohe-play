---
title: Saves, scores and sync
description: How a game's saves and scores reach every device of a profile (M2); the boards that rank the scores come from the integrity engine.
---

Decision: [ADR 0005 — offline first](../decisions/0005-offline-first.md). Games know nothing of this: they call
`save()`, `submitScore()` and `run()` ([Game Contract](../contracts/game-contract-v1.md)); the hub does the
rest.

## The path of a save

1. A game calls `save(data)`. The hub writes it to IndexedDB at once (`saves`, `synced = 0`) and answers the game,
   so a game never waits for the network.
2. About 1.5 s later the hub pushes pending saves and scores (one round trip for a burst of moves). It also syncs
   when a hub screen opens and when the device comes back online.
3. Before a game starts, the hub pulls the newest saves of the profile (at most 2.5 s; then it plays with what the
   device has). This is what lets a child continue on another device.

Only **account profiles** sync, and only the profile active in the session (the API accepts writes for that one
only). **Guests** keep everything on the device.

## Conflicts

The same profile can play on two devices that are offline at the same time.

- **Saves:** the last write to reach the server wins; the server keeps the version it replaced
  (`previous_data`), so one conflict can be undone by hand. On a device, a save that is still waiting to be pushed is
  never overwritten by a pull: it is newer for that device, and it wins when it is pushed.
- **Scores** never conflict: every run is stored. Each carries a `clientId` chosen on the device, so a retry
  after a lost answer is stored once. Every run also goes to the integrity engine, in the same transaction, which
  decides how far it can be trusted and ranks it ([Integrity and boards](integrity.md)).

## Long runs (ADR 0014)

A game whose run lasts across sittings reports it as it grows (`run(id).update`) and finishes it at the end.

- The hub keeps **one score row per run**: a higher report raises its value, and a final report marks it final for
  good. Every change makes the row pending again.
- A push marks a row synced only if it still holds what was sent, so a report made during the request is pushed
  next time.
- The server applies the same rules to a `clientId` it already has.
- A ranked run handed in ([ADR 0030](../decisions/0030-ranked-runs-replayed-by-the-server.md)) waits in `ranked` until
  the API takes it; a run the API will never take — a newer one closed it — is dropped, anything else is tried again.
- A profile's best on the account's board can be a run in progress (`inProgress`, shown as "▶ đang chơi"); the engine
  judges a run once it is final.

## API (`/api/progress`, module `Progress`, schema `progress`)

| Endpoint | Does |
| --- | --- |
| `GET /api/progress/saves` | Every save of the active profile, with the server time of its last write. |
| `PUT /api/progress/saves/{gameId}` | Stores a save (any JSON, at most 64 KB as in the contract); the last write wins. |
| `POST /api/progress/scores` | Records runs (up to 200 per call). A known `clientId` raises that run's score or makes it final; otherwise it is ignored. |

All need a session with a chosen profile (`403 profile_required` otherwise). The account's board is
`GET /api/boards/{gameId}` ([Integrity and boards](integrity.md#the-accounts-board)). Scores of a deleted profile stay
in the table but no longer appear on a board.

## In the hub

| Piece | Where |
| --- | --- |
| Local tables (`saves`, `scores` with `clientId`, `ranked` — runs handed in, ADR 0030) | `apps/hub/src/storage/db.ts` (Dexie, version 3) |
| Push / pull rules | `apps/hub/src/storage/sync.ts` — tested in `src/sync.test.ts` against an in-memory server |
| When it runs | `src/session/useBackgroundSync.ts` (screens, coming online), `PlayPage` (before a game, after saves) |
| Leaderboard | 🏆 on each catalog card (`src/ui/Leaderboard.tsx`): this week or all time; it pushes the device's newest scores first |

## Offline

- Playing, saving and scoring work offline; writes wait in IndexedDB until the next sync.
- The leaderboard shows the last copy it fetched for that period (or a message if it never could).
- A device that never comes online keeps its progress to itself; nothing is lost when it does.

## Not yet

- Restoring the replaced save (`previous_data`) has no screen; it is there for a parent to ask for.
- Pending writes of a profile that is no longer the active one wait until that profile plays again on the device.
