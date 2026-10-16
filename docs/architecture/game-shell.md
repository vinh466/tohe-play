---
title: Game shell (proposal)
description: Every game opens on its own main menu and has one menu button while playing — exit, settings, leaderboard and how-to inside it — built once in the kit so every game inherits it.
sidebar:
  order: 8
---

> **Status: proposal** ([ADR 0018](../decisions/0018-every-game-opens-on-its-own-main-menu.md), Proposed). Asked by the
> owner on 2026-10-16 after playing Tiến Lên 0.3. Nothing here is built yet; the [open questions](#open-questions)
> come first.

## Why

While a game runs today there are two sets of controls on the phone: the hub's bar on top (**← Thoát / Về sảnh /
Rời phòng**, the game's name, 🔊) and the game's own **⏸** with its menu (Tiếp tục, Ván mới, Cách chơi…). Leaving is
in one place and pausing in another, and the two behave differently: the hub's ← pauses and asks, the ⏸ pauses and
offers more. The owner's words: "vừa exit vừa có nút pause … luồng lu bu lạ quá".

Each game also starts differently: Ghép Khối and Chạm Ghép offer "Chơi tiếp" when a run is in progress and otherwise
drop the player straight into a board; Tiến Lên's card opens the hub's rooms lobby before the game; Chạm Chấm has a
start card of its own with its own exit. Settings that change the rules (Tiến Lên's house rules, players, bots) sit
in the pause menu in the middle of a hand, with a note that they apply to the next one.

Real games do it one way: **open → main menu → play → in-game menu → back to the main menu → leave**. Built once in
`@tohe/game-kit`, every Tò He game gets the same shape for free, and new games start from it.

## Principles

1. **One button while playing.** The game's ☰ (top-left, always the same place and look) opens its menu; leaving is
   one of its entries. The hub draws nothing over a game that has the shell.
2. **Every game opens on its main menu.** One tap to play: the first button is **Chơi** (or **Chơi tiếp** with a run in
   progress).
3. **Opening the menu pauses what can pause.** Playing alone, the game stops (timers, animations, bots). At an online
   table nothing stops; the menu says "Bàn vẫn tiếp tục".
4. **Rules are chosen before a game; looks any time.** Settings that change how a game plays are set on the main menu
   and fixed while a game is on (the in-game menu shows them read-only, "đổi ở menu chính, áp dụng ván sau"). Sound,
   colours and the deck change any time.
5. **Built once.** The kit owns the screens, their order, strings and look; a game declares what it has (modes,
   settings, a leaderboard, how to play) and gets the rest.
6. **Nobody gets stuck.** The hub keeps a way out for a game that fails to load, crashes or does not answer.

## Screens

**Main menu** (over the game's own background, e.g. the felt or an empty board):

```
┌──────────────────────────────┐
│            [icon]            │
│           TIẾN LÊN           │
│                              │
│  ┌────────────────────────┐  │
│  │   ▶  Chơi tiếp (ván 3)  │  │  primary: "Chơi" when nothing is in progress
│  └────────────────────────┘  │
│  [ Ván mới ]                 │  only with a game in progress (asks first)
│  [ 🌐 Chơi online ]          │  games with rooms: the hub's lobby
│  [ ⚙  Cài đặt ]              │  rules for the next game, sound, colours…
│  [ 🏆 Bảng xếp hạng ]        │  games with scores: the hub's board, over the game
│  [ ❓ Cách chơi ]            │
│  [ ← Về Tò He ]              │  leaves the game
└──────────────────────────────┘
```

**Playing:** only the game, with ☰ in its HUD. Phone **Back** (Android gesture, browser back) opens the same menu.

**In-game menu:**

```
┌──────────────────────────────┐
│ Tạm dừng                     │  online: "Bàn vẫn tiếp tục"
│  [ ▶ Tiếp tục ]              │
│  [ 🔊 Âm thanh: bật ]        │
│  [ ❓ Cách chơi ]            │
│  [ ⚙  Luật của ván ]         │  read-only; looks (colours, deck) still editable
│  [ ☰ Menu chính ]            │  saves; the game stays "in progress"
│  [ ← Về Tò He ]              │  online: "Rời bàn" (the hub asks, as today)
└──────────────────────────────┘
```

**End of a game:** the results card offers **Chơi lại** and **Menu chính**.

## Per game

| Game | Main menu | Settings on the main menu | In-game menu |
| --- | --- | --- | --- |
| Chạm Chấm (`hello`, 20 s rounds; the minimal game without the kit, so it draws the same screens by hand) | Chơi, 🏆, Cách chơi, Về Tò He | — | Tiếp tục, Âm thanh, Menu chính, Về Tò He |
| Ghép Khối (`merge-block`) | Chơi / Chơi tiếp, Ván mới, ⚙, 🏆, Cách chơi, Về Tò He | Màu khối | + Màu khối (any time) |
| Chạm Ghép (`tap-merge`) | as Ghép Khối | Màu khối | + Màu khối (any time) |
| Tiến Lên (`tien-len`) | Chơi với máy / Chơi tiếp, 🌐 Chơi online, ⚙, Thành tích, Cách chơi, Về Tò He | Luật nhà (H1–H9), số người, mức máy, bộ bài | Luật của ván (read-only), Bộ bài (any time) |

Tiến Lên's catalog card would open the game's main menu instead of the hub's lobby; **Chơi online** leads to the
lobby (rooms, codes, links and sign-in stay hub screens: they need the API), and the lobby gets a way back to the
game's menu. At a table the game opens straight into the table, as today.

## Contract (additive, protocol stays 1)

| Addition | Meaning |
| --- | --- |
| capability `shell` | The game draws its main menu and its in-game menu, with a way back to Tò He. The hub then shows no bar over it. Games without it keep today's bar. |
| host → game `menu` | Open your menu (the player pressed Back). A game on its main menu answers with `exit`. |
| game → host `open` `{ what: 'leaderboard' \| 'rooms' }` | Show the hub's board for this game over it, or go to its lobby. Games still never call the API. |
| game → host `settings` `{ muted }` | The player switched sound in the game; the hub remembers it per device, as its 🔊 does today. |

`exit` (game → host) already exists. SDK: `session.openMenu` handler, `session.open(what)`, `session.setMuted()`.
Conformance, for a `shell` game: it answers `menu` within a second with a visible menu, and a path from that menu
sends `exit`; the main menu meets contrast in every theme.

## Hub

- No bar over a `shell` game; the iframe gets the whole screen (56 px more on a phone).
- **Safety net:** while the game loads, if it fails, throws on start, or does not answer `menu` within 1.5 s, the hub
  shows its own small sheet with **Về Tò He**. A child can always get out.
- Back while the game's menu is already open sends `menu` again; the game closes its menu. A second Back within a
  second on the main menu leaves.
- The leaderboard opens as a sheet over the game (the same data as the 🏆 on catalog cards, which stays).

## Kit

`createShell()` replaces `createLifecycle()` (which it grows from): the main menu, the in-game menu, the end-of-game
card, the ☰ button, Back, pausing, and settings with `when: 'between-games' | 'any-time'`. A game passes its title,
icon, modes, settings cards, how-to card and callbacks (`start`, `continue`, `newGame`, `pause`, `resume`), and
whether it can pause (an online table cannot).

## Plan

1. ADR 0018 accepted, answers to the open questions.
2. Contract + SDK + conformance + hub (bar hidden for `shell`, safety net, Back, leaderboard sheet), kit `createShell`.
3. The four games move to the shell, each a minor version; Tiến Lên's card goes to its main menu.
4. e2e: open → main menu → play → menu → main menu → Về Tò He, for every game; Back on Android.

Old builds keep working with the hub's bar until their game moves.

## Open questions

1. **Main menu every time a game opens** (proposed), or straight into play for the short games (Chạm Chấm)?
2. **Phone Back opens the menu** (proposed), rather than leaving at once?
3. **Leaderboard** from the main menu as a hub sheet over the game (proposed), and keep 🏆 on catalog cards
   (proposed)?
4. **Tiến Lên's card opens its main menu**, with **Chơi online** leading to the hub's lobby (proposed)?
5. **Rules fixed during a game**, looks and sound any time (proposed)? For Tiến Lên: house rules, players and bot level
   are rules; the deck is looks.
6. **Sound moves into the game** (in-game menu and settings), remembered by the hub per device (proposed)?
