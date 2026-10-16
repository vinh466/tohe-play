---
title: Game shell
description: Every game opens on its own title screen, plays under one ☰ button whose menu pauses it and holds the way out, and gets its HUD, how-to and end card from the kit — a new game brings only its content.
sidebar:
  order: 8
---

> **Status: built** ([ADR 0018](../decisions/0018-every-game-opens-on-its-own-main-menu.md), screens of
> [ADR 0019](../decisions/0019-game-shell-2-title-screen-hud-and-first-screen.md)). Every game has it: Chạm Chấm
> 1.3, Ghép Khối 1.7, Chạm Ghép 0.7, Tiến Lên 0.5.

## Why

Until the shell, a game ran with two sets of controls on the phone: the hub's bar on top (**← Thoát / Về sảnh / Rời
phòng**, the game's name, 🔊) and the game's own **⏸** with its menu. The owner's words: "vừa exit vừa có nút pause …
luồng lu bu lạ quá". Each game also started differently. Real games do it one way: **open → title screen → play →
in-game menu → back to the title screen → leave**. Built once in `@tohe/game-kit`, every Tò He game gets the same
shape — and since ADR 0019 the same title screen, HUD, pause and how-to — and a new game only brings its content.

## Principles

1. **One button while playing.** The game's ☰ (first in the HUD, always the same place and look) opens its menu;
   leaving is one of its entries. The hub draws nothing over a game with the shell.
2. **Every game opens on its title screen,** one tap from play: the big button is **▶ Chơi** (or **▶ Chơi tiếp**
   with a game in progress).
3. **Play waits while you are away.** The menu stops what can stop (timers, bots, animations), and so does the hub
   hiding the game (another app, a locked phone): you come back to the menu, not to a game that went on. A game
   against the clock counts 3, 2, 1 before it goes on. At an online table nothing stops, and the menu says so.
4. **Rules are chosen before a game; looks any time.** A setting that changes how a game plays is changed from the
   title screen and read-only from the in-game menu ("Đổi ở menu chính, áp dụng từ ván sau."). Sound, colours and
   the deck change any time.
5. **Pictures before words.** Secondary choices are round picture tools with a caption (🔊 ⚙️ 🏆 ❓), so a child who
   cannot read yet finds them; the screens a child must read stay short.
6. **Built once.** The kit owns the screens, their order, words and look, the HUD and the how-to; a game says what it
   has.
7. **Nobody gets stuck.** The hub keeps a way out for a game that does not load or does not answer.

## Screens

**Title screen**, the whole screen over the game's own art (the board, the felt), faintly visible behind:

```
┌──────────────────────────────┐
│ (← Về Tò He)                 │  corner: leaves the game
│                              │
│           ┌─────┐            │
│           │ 🃏  │            │  the game's picture, gently bobbing
│           └─────┘            │
│          Tiến Lên            │
│      ( Ván đang chơi dở. )   │  chip: the game in progress, when there is one
│                              │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃      ▶ Chơi tiếp       ┃  │  "▶ Chơi" with nothing in progress (Tiến Lên: "🤖 Chơi với máy")
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  [ 🔄 Ván mới ]              │  only with a game in progress; asks first
│  [ 🌐 Chơi online ]          │  games with rooms, signed-in profiles: the hub's lobby
│                              │
│   (🔊)   (⚙️)   (🏆)   (❓)    │  sound · settings · leaderboard (games with scores,
│  Âm thanh Cài đặt Xếp hạng Cách chơi   signed-in profiles: the hub's board) · how to play
└──────────────────────────────┘
```

**How to play, the first time:** the game's how-to card with **▶ Bắt đầu** before its first game; afterwards it is
❓. The game remembers it in its save (`tutorial: { seen, done }`).

**Playing:** only the game, with the kit's HUD on top: ☰, then the game's numbers (score, its own middle, best).
Phone **Back** (Android, the browser's) and **Esc** do what ☰ does.

**In-game menu:**

```
┌──────────────────────────────┐
│           ⏸️ Tạm dừng        │  at a table: "☰ Menu" and "Bàn vẫn tiếp tục khi bạn mở menu."
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃       ▶ Tiếp tục       ┃  │  3, 2, 1 first for a game against the clock
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  [ 🔄 Ván mới ]              │  asks first (not at a table or in a replay)
│  [ ☰ Menu chính ]            │  the game stays in progress ("Chơi tiếp")
│     (🔊)    (⚙️)    (❓)      │  rules read-only in ⚙️, looks editable
│        ← Về Tò He            │  quiet; at a table "Rời bàn" (the hub asks), watching "Thôi xem", a replay "Về sảnh"
└──────────────────────────────┘
```

**End of a game:** its card with **▶ Chơi lại** and **☰ Menu chính** (a replay: **Xem lại từ đầu** and **Về
sảnh**). A card of the game's own (a hand's results at a table) comes back when the menu over it closes; so does an
end card that arrived while the menu was open.

**Back, step by step:** playing → the menu; the menu → playing; a card opened from a menu → that menu; the how-to →
the title screen; the end of a game → the title screen (a replay: the menu); the title screen → Tò He.

## Per game

| Game | Title screen | Settings | HUD (start · middle · end) | Notes |
| --- | --- | --- | --- | --- |
| Chạm Chấm (`hello`) | ▶ Chơi, 🔊 ⚙️ 🏆 ❓ | — | score · ⏱ seconds · best | Canvas 2D, no engine, on the kit's engine-free parts; 3-2-1 before a round goes on. |
| Ghép Khối (`merge-block`) | ▶ Chơi / Chơi tiếp, Ván mới, 🔊 ⚙️ 🏆 ❓ | Màu khối (any time) | score · next block · best | The first move shows a hint after the how-to. |
| Chạm Ghép (`tap-merge`) | as Ghép Khối | Màu khối (any time) | score · 🔀 · best | The goal row sits under the HUD. |
| Tiến Lên (`tien-len`) | 🤖 Chơi với máy / Chơi tiếp, Bàn mới, 🌐 Chơi online, 🔊 ⚙️ ❓ | Luật nhà, Bàn chơi (between hands); Bộ bài (any time) | table score · hand number · (😀) sort | At a table and in a replay there is no title screen: the game opens straight in, and its menu holds Luật của bàn, Bộ bài and the way out. A hand's results against bots are the shell's end card. |

Tiến Lên's catalog card opens the game; **🌐 Chơi online** leads to the hub's lobby, whose ← goes back to the game.

## Contract

Additive, protocol 1 ([Game Contract v1](../contracts/game-contract-v1.md)):

| Addition | Meaning |
| --- | --- |
| capability `shell` | The game draws its title screen and in-game menu with a way back to Tò He; the hub draws no bar over it. Games without it keep the bar. |
| `init.shell` `{ leaderboard, rooms }` | What the hub can open for this player now (signed-in profiles; the game keeps scores / has rooms). |
| host → game `menu` | The player pressed Back. |
| game → host `menu` `{ open }` | The game's menu opened or closed: its answer to Back. **The first one also says the first screen is up** (ADR 0019): the hub keeps its loading screen until then. |
| game → host `open` `{ what: 'leaderboard' \| 'rooms' }` | Show the hub's board over the game, or go to the game's lobby. Games still never call the API. |
| game → host `settings` `{ muted }` | The player switched sound in the game. |

SDK 0.7.0: `session.on('menu', …)` and `session.shell` (`can`, `menuChanged`, `open`, `setMuted`). Conformance, for a
`shell` game: it reports its first screen within 8 s of the handshake; it opens on a title screen with
`[data-tohe-play]` and `[data-tohe-exit]`; it plays from there (through the first-time how-to, whose start button is
`[data-tohe-play]` too); it answers `menu` with `menu { open: true }` within 1.5 s and closes the menu on the next
`menu`; the hub's `pause` opens the menu; and its menu's `[data-tohe-exit]` sends `exit`.

## Hub

- **No bar** over a `shell` game: the iframe has the whole screen. The reconnecting notice of a table floats at the
  top instead.
- **Loading:** the game's icon and name, carried on from its catalog card, with three bouncing dots. For a `shell`
  game it stays until the game's first `menu` message — its title screen, or play when opened directly — so the
  player never sees a half-drawn game; after 8 s it lifts anyway and counts `hub.game.first-screen-late`
  (telemetry also measures `hub.game.first-screen-ms`). Meanwhile the hub shows its own **← Về Tò He**.
- **Back** is caught by the router (`useBlocker`) and sent to the game as `menu`; leaving goes through the game's
  own way out, which goes back to the catalog the way the player came ([history](game-launch-flow.md#leaving-and-phone-back)),
  so Back on the catalog then leaves Tò He. If neither `menu` nor `exit` comes back within 1.5 s, the hub's sheet
  offers **← Về Tò He** or **Chờ thêm**.
- **Leaving from the game's menu** goes at once: a choice made in a menu needs no question. (The hub's bar still asks:
  a stray tap near the top edge can land on it.) Leaving a table asks, as before, unless watching.
- **Leaderboard** opens as a sheet over the game: the same board as 🏆 on catalog cards, which stays.
- **Sound** is remembered per device (`tohe:muted`), whichever game or bar switched it.

## Kit

A game brings its content; the kit does the rest. In `main.ts`:

```ts
const shell = createShell({
  session, root: app, title: t.title, icon: '🧱',
  inProgress: () => (state.moves > 0 && !state.over ? t.inProgress(score) : null),
  play: () => { if (state.over) startNewGame(); },   // continue, or start when there is nothing to continue
  newGame: () => startNewGame(),
  howTo: () => ({ icon: '🧱', title: t.title, content: hintList(t.hints) }),
  tutorial: { seen: () => tutorialSeen, done: () => { tutorialSeen = true; void persist(); } },
  settings: [{ label: t.colours, when: 'any-time', card: () => ({ title: t.colours, content: picker() }) }],
  leaderboard: true,                                  // online: true for a game with rooms
  onPause: () => kit.pause(), onResume: () => kit.resume(),
  // countdown: true for a game against the clock; direct: { exitLabel, goesOn } at a table or in a replay
});
const hud = createHud({ shell, parent: app, locale: session.locale });
const scores = hud.score({ score: t.score, best: t.best });   // or hud.stat(label, { format }) for one number
hud.center.append(myOwnThing);                                // the next block, 🔀, the clock…
// … draw the board, then:
shell.start();
```

- `createShell(options)` returns `overlay` (for the game's own cards, brought back after a menu), `playing`,
  `start()`, `mainMenu()` (the title screen), `menu()`, `menuButton()` (☰; the HUD places it) and
  `gameOver(card, again?)`. Settings declare `when: 'between-games' | 'any-time'` and draw a read-only card when
  asked. The shell answers the hub's `menu` (Back) and `pause` itself; a game does not wire them.
- `createHud({ shell, parent, locale })` puts the HUD first in `parent`: ☰, then `start`, `center`, `end`.
  `hud.score({ score, best })` returns `set(score, animate?)` (counts up, pops the box) and `setBest(best)`; the
  best box follows a score that passes it and lights up 👑. `hud.stat(label, { place, format })` is one number.
  Scores are shortened ("56,4M") when they do not fit their box.
- `bump(element)` pops any element (a button, the next block); `newRunId()` makes a leaderboard run id.
- Looks: `overlay.css` on the design tokens, light and dark; animations stop for `prefers-reduced-motion`.

## Tests

| Where | What |
| --- | --- |
| Kit (`shell.test.ts`) | Waiting for `start()`; the title screen's entries (with and without a game in progress, a guest); play / pause / resume and every step of Back; the hub hiding the game; 3-2-1 (and Back during it); the first-time how-to; a game card brought back; rules read-only during a game; sound; a new game from the menu; the end of a game and Back from it; an end that came while the menu was open; a table; a replay |
| Kit (`kit.test.ts`) | The HUD's count-up and shortened scores, run ids |
| SDK | `init.shell`, `menu` both ways, `open`, `settings`, and refusal without the capability |
| Conformance | The shell checks above, for every `shell` game; random input starts from **Chơi** and the how-to |
| Hub | `shell` kept from the API view; the trail of history entries behind a page |
| e2e smoke | Chạm Chấm: the loading screen gives way to its title screen, no bar; how-to, a round, the board over the game; Back opens and closes the menu; the hub hiding the game opens it; leaving returns to the catalog's own history entry |
| e2e rooms | Tiến Lên's title screen → Chơi online → lobby → ← back to the game; leaving a table and stopping watching from ☰ |

## Decisions

ADR 0018 (2026-10-16): the flow — every game opens on its own menu, Back steps through it and leaves only from the
title, the leaderboard opens over the game, Tiến Lên's card opens the game, rules are fixed during a game, sound
moves into the game. ADR 0019 (2026-10-16, the owner agreed to the whole review's proposal): the title screen and
picture tools, a new game in the menu, Back from a game's end to the title, the menu when the hub hides the game,
the first-time how-to, 3-2-1 for timed games, the kit's HUD, and the hub's loading screen until the first screen.
