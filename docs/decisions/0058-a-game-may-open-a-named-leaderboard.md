---
title: "0058: A game may open a named leaderboard"
description: The shell's leaderboard request carries an optional board id and a short label, so a game can show a board other than its score — Lấp Ô's streak board — using the boards scores already write to.
sidebar:
  order: 58
---

- **Status:** Accepted
- **Date:** 2026-11-08
- **Amends:** [ADR 0018](0018-every-game-opens-on-its-own-main-menu.md) — the leaderboard screen gains a named
  board; [ADR 0029](0029-integrity-engine-and-boards-by-trust.md) — a game's boards are not only its score board.

## Context

A score already carries a **board** id (`scores` in the Game Contract, default `default`), and the API's account and
public boards read by that id. The shell's `open` message had only `what: 'leaderboard' | 'rooms'`, so the hub always
opened the `default` board. A game that wants a second ranking — Lấp Ô's best **streak** of consecutive clears — had no
way to show it, even though its scores could be written to a named board.

## Decision

`open` gains two optional fields:

- **`board`** — the id of one of the game's boards, the same id its scores use. The hub opens that board in the
  account, community and server scopes and in both periods, exactly as it opens `default`.
- **`label`** — a short word for the hub to show beside the game's name (e.g. "Chuỗi"), so the player knows which
  board is open. The hub escapes it; it is a label, not a security boundary.

`default` remains the score board and the catalog's **Bảng điểm** still opens it. A game may open any board; a board it
never submits to is empty. There is no manifest list of boards: the game and its scores agree on the id. Games still
never call the API; the hub reads the board for them.

## Consequences

- A game can offer more than one long-term ranking without a platform change per metric: the score board and a
  streak, combo, level or daily board, as long as it submits scores with that board id.
- The hub does not validate what a board means; it only reads the values the game submits. A typo in a board id shows
  an empty board, not an error.
- The protocol grows by two optional fields; a game and a hub from the same release understand them. A hub from before
  this ADR ignores the board and shows `default`, which is a safe fallback.
- The board label is game-provided words; no translation is added to the hub for it.

## Alternatives

- **A `boards` list in `game.json`** — lets the catalog show a selector and validate ids, but needs a manifest field,
  a database column, a catalog sync change and a UI board picker. Not needed for one game's second board.
- **A hardcoded combo/streak board in the hub** — works for Lấp Ô, but puts a game's metric in the platform. Rejected.
- **Only the score board** — the combo's skill is folded into the score; the owner asked for a board about it. Rejected.
