---
title: "0020: Give every game a menu stage and a play stage"
description: A game opens on its own menu stage, with no engine running; pressing play creates the play stage, loaded in the background meanwhile and destroyed when the player returns to the menu; the in-game menu is a quick panel over play whose way out is the main menu, not Tò He.
sidebar:
  order: 20
---

- **Status:** Accepted
- **Date:** 2026-10-16
- **Amends:** the screens and lifetimes of [ADR 0018](0018-every-game-opens-on-its-own-main-menu.md) and
  [ADR 0019](0019-game-shell-2-title-screen-hud-and-first-screen.md) (the contract's messages stay)

## Context

After ADR 0019, the title screen was a blurred layer over a game whose engine had already started and drawn its
board: menu and play shared one page and one lifetime, and the in-game menu repeated the main menu, with its own way
out to Tò He. The owner asked for the stages to be separate (2026-10-16): the main menu as the game's own first
screen and the only way back to Tò He, with proper screens for its options; play as a stage that loads the game and
runs it; an in-game overlay with the options that fit a game in progress, applied at once rather than a copy of the
main menu; the way out of play being the main menu ("vòng đời này giúp rõ ràng về luồng cho user lẫn hợp lý cho game
logic khi gameplay là 1 dạng nặng nề cần tách bạch"). They accepted the proposed defaults: the engine is freed when
the player returns to the menu, and Back on the in-game menu goes on playing. Evidence and sources:
[Game flow research](../research/game-flow.md).

## Decision

- **Menu stage.** Every game opens on its own full screen — the game's picture, name and colours, ▶ Chơi / ▶ Chơi
  tiếp, 🔄 Ván mới, 🌐 Chơi online where they apply, and the tools 🔊 ⚙️ 🏆 ❓. ⚙️ Cài đặt and ❓ Cách chơi are full
  screens of the menu stage (one level deep; Back returns). It runs no engine and draws no board, and it holds the
  only way back to Tò He (corner, and Back).
- **Play stage.** A game's play code is a separate module (`stage.ts`, loaded with `import()`): pressing play
  creates it — engine, board, HUD — from the save; returning to the main menu saves, stops and frees it. The menu
  stage fetches the module in the background, so play starts without a download; a loading view in the kit's style
  covers the board until the stage says its first frame is ready.
- **In-game menu: a quick panel over play.** ▶ Tiếp tục first; live rows applied in place (🔊 sound as a switch, the
  game's looks as choices that repaint the board behind the panel); 🔄 Ván mới (asks first), ❓ Cách chơi, ☰ Menu
  chính. **No way out to Tò He** from play; at an online table or in a replay, which have no menu stage, the panel
  keeps the seat's way out (Rời bàn, Thôi xem, Về sảnh).
- **Back steps one level:** playing → the panel; the panel → playing (3-2-1 for a game against the clock); a game's
  end → the main menu; a screen of the menu stage → the menu; the menu → Tò He. The hub hiding a game still opens
  the panel (ADR 0019).
- **Kit API.** `createShell({ …, stage: () => import('./stage.ts') })`; the module exports
  `start(ctx): PlayStage` with `pause`, `resume`, `newGame`, `leave` and `quick()` (the live rows); `ctx` gives the
  stage its root element, ☰, the game's own cards, `gameOver` and `ready()`. Settings are sections of the ⚙️ screen
  (`content()`), between-games ones noted "áp dụng từ ván sau" while a game is in progress.
- **Conformance**, for a `shell` game: no `<canvas>` under the title screen; the panel shows no
  `[data-tohe-exit]` (except at a table or in a replay); its `[data-tohe-main-menu]` leads to the title screen,
  whose `[data-tohe-exit]` sends `exit`; plus the checks of ADR 0019.

Not done: keeping a hidden engine for an instant return (the owner chose to free it; a saved game resumes in well
under a second once the module is cached), per-game illustrated title art beyond the kit's design (games pass a
few decoration emoji), haptics or music switches (no per-device setting for them in the contract yet).

## Consequences

- Each game has `main.ts` (the menu stage: session, save summary, settings) and `stage.ts` (the play stage); a
  shared `store` holds the save between them. The four games move to it: Chạm Chấm 1.4, Ghép Khối 1.8, Chạm Ghép
  0.8, Tiến Lên 0.6.
- Opening a game is faster — the menu needs no engine — and sitting in the menu costs no CPU or GPU on weak phones;
  entering play costs one engine boot each time.
- A stage must clean up after itself in `leave()` (listeners, timers, the engine): a stage that leaks would slow
  the next one. Conformance enters and leaves play; the e2e smoke goes menu → play → menu → Tò He.
- The `data-tohe-main-menu` marker joins `data-tohe-play`, `data-tohe-exit` and `data-tohe-menu` in the contract's
  shell section.

## Alternatives considered

- **Keep one page and hide the board under an opaque title:** simple, but the engine still boots before the menu and
  runs under it; not the separation the owner asked for.
- **Keep the engine alive, hidden, while in the menu:** instant return, but memory and timers stay in use on weak
  phones, and play state could change under the menu; the owner preferred to free it.
- **Two pages (a menu page and a play page in the iframe):** a clean split, but every switch would reload the SDK
  session and handshake with the hub, and the hub's history and Back handling would see two games.
