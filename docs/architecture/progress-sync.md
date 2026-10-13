---
title: Saves, scores and sync
description: How a game's saves and scores reach every device of a profile, and the household leaderboard (M2).
---

Decision: [ADR 0005 — offline first](../decisions/0005-offline-first.md). Games know nothing of this: they call
`save()` and `submitScore()` ([Game Contract](../contracts/game-contract-v1.md)); the hub does the rest.

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
- **Scores** never conflict: every finished run is stored. Each carries a `clientId` chosen on the device, so a
  retry after a lost answer is stored once.

## API (`/api/progress`, module `Progress`, schema `progress`)

| Endpoint | Does |
| --- | --- |
| `GET /api/progress/saves` | Every save of the active profile, with the server time of its last write. |
| `PUT /api/progress/saves/{gameId}` | Stores a save (any JSON, at most 64 KB as in the contract); the last write wins. |
| `POST /api/progress/scores` | Records finished runs (up to 200 per call); repeats of a `clientId` are ignored. |
| `GET /api/progress/leaderboard/{gameId}?board=default` | Best score of each household member, highest first. |

All need a session with a chosen profile (`403 profile_required` otherwise). The leaderboard reads names and
avatars through Identity's `IHouseholdProfiles`, never its tables. Scores of a deleted profile stay in the table
but no longer appear on the leaderboard.

## In the hub

| Piece | Where |
| --- | --- |
| Local tables (`saves`, `scores` with `clientId`) | `apps/hub/src/storage/db.ts` (Dexie, version 2) |
| Push / pull rules | `apps/hub/src/storage/sync.ts` — tested in `src/sync.test.ts` against an in-memory server |
| When it runs | `src/session/useBackgroundSync.ts` (screens, coming online), `PlayPage` (before a game, after saves) |
| Leaderboard | 🏆 on each catalog card (`src/ui/Leaderboard.tsx`); it pushes the device's newest scores first |

## Offline

- Playing, saving and scoring work offline; writes wait in IndexedDB until the next sync.
- The leaderboard shows the last copy it fetched (or a message if it never could).
- A device that never comes online keeps its progress to itself; nothing is lost when it does.

## Not yet

- Restoring the replaced save (`previous_data`) has no screen; it is there for a parent to ask for.
- Pending writes of a profile that is no longer the active one wait until that profile plays again on the device.
