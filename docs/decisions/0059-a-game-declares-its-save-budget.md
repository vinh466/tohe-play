---
title: "0059: A game declares its save budget"
description: Add `saveBudgetKb` to game.json — 64 KB by default, up to 1 MB — and have the hub and the API enforce the game's budget instead of one global limit.
sidebar:
  order: 59
---

- **Status:** Accepted
- **Date:** 2026-11-09
- **Decided by:** the owner, 2026-11-09, in `plans/idle-card-rpg` D-17 ("P0 tối thiểu") and the
  `feat/van-du-ky-core` implementation packet.

## Context

The Game Contract has one save limit for every game: **64 KB** (`MAX_SAVE_BYTES`). It is enforced by the SDK host
(`packages/game-sdk/src/host.ts`) and by the API (`ProgressModule.MaxSaveBytes`), and documented in the contract and in
[progress sync](../architecture/progress-sync.md).

Vân Du Ký is a persistent RPG: a roster, gear, stars, stage progress, dailies, events and records. A realistic v1 save
is ~10–20 KB, but the plan allows a long-lived game to grow, and the owner chose to extend the platform before the game
(D-17). Raising the global limit to 256 KB would weaken the guardrail for every small game and make the number a
platform-wide policy rather than a game decision.

## Decision

A game declares its save budget in `game.json`:

```json
"saveBudgetKb": 256
```

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `saveBudgetKb` | integer, 1–1024 | `64` | Most bytes of the game's serialized save, in KB (1 KB = 1024 bytes) |

- The **hub host** enforces the budget of the manifest it is running
  (`manifest.saveBudgetKb * 1024`), not a constant. A save over it is refused with a clear message; the game keeps its
  in-memory state and may retry with a smaller save.
- The **API** enforces the budget of the game from the registry when it stores a save. A game the registry does not
  know falls back to 64 KB.
- **64 KB remains the default**; a game that does not declare the field behaves exactly as before. The maximum is
  **1 MB**, enough for a long-lived game and small enough to keep the database and sync cheap.
- The budget is **not** a promise that the platform will store arbitrary blobs: a save is still JSON, the last write
  wins, and the game owns its schema and migrations.
- The game's save should stay **well under** its budget; the budget is a guardrail, not a target.

### Not done here

- Per-game save encryption, compression or binary blobs.
- A save quota shared across profiles or games.
- Raising the maximum above 1 MB; a future game that needs it brings a new ADR and a measured reason.
- Asset on-demand delivery (ADR 0060, P0b).

## Consequences

- `packages/contract/src/manifest.ts`: the field, its default and the 1–1024 bound; the JSON schema is regenerated.
- `packages/game-sdk/src/host.ts`: the host uses the manifest budget; tests for the default and a 256 KB game.
- `services/api`: `registry.games` gains `SaveBudgetKb` (default 64), the catalog sync writes it, the progress
  endpoint reads it; a migration with the default; tests for 64 KB and 256 KB.
- `apps/hub`: the host is created with the game's manifest, so no separate change beyond passing the manifest it
  already has; a test that a 256 KB save reaches `onSave` and a larger one is refused.
- Docs: the Game Contract's manifest table and save section, and [progress sync](../architecture/progress-sync.md).
- Conformance: the manifest schema accepts the field; no new runtime check is needed because the host is the gate.
- Vân Du Ký declares `"saveBudgetKb": 256`; its save stays ~15–25 KB in v1.

## Alternatives considered

- **Raise the global limit to 256 KB.** Simple, but weakens the guardrail for every game and makes the limit a
  platform-wide decision. Lost: a game-specific declaration is a better fit for a platform that hosts very different
  games.
- **No limit.** Lets a bug or a hostile game fill the database; loses the offline-sync cost bound.
- **A separate `saves` table per game with a blob.** More storage flexibility, far more platform work; not needed for
  a JSON save under 1 MB.
- **A save budget in the profile settings.** The budget is a property of the game, not of the player; a player should
  not be able to raise it.
