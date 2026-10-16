---
title: "0019: Give every game a title screen, a HUD and a pause that holds, from the kit"
description: The kit's game shell opens on a title screen, pauses into a menu with a new game, steps Back from a game's end to the title, waits in its menu when the hub hides the game, shows the how-to before a first game and counts 3-2-1 for timed games; the kit draws the HUD; the hub keeps its loading screen until a shell game's first screen.
sidebar:
  order: 19
---

- **Status:** Accepted — the title screen over the game and the in-game menu amended by [ADR 0020](0020-a-game-has-a-menu-stage-and-a-play-stage.md) (menu and play stages)
- **Date:** 2026-10-16
- **Amends:** the screens of [ADR 0018](0018-every-game-opens-on-its-own-main-menu.md) (the flow and the contract stay)

## Context

A review of the experience from the catalog into a game (2026-10-16), against how popular casual games behave,
found the flow of ADR 0018 right but the screens and some steps not yet game-like or not uniform:

- The main menu was the same vertical card as the pause menu, up to seven full-width buttons: a form, not a title
  screen; a child who cannot read yet has to read every row.
- The pause menu had no new game, and two ways out (main menu, Tò He).
- Back on a game's end card opened the pause menu, against the design ("the end of a game → the main menu").
- When the hub hid a game (another app, a locked phone), Phaser games paused their scene and carried on as soon as
  the phone came back; only the hand-drawn Chạm Chấm opened its menu. Bots played on at once on return.
- The first-time how-to was copied into three games; the HUD (☰ place, score counting up, the best score lighting up,
  shortened scores, run ids) into two or three; Chạm Chấm drew everything by hand, so it drifted from the kit.
- The hub lifted its loading screen at the handshake, before a Phaser game had drawn its board and title screen: a
  bare board could flash, and take taps, before the menu appeared.

The owner agreed to the whole proposal ("tôi đồng ý với tất cả đề xuất của bạn … các game sau này sẽ có thể kế thừa
luồng chỉ cần custom nội dung", 2026-10-16): a stable foundation that every later game inherits by bringing only its
content. Leaving a game also stacked history entries in the hub; that was a bug, fixed separately (hub navigation,
[Launching a game](../architecture/game-launch-flow.md#leaving-and-phone-back)).

## Decision

The kit (`@tohe/game-kit`) owns more of every game; a game brings its name, picture, how-to, settings, in-progress
summary and end-card content.

- **Title screen** instead of the main-menu card: the whole screen over the game's art; the game's picture and name;
  one big **▶ Chơi** / **▶ Chơi tiếp** (with the in-progress chip), then **🔄 Ván mới** and **🌐 Chơi online** when
  they apply; a row of picture tools — 🔊 sound, ⚙️ settings, 🏆 leaderboard (when the hub can show it), ❓ how to
  play; **← Về Tò He** in the top-left corner.
- **Pause menu:** **▶ Tiếp tục**, **🔄 Ván mới** (asks first), **☰ Menu chính**, the tools 🔊 ⚙️ ❓, and the way out as a
  quiet button at the bottom. At a table or in a replay: **▶ Tiếp tục**, the tools and the seat's way out.
- **Back** from a game's end card goes to the title screen (in a replay, to the menu over it).
- **The hub hiding the game** (`pause`) opens the menu when the game is being played alone, and play waits there; at
  an online table nothing stops.
- **How to play before the first game:** `tutorial: { seen, done }`; the how-to card's **▶ Bắt đầu** starts play.
- **3-2-1** before play goes on from the menu, for games that run against the clock (`countdown: true`).
- `shell.start()`: the game calls it once its board is drawn; it shows the title screen (or play, when opened
  directly) and is the hub's sign that the first screen is up.
- **HUD** (`createHud`): ☰ always first, then the game's start (a score), centre (its own: the next block, 🔀, the
  hand number, the clock) and end (the best score, a button); `hud.score()` counts up, lights up a record and
  shortens a score that does not fit; `newRunId()` and `bump()` for the rest.
- **Chạm Chấm** stays the minimal game (Canvas 2D, no engine) but uses the kit's engine-free parts — shell, HUD,
  sounds — like every other game.
- **The hub's loading screen** shows the game's icon and name, and for a `shell` game stays until the game's first
  `menu` message (at most 8 s after the handshake, then it lifts anyway and counts `hub.game.first-screen-late`). The
  contract does not change: `menu { open }` already exists; its first occurrence now also means "first screen up".
- **Conformance**, for a `shell` game: the first screen is reported within 8 s of the handshake; Back opens the menu
  and Back again closes it; the hub's `pause` opens the menu; the first-time how-to is walked through with
  `data-tohe-play`.

Not done: interactive tutorials (a hand pointing on the board stays the game's), separate music and vibration
switches, shared input helpers (drag with a lifted piece, swipe) and audio samples — they come with the games that
need them (Lấp Ô, Xếp Gạch, the games for the youngest); a shared module for online tables waits for the second
online game.

## Consequences

- One look and one flow in all four games (Chạm Chấm 1.3, Ghép Khối 1.7, Chạm Ghép 0.7, Tiến Lên 0.5); a new game
  gets the title screen, menus, HUD, pause, Back and the how-to by passing its content to `createShell` and
  `createHud`.
- The kit's surface grows (`start`, `tutorial`, `countdown`, `createHud`); [Game shell](../architecture/game-shell.md)
  documents it, and `shell.test.ts` covers the flow step by step.
- A game must call `shell.start()` after drawing its board, or the hub's loading screen waits 8 s; conformance fails
  it first.
- Games no longer wire `session.on('pause' | 'resume')` for play: the shell's `onPause` / `onResume` cover the menu
  and the hub hiding the game alike (Tiến Lên keeps its own for a table, which does not stop).

## Alternatives considered

- **Keep the card main menu and only fix the bugs:** smaller, but leaves the form-like start the review found, and
  each new game would keep copying its HUD and how-to.
- **The hub draws the title screen around the iframe:** one implementation, but the title would not sit over the
  game's own art, and the game would still need a round trip to start; ADR 0018 rejected the hub drawing menus for
  the same reasons.
- **A new contract message for "first screen up":** clearer on the wire, but needs an SDK and protocol change for
  something the existing first `menu` message already says for every `shell` game.
