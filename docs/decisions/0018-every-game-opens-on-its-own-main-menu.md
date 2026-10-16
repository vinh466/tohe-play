---
title: "0018: Every game opens on its own main menu and has one menu button"
description: A game shell in the kit — main menu, one in-game menu with the way out, rules fixed during a game — replaces the hub's bar over games; a `shell` capability, `init.shell`, and `menu`, `open` and `settings` messages, additively.
sidebar:
  order: 18
---

- **Status:** Accepted — the screens amended by [ADR 0019](0019-game-shell-2-title-screen-hud-and-first-screen.md) (title screen, HUD, pause) and [ADR 0020](0020-a-game-has-a-menu-stage-and-a-play-stage.md) (menu and play stages)
- **Date:** 2026-10-16

## Context

While a game ran, the hub drew a bar above it (leave, the game's name, sound) and the game drew its own ⏸ menu. The
owner, after playing Tiến Lên 0.3, found the two confusing ("vừa exit vừa có nút pause … lu bu lạ quá") and asked
for one button whose menu holds the way out, and for every game to live like a complete game: open on a main menu
(start or continue, settings, leaderboard, exit), play, open a menu that pauses when the game can pause, return to
the main menu, with rules-changing settings fixed before a game rather than changed in the middle of one. Each game
started differently, and the kit's `createLifecycle` covered only "continue or new game" and the ⏸ menu.
Design: [Game shell](../architecture/game-shell.md).

## Decision

- **The kit owns a game shell** (`createShell`, replacing `createLifecycle`): the main menu, the ☰ button and
  in-game menu, the end-of-game card, pausing, phone Back and Esc, and settings that change either between games or
  any time. Every game uses it (the minimal Chạm Chấm draws the same screens by hand); new games start from it.
- **One way out while playing:** the game's menu. A game declaring the new `shell` capability gets the whole screen;
  the hub draws no bar over it. Games without it keep the bar.
- **Contract, additively (protocol 1):** capability `shell`; `init.shell { leaderboard, rooms }` (what the hub can
  open for this player); host → game `menu` (the player pressed Back); game → host `menu { open }` (its menu opened
  or closed, the answer to Back), `open { what: 'leaderboard' | 'rooms' }` and `settings { muted }`. `exit` stays.
  Conformance checks that a `shell` game opens on a main menu with play and a way out, answers `menu` within 1.5 s,
  and that the way out of its menu sends `exit`.
- **The hub keeps a safety net:** its own "Về Tò He" until the game is ready, and a sheet when the game does not
  answer Back within 1.5 s.
- **Data stays with the hub:** leaderboards and rooms remain hub screens, opened on the game's request; games still
  never call the API.

Not done: a shell drawn by the hub around the iframe, per-game styling of the menus beyond the design tokens,
changing rules in the middle of a game.

## Consequences

- One shape for every game: one tap to play from the main menu, one button while playing, the same words everywhere.
- The four games changed (Chạm Chấm 1.2, Ghép Khối 1.6, Chạm Ghép 0.6, Tiến Lên 0.4); Tiến Lên's catalog card opens
  its main menu, and its lobby is reached from **Chơi online**.
- The hub lost its bar over games (56 px more for the game on a phone) and gained the safety net, Back handling, a
  leaderboard sheet over the game and a per-device sound setting.
- More kit surface to keep stable: the shell is part of what [ADR 0012](0012-phaser-and-the-game-kit.md) asks every
  game to use.
- The owner accepted the flow on 2026-10-16 ("luồng menu theo đề xuất của bạn ổn đó, main menu và menu trong game thì
  bạn cứ đề xuất đặt option như thế nào cho phù hợp"); the menus' entries are in the design.

## Alternatives considered

- **The hub draws the main menu and the in-game menu** around the iframe: one implementation and direct access to the
  leaderboard and rooms, but menus outside the game do not look or feel like the game's own, how-to and settings
  cards need the game's art, and pausing would still need a message round trip.
- **Keep the hub's bar and only drop the game's duplicates:** smaller, but leaves two buttons and no main menu, which
  is what the owner asked for.
- **Leave each game to design its own start and menus:** what happened before; every game ends up different.
