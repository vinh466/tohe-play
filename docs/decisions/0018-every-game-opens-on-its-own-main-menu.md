---
title: "0018: Every game opens on its own main menu and has one menu button"
description: A game shell in the kit — main menu, one in-game menu with the way out, rules fixed during a game — replaces the hub's bar over games; a `shell` capability and `menu`, `open` and `settings` messages, additively.
sidebar:
  order: 18
---

- **Status:** Proposed
- **Date:** 2026-10-16

## Context

While a game runs, the hub draws a bar above it (leave, the game's name, sound) and the game draws its own ⏸ menu.
The owner, after playing Tiến Lên 0.3, found the two confusing ("vừa exit vừa có nút pause … lu bu lạ quá") and asked
for one button whose menu holds the way out, and for every game to live like a complete game: open on a main menu
(start or continue, settings, leaderboard, exit), play, open a menu that pauses when the game can pause, return to
the main menu. Rules-changing settings would be fixed before a game rather than changed in the middle of one. Today
each game starts differently and the kit's `createLifecycle` covers only "continue or new game" and the ⏸ menu.
Design: [Game shell](../architecture/game-shell.md).

## Decision

- **The kit owns a game shell** (`createShell`, growing out of `createLifecycle`): the main menu, the ☰ button and
  in-game menu, the end-of-game card, pausing, phone Back, and settings that change either between games or any time.
  Every game moves to it; new games start from it.
- **One way out while playing:** the game's menu. A game declaring the new `shell` capability gets the whole screen;
  the hub draws no bar over it. Games without it keep the bar.
- **Contract, additively (protocol 1):** capability `shell`; host → game `menu` (open your menu: the player pressed
  Back); game → host `open { what: 'leaderboard' | 'rooms' }` (the hub shows its board over the game, or the game's
  lobby) and `settings { muted }` (sound switched in the game, remembered per device by the hub). `exit` stays.
  Conformance checks that a `shell` game answers `menu` with a menu and that a way from it sends `exit`.
- **The hub keeps a safety net:** a game that fails to load, throws on start, or does not answer `menu` within 1.5 s
  gets the hub's own "Về Tò He" sheet.
- **Data stays with the hub:** leaderboards and rooms remain hub screens, opened on the game's request; games still
  never call the API.

Not done: a shell drawn by the hub (outside the iframe), per-game themes for the menus beyond the design tokens,
changing rules in the middle of a game.

## Consequences

- One shape for every game: one tap to play from the main menu, one button while playing, the same words everywhere.
- The four games change (kit games through `createShell`, Chạm Chấm by hand as the minimal example) and get minor
  versions; Tiến Lên's catalog card opens its main menu, and its lobby is reached from **Chơi online**.
- The hub loses its bar over games (56 px more for the game on a phone) and gains the safety net, Back handling and a
  leaderboard sheet.
- A game's sound switch moves into the game; the hub still remembers it.
- More kit surface to keep stable: the shell becomes part of what [ADR 0012](0012-phaser-and-the-game-kit.md) asks
  every game to use.

## Alternatives considered

- **The hub draws the main menu and the in-game menu** around the iframe: one implementation and direct access to the
  leaderboard and rooms, but menus outside the game do not look or feel like the game's own, how-to and settings
  cards need the game's art, and pausing would still need a message round trip.
- **Keep the hub's bar and only remove the game's ⏸ exit duplicates:** smaller, but leaves two buttons and no main
  menu, which is what the owner asked for.
- **Leave each game to design its own start and menus:** what happens today; every game ends up different.
