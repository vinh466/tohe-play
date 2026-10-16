---
title: Game shell
description: Every game opens on its own main menu and has one menu button while playing — exit, settings, leaderboard and how-to inside it — built once in the kit so every game inherits it.
sidebar:
  order: 8
---

> **Status: built** ([ADR 0018](../decisions/0018-every-game-opens-on-its-own-main-menu.md)). The owner accepted the
> flow on 2026-10-16 and left the menus' entries to this design (["the decisions"](#decisions)). Every game has it:
> Chạm Chấm 1.2, Ghép Khối 1.6, Chạm Ghép 0.6, Tiến Lên 0.4.

## Why

Until the shell, a game ran with two sets of controls on the phone: the hub's bar on top (**← Thoát / Về sảnh / Rời
phòng**, the game's name, 🔊) and the game's own **⏸** with its menu. Leaving was in one place and pausing in
another. The owner's words: "vừa exit vừa có nút pause … luồng lu bu lạ quá". Each game also started differently:
Ghép Khối and Chạm Ghép offered "Chơi tiếp" only with a run in progress, Tiến Lên's card opened the hub's rooms
lobby first, Chạm Chấm had a start card of its own; and rules-changing settings sat in a pause menu mid-hand.

Real games do it one way: **open → main menu → play → in-game menu → back to the main menu → leave**. Built once in
`@tohe/game-kit`, every Tò He game gets the same shape, and new games start from it.

## Principles

1. **One button while playing.** The game's ☰ (top left, always the same place and look) opens its menu; leaving is
   one of its entries. The hub draws nothing over a game with the shell.
2. **Every game opens on its main menu,** one tap from play: the first button is **▶ Chơi** (or **▶ Chơi tiếp** with
   a game in progress).
3. **Opening the menu pauses what can pause.** Alone, the game stops (timers, bots, animations). At an online table
   nothing stops, and the menu says "Bàn vẫn tiếp tục khi bạn mở menu."
4. **Rules are chosen before a game; looks any time.** A setting that changes how a game plays is changed from the
   main menu and read-only from the in-game menu ("Đổi ở menu chính, áp dụng từ ván sau."). Sound, colours and the
   deck change any time.
5. **Built once.** The kit owns the screens, their order, words and look; a game says what it has.
6. **Nobody gets stuck.** The hub keeps a way out for a game that does not load or does not answer.

## Screens

**Main menu**, over the game's own background (the felt, the board):

```
┌──────────────────────────────┐
│            🃏                │
│          Tiến Lên            │
│       Ván đang chơi dở.      │  the game in progress, when there is one
│  ┌────────────────────────┐  │
│  │      ▶ Chơi tiếp       │  │  "▶ Chơi" with nothing in progress (Tiến Lên: "🤖 Chơi với máy")
│  └────────────────────────┘  │
│  [ Ván mới ]                 │  only with a game in progress; asks first
│  [ 🌐 Chơi online ]          │  games with rooms, for signed-in profiles: the hub's lobby
│  [ ⚙️ Cài đặt ]              │  sound, then the game's settings
│  [ 🏆 Bảng xếp hạng ]        │  games with scores, for signed-in profiles: the hub's board over the game
│  [ ❓ Cách chơi ]            │
│  [ ← Về Tò He ]              │  leaves the game
└──────────────────────────────┘
```

**Playing:** only the game, with ☰ in its HUD. Phone **Back** (Android, the browser's) and **Esc** do what ☰ does.

**In-game menu:**

```
┌──────────────────────────────┐
│           ⏸️ Tạm dừng        │  at a table: "☰ Menu" and "Bàn vẫn tiếp tục khi bạn mở menu."
│  ┌────────────────────────┐  │
│  │       ▶ Tiếp tục       │  │
│  └────────────────────────┘  │
│  [ 🔊 Âm thanh: bật ]        │  switches at once
│  [ ❓ Cách chơi ]            │
│  [ ⚙️ Cài đặt ]              │  rules read-only, looks editable
│  [ ☰ Menu chính ]            │  the game stays in progress ("Chơi tiếp")
│  [ ← Về Tò He ]              │  at a table "Rời bàn" (the hub asks), watching "Thôi xem", a replay "Về sảnh"
└──────────────────────────────┘
```

**End of a game:** its card with **Chơi lại** and **☰ Menu chính** (a replay: **Xem lại từ đầu** and **Về sảnh**).
A card of the game's own (first-time hints, a hand's results) comes back when the menu over it closes.

**Back, step by step:** playing → the menu; the menu → playing; a card opened from a menu → that menu; the end of a
game → the main menu; the main menu → Tò He.

## Per game

| Game | Main menu | Settings | Notes |
| --- | --- | --- | --- |
| Chạm Chấm (`hello`) | ▶ Chơi, 🏆, ← Về Tò He | — | The minimal game without the kit draws the same screens by hand; its intro is the how-to. |
| Ghép Khối (`merge-block`) | ▶ Chơi / Chơi tiếp, Ván mới, ⚙️, 🏆, ❓, ← Về Tò He | Màu khối (any time) | First play shows the hints first. |
| Chạm Ghép (`tap-merge`) | as Ghép Khối | Màu khối (any time) | |
| Tiến Lên (`tien-len`) | 🤖 Chơi với máy / Chơi tiếp, Bàn mới, 🌐 Chơi online, ⚙️, ❓, ← Về Tò He | Luật nhà, Bàn chơi (between hands); Bộ bài (any time) | At a table and in a replay there is no main menu: the game opens straight in, and its menu holds Luật của bàn, Bộ bài and the way out. |

Tiến Lên's catalog card opens the game; **🌐 Chơi online** leads to the hub's lobby, whose ← goes back to the game.

## Contract

Additive, protocol 1 ([Game Contract v1](../contracts/game-contract-v1.md)):

| Addition | Meaning |
| --- | --- |
| capability `shell` | The game draws its main menu and in-game menu with a way back to Tò He; the hub draws no bar over it. Games without it keep the bar. |
| `init.shell` `{ leaderboard, rooms }` | What the hub can open for this player now (signed-in profiles; the game keeps scores / has rooms). |
| host → game `menu` | The player pressed Back. |
| game → host `menu` `{ open }` | The game's menu opened or closed: its answer to Back. |
| game → host `open` `{ what: 'leaderboard' \| 'rooms' }` | Show the hub's board over the game, or go to the game's lobby. Games still never call the API. |
| game → host `settings` `{ muted }` | The player switched sound in the game. |

SDK 0.7.0: `session.on('menu', …)` and `session.shell` (`can`, `menuChanged`, `open`, `setMuted`). Conformance, for a
`shell` game: it opens on a main menu with `[data-tohe-play]` and `[data-tohe-exit]`, answers `menu` with
`menu { open: true }` within 1.5 s, and its menu's `[data-tohe-exit]` sends `exit`.

## Hub

- **No bar** over a `shell` game: the iframe has the whole screen (56 px more on a phone). The reconnecting notice of
  a table floats at the top instead.
- **Back** is caught by the router (`useBlocker`) and sent to the game as `menu`; leaving goes through the game's
  own way out, which navigates forward. If neither `menu` nor `exit` comes back within 1.5 s, the hub's sheet offers
  **← Về Tò He** or **Chờ thêm**.
- **Before the game is ready** (loading, failed, refused origin) the hub shows its own **← Về Tò He**.
- **Leaving from the game's menu** goes at once: a choice made in a menu needs no question. (The hub's bar still asks:
  a stray tap near the top edge can land on it.) Leaving a table asks, as before, unless watching.
- **Leaderboard** opens as a sheet over the game: the same board as 🏆 on catalog cards, which stays.
- **Sound** is remembered per device (`tohe:muted`), whichever game or bar switched it.

## Kit

`createShell({ session, root, title, icon, inProgress, play, newGame, howTo, settings, online, leaderboard, onPause,
onResume, direct })` replaces `createLifecycle`. It returns `overlay` (for the game's own cards, brought back after
the menu), `playing`, `mainMenu()`, `menu()`, `menuButton()` (☰) and `gameOver(card, again?)`. Settings declare
`when: 'between-games' | 'any-time'` and draw a read-only card when asked. `direct` opens straight into play with no
main menu (a table: `goesOn`; a replay) and names the way out.

## Tests

| Where | What |
| --- | --- |
| Kit (`shell.test.ts`) | The main menu's entries, play / pause / resume, Back step by step, a game card brought back, rules read-only during a game, sound, a table's menu, the end of a game |
| SDK | `init.shell`, `menu` both ways, `open`, `settings`, and refusal without the capability |
| Conformance | The three shell checks above, for every `shell` game; random input starts from **Chơi** |
| Hub | `shell` kept from the API view |
| e2e smoke | Chạm Chấm opens on its main menu with no bar, a round, the board over the game, Back opens and closes the menu, leaving from it |
| e2e rooms | Tiến Lên's main menu → Chơi online → lobby; leaving a table and stopping watching from ☰ |

## Decisions

The owner accepted the flow on 2026-10-16 ("luồng menu theo đề xuất của bạn ổn đó, main menu và menu trong game thì
bạn cứ đề xuất đặt option như thế nào cho phù hợp"), so the proposal's questions took their proposed answers:

1. Every game opens on its main menu, with play as the first button.
2. Phone Back opens the menu (and steps back through it); it leaves only from the main menu.
3. The leaderboard opens as a hub sheet over the game; 🏆 stays on catalog cards.
4. Tiến Lên's card opens its main menu; **Chơi online** leads to the hub's lobby.
5. Rules are fixed during a game; looks and sound change any time.
6. Sound moves into the game (in-game menu and settings); the hub remembers it per device.

The menus' entries are as drawn above.
