---
title: "0014: Live scores for runs that last across sittings"
description: A long run reports its score as it grows under one id; the leaderboard shows it as in progress until it ends, and an abandoned run keeps its best score.
sidebar:
  order: 14
---

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The household leaderboard (M2) only saw a score at game over. Some games are saved after every move and a single
run lasts days: a child's Ghép Khối game at 40,000 points was invisible until the board filled up, and a run
left behind for a new game never counted at all. The owner asked for long runs to reach the leaderboard while they
are still being played.

A game's save stays opaque to the hub (the contract's promise), so the hub cannot read the score out of it: the game
has to say it.

## Decision

- **The protocol's `score` message gains two optional fields:**
  - `run`: an id the game picks for one run (1–64 characters) and keeps in its save;
  - `final`: `false` while the run goes on; the default, `true`, is a score that is complete.

  A score without `run` is a one-shot score, as before. The change is additive, so the protocol stays at 1: older
  builds send neither field and their scores are final.
- **SDK 0.3.0:** `session.run(id, board?)` returns `update(value)` (sends `final: false`) and `finish(value)` (sends
  `final: true`). A game updates after each move that scores and finishes at game over. **A run the player leaves
  for a new game is finished by the game with the best score it reached**, so nothing a child saw on screen is lost.
- **One run is one score.**
  - The hub keeps one local score per profile, game and run. Its value only rises, and once final it stays final.
  - The server row, keyed by the hub's `clientId`, follows the same rules when the same `clientId` is sent
    again.
  - A run's id is a key inside one profile's scores, never a server id. So a game cannot touch another
    profile's rows.
- **The leaderboard shows runs in progress.** A profile's best score can come from a run that is still going on;
  the entry carries `inProgress` and the hub shows "▶ đang chơi" under the name.

## Consequences

- Runs reach the leaderboard after the next sync, about 1.5 s after a move.
- Games send more score messages, one per scoring move. Each one is a single local write; the sync batches a burst
  of them into one request.
- A run's score cannot go down. That suits every board today, because the leaderboard ranks the highest score
  first. A "lowest time wins" board would need its own rule.
- A run that is never finished (its save deleted, or the game uninstalled) stays "in progress" with its best score.
  That is acceptable: the score was reached.
- The `progress.scores` table gains `final` (default `true`, so existing rows are finished runs).

## Alternatives considered

- **The hub reads the score from the save:** it would break the opaque-save rule and tie the hub to each game's
  format.
- **`submitScore` on every pause or exit:** each sitting would become a separate leaderboard entry for one run.
- **Discard abandoned runs:** simpler, but a child loses a record they watched happen.
- **Final scores only, as before:** this is the problem the owner described.
