---
title: Game shell
description: Every game has two stages — its own menu stage, the only way back to Tò He, and a play stage created on play and destroyed on the way back — with one ☰ over play whose quick panel changes things in place. Built once in the kit; a new game brings only its content.
sidebar:
  order: 8
---

> **Status: built** ([ADR 0018](../decisions/0018-every-game-opens-on-its-own-main-menu.md),
> [ADR 0019](../decisions/0019-game-shell-2-title-screen-hud-and-first-screen.md),
> [ADR 0020](../decisions/0020-a-game-has-a-menu-stage-and-a-play-stage.md)). Every game has it: Chạm Chấm 1.4, Ghép
> Khối 1.8, Chạm Ghép 0.8, Tiến Lên 0.6. Evidence: [Game flow research](../research/game-flow.md).

## Why

Until the shell, a game ran with two sets of controls on the phone: the hub's bar on top and the game's own ⏸ with
its menu. The owner: "vừa exit vừa có nút pause … luồng lu bu lạ quá". Then the title screen was still a layer over a
game already running. Real games do it one way, and so does every Tò He game now:

```
Tò He ──open──▶ MENU STAGE ──▶ Chơi ──▶ PLAY STAGE
 ▲              title, ⚙️ ❓ 🏆 🌐        board + HUD; ☰ / Back / hidden → quick panel
 │                  ▲                      (Tiếp tục · 🔊 · looks · 🔄 · ❓ · 🏠)
 └── ← / Back ──────┤                                │
                    └──────── 🏠 Menu chính / the end of a game ◀───────┘
```

The menu stage runs no engine; the play stage is created on play — its code fetched while the menu is up — and saved
and destroyed on the way back. "Vòng đời này giúp rõ ràng về luồng cho user lẫn hợp lý cho game logic."

## Principles

1. **Two stages.** The menu stage is the game's own first screen and the only way back to Tò He. The play stage only
   plays; its way out is the menu stage, one level up.
2. **One tap to play,** and play starts without a download: the menu stage fetches the play stage in the background.
3. **One button while playing.** ☰ (first in the HUD, always the same place and look) opens the quick panel.
4. **The panel changes things in place.** Sound and the game's looks switch right there, with the game visible
   behind; it is not a second main menu.
5. **Play waits while you are away.** The panel stops what can stop, and so does the hub hiding the game; a game
   against the clock counts 3, 2, 1 before going on. At an online table nothing stops, and the panel says so.
6. **Rules are chosen before a game.** Settings that change how a game plays live in ⚙️ of the menu stage and apply
   from the next game; looks change any time, also from the panel.
7. **Pictures before words, short menus, one level deep** (Apple HIG, menus).
8. **Built once.** The kit owns the stages, their screens, words and look, the HUD and the how-to; a game brings its
   content.
9. **Nobody gets stuck.** The hub keeps a way out for a game that does not load or does not answer.

## Screens

### Menu stage

**Title screen** — the game's own colours (`--tohe-menu-bg`), a few of its emoji drifting behind:

```
┌──────────────────────────────┐
│      ♠                🂡      │
│              ┌─────┐         │
│              │ 🃏  │      ♥  │  the game's picture, gently bobbing
│              └─────┘         │
│           Tiến Lên           │
│  ( Ván đang chơi dở. · 👑 … )│  the game in progress and the best result, when there are
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃      ▶ Chơi tiếp       ┃  │  "▶ Chơi" with nothing in progress (Tiến Lên: "🤖 Chơi với máy"), data-tohe-play
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  [ 🔄 Ván mới ]              │  with a game in progress; asks first
│  [ 🌐 Chơi online ]          │  games with rooms, signed-in profiles: the hub's lobby
│   (🔊)   (⚙️)   (🏆)   (❓)    │  sound · settings · leaderboard (signed-in, games with scores) · how to play
│        ( ← Về Tò He )        │  the last of the buttons: leaves the game (data-tohe-exit)
└──────────────────────────────┘
```

**On a short screen** *(agent)* — a phone held sideways, 320 to 500 px high — the title screen fits the height it gets
instead of running past it: the picture and the name shrink, the buttons tighten and, from 480 px wide, the screen
becomes two columns — the picture and name on the left, **▶ Chơi**, the tools and **← Về Tò He** in one column on the
right — so play, the tools and the way back are always in reach, down to 320 px of height (568×320 is the smallest
checked). Scrolling inside the card stays the last resort. Every game built on the kit gets it; the kit's CSS
(`overlay.css`) does it with height media queries, no game code changes.

**⚙️ Cài đặt** and **❓ Cách chơi** are full screens of the menu stage, `←` in the header (and phone Back) to return:
⚙️ starts with the 🔊 switch, then one section per setting of the game (block colours; Tiến Lên's house rules,
players and level, deck). A section that changes how a game plays says "Đang có ván dở: áp dụng từ ván sau." while
one is in progress.

**How to play, the first time:** the how-to screen with **▶ Bắt đầu** before the first game (`data-tohe-play`);
afterwards it is ❓. Games point at a first move on the board after it (`ctx.firstTime`).

### Play stage

**Loading:** the game's picture and three dots on the page colour, covering the board until its first frame — and
only seen when the stage was not fetched yet or takes a while to draw.

**Playing:** only the game, with the kit's HUD on top: ☰, then the game's numbers (score, its own middle, best).

**Quick panel** (☰, phone Back, Esc, the hub hiding the game):

```
┌──────────────────────────────┐
│           ⏸️ Tạm dừng        │  at a table: "☰ Menu" and "Bàn vẫn tiếp tục khi bạn mở menu."
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃       ▶ Tiếp tục       ┃  │  3, 2, 1 first for a game against the clock
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  🔊 Âm thanh          [ ◯━ ] │  a switch, at once
│  🎨 Màu khối    Hoàng hôn ›  │  the game's looks: opens the list over the panel; a tap repaints the board behind
│  📜 Luật của bàn           ›  │  a table's rules to read (Tiến Lên online)
│   (🔄)      (❓)      (🏠)     │  Ván mới (asks) · Cách chơi · Menu chính (data-tohe-main-menu)
│        Rời bàn               │  only at a table (Rời bàn / Thôi xem) or in a replay (Về sảnh)
└──────────────────────────────┘
```

No way out to Tò He over play: it is on the title screen, one level up. 🏠 saves the game and destroys the play stage;
the title screen then offers ▶ Chơi tiếp.

**End of a game:** its card with **▶ Chơi lại** (a fresh game in place) and **🏠 Menu chính** (a replay: **Xem lại
từ đầu** and **Về sảnh**). A card of the game's own (a hand's results at a table) comes back when the panel over it
closes; so does an end card that arrived while the panel was open.

**Back, step by step:** playing → the panel → playing; a card over the panel → the panel; the end of a game → the
title screen (a replay: the panel); loading → the title screen; a screen of the menu stage → the title screen; the
title screen → Tò He.

## Per game

| Game | Title screen | ⚙️ Cài đặt | Quick panel rows | HUD (start · middle · end) |
| --- | --- | --- | --- | --- |
| Chạm Chấm (`hello`) | ▶ Chơi, 👑 best, 🔊 ⚙️ 🏆 ❓ | sound | sound | score · ⏱ seconds · best; 3-2-1 before a round goes on |
| Ghép Khối (`merge-block`) | ▶ Chơi / Chơi tiếp, Ván mới, 👑 best, 🔊 ⚙️ 🏆 ❓ | sound, 🎨 Màu khối | sound, 🎨 Màu khối › (the presets) | score · next block · best |
| Chạm Ghép (`tap-merge`) | as Ghép Khối | sound, 🎨 Màu khối | sound, 🎨 Màu khối › (the presets) | score · 🔀 · best, the goal row under it |
| Tiến Lên (`tien-len`) | 🤖 Chơi với máy / Chơi tiếp, Bàn mới, 🌐 Chơi online, 🔊 ⚙️ ❓ | sound, 📜 Luật nhà, 🪑 Bàn chơi (from the next hand), 🎴 Bộ bài | sound, 🎴 Bộ bài › (the decks); at a table also 📜 Luật của bàn › | table score · hand number · (😀) sort |

At an online table and in a replay Tiến Lên has no menu stage: it opens straight into play (`direct`), and its panel
keeps the seat's way out. Tiến Lên's catalog card opens the game; **🌐 Chơi online** leads to the hub's lobby, whose ←
goes back to the game.

## Contract

Additive, protocol 1 ([Game Contract v1](../contracts/game-contract-v1.md)):

| Addition | Meaning |
| --- | --- |
| capability `shell` | The game draws its menu stage and in-game panel with a way back to Tò He; the hub draws no bar over it. Games without it keep the bar. |
| `init.shell` `{ leaderboard, rooms }` | What the hub can open for this player now (signed-in profiles; the game keeps scores / has rooms). |
| host → game `menu` | The player pressed Back. |
| game → host `menu` `{ open }` | The game's menu or screen opened or closed: its answer to Back. The first one also says the first screen is up: the hub keeps its loading screen until then. |
| game → host `open` `{ what: 'leaderboard' \| 'rooms' }` | Show the hub's board over the game, or go to the game's lobby. Games still never call the API. |
| game → host `settings` `{ muted }` | The player switched sound in the game. |

Markers conformance looks for: `data-tohe-play` (play, and the first-time how-to's start), `data-tohe-exit` (the way
back to Tò He, on the title screen; at a table or in a replay, in the panel), `data-tohe-menu` (☰),
`data-tohe-main-menu` (🏠 in the panel and on the end card). Conformance, for a `shell` game: the first screen within
8 s of the handshake; the title screen with play and the way out, and no `<canvas>` under it; play, every tool and
the way out wholly inside the screen at 390×844, 360×640, 320×568, 915×412, 667×375 and 568×320 (a screenshot of each,
`<id>-title-<w>x<h>.png`); play through the how-to; Back opens the panel within 1.5 s and Back again closes it; the hub's `pause` opens it; no visible
`[data-tohe-exit]` over play; `[data-tohe-main-menu]` leads to the title screen and leaves no `<canvas>` behind; the
title screen's way out sends `exit`.

## Hub

- **No bar** over a `shell` game: the iframe has the whole screen. The reconnecting notice of a table floats at the
  top instead.
- **Loading:** the game's icon and name, carried on from its catalog card, until the game's first `menu` message —
  its title screen, which now needs no engine, so it comes in about 100 ms after the handshake (at most 8 s, then
  `hub.game.first-screen-late`).
- **Back** is caught by the router (`useBlocker`) and sent to the game as `menu`; leaving goes through the game's
  way out on its title screen, which goes back to the catalog the way the player came
  ([history](game-launch-flow.md#leaving-and-phone-back)). If neither `menu` nor `exit` comes back within 1.5 s, the
  hub's sheet offers **← Về Tò He** or **Chờ thêm**.
- **Leaving from the game** goes at once: a choice made in its menu needs no question. Leaving a table asks, as
  before, unless watching.
- **Leaderboard** opens as a sheet over the game: the same board as *Bảng điểm* under each game on the catalog, which stays.
- **Sound** is remembered per device (`tohe:muted`), whichever game switched it.

## Kit

A game has `app.ts` (what both stages share: the session, words, sounds, the save in memory and `persist()`),
`main.ts` (the menu stage) and `stage.ts` (the play stage). `games/merge-block` is the model.

```ts
// main.ts — the menu stage: no engine imported here
const shell = createShell({
  session, root: app, title: t.title, icon: '🧱', decor: ['🧱', '🟧', '🟨'],
  inProgress: () => (store.game?.moves && !store.game.over ? t.inProgress(score) : null),
  best: () => (store.best ? t.bestLine(best) : null),
  howTo: () => ({ icon: '🧱', title: t.title, content: hintList(t.hints) }),
  tutorial: { seen: () => store.tutorialSeen, done: () => { store.tutorialSeen = true; void persist(); } },
  settings: [{ label: '🎨 Màu khối', when: 'any-time', content: () => choiceList(…) }],
  leaderboard: true,                                    // online: true for a game with rooms; countdown: true if timed
  stage: () => import('./stage.ts'),
});
shell.start();

// stage.ts — the play stage
export async function start(ctx: StageContext): Promise<PlayStage> {
  ctx.root.append(template.content.cloneNode(true));   // <template id="play-stage"> in index.html
  const hud = createHud({ menu: ctx.menuButton(), parent: ctx.root, locale });
  const kit = createGame({ parent: stage, … });         // continue store.game, or a fresh game when ctx.fresh
  … draw the board …; ctx.ready();
  return {
    pause: () => kit.pause(), resume: () => kit.resume(),
    newGame: () => startNewGame(),
    quick: () => [{ kind: 'card', icon: '🎨', label: 'Màu khối', value: 'Hoàng hôn',
      card: () => ({ title: 'Màu khối', content: choiceList(presets, chosen, setPalette) }) }],
    leave() { save(); removeListeners(); kit.destroy(); },
  };
}
```

- `createShell(options)` → `{ start(), playing }`. It owns both stages: the title screen and its screens, entering
  play (`stage()` then `start(ctx)`, a loading view until `ctx.ready()`), the panel, the end card and every Back.
- `StageContext`: `root` (empty, the stage builds in it), `fresh` (🔄 from the title), `firstTime` (after the how-to),
  `menuButton()`, `overlay` (the game's own cards), `gameOver(card, again?)`, `ready()`.
- `PlayStage`: `pause`, `resume`, `newGame` (in place), `leave` (save, then stop everything the stage started: the
  engine, listeners, timers — the shell empties the root), `quick()` (rows: a `switch` applied at once, or a `card`
  with its current `value` that opens over the panel — a `choiceList` that applies as the player taps, or text to
  read — and goes back to it).
- `createHud({ menu, parent, locale })`: ☰ first, then `start`, `center`, `end`; `hud.score({ score, best })` counts
  up and lights up a record; `hud.stat(label, { place, format })` is one number; scores shorten to fit.
- `bump(element)`, `newRunId()`, `choiceList`, `hintList`, `followTheme`; looks in `overlay.css` on the design tokens,
  light and dark, animations off for `prefers-reduced-motion`.

## Tests

| Where | What |
| --- | --- |
| Kit (`shell.test.ts`) | The menu stage (title entries with and without a game in progress, a guest, ⚙️ and ❓ screens, a new game asked first, the first-time how-to); the play stage (loading, playing, the panel without a way out, looks changed in place, 🏠 leaving the stage, the hub hiding the game, 3-2-1, a new game from the panel, a game card brought back, the end and Back from it, an end under the panel, a load that lost the race, a stage that cannot start, an info card); a table; a replay |
| Kit (`kit.test.ts`) | The HUD's count-up and shortened scores, run ids |
| SDK | `init.shell`, `menu` both ways, `open`, `settings`, and refusal without the capability |
| Conformance | The shell checks above, for every `shell` game — the title screen's reach on six screen sizes among them; random input starts from **Chơi** and the how-to |
| Hub | `shell` kept from the API view; the trail of history entries behind a page |
| e2e smoke | Chạm Chấm: the title screen, no bar; how-to, a round, the board over the title screen; Back opens and closes the panel; the hub hiding the game opens it; no way out to Tò He over play; 🏠 then ← Về Tò He back to the catalog's own history entry; Back on the title screen too |
| e2e rooms | Tiến Lên's title → Chơi online → lobby → ← back to the game; leaving a table and stopping watching from ☰ |

## Decisions

- ADR 0018 (2026-10-16): the flow — every game opens on its own menu, Back steps through it, the leaderboard opens
  over the game, Tiến Lên's card opens the game, rules are fixed during a game, sound moves into the game.
- ADR 0019 (2026-10-16): the title screen and picture tools, Back from a game's end to the title, the menu when the
  hub hides the game, the first-time how-to, 3-2-1, the kit's HUD, the hub's loading screen until the first screen.
- ADR 0020 (2026-10-16, the owner: "đúng hãy làm theo hướng như vậy … menu in game là dạng lớp phủ các option phù hợp
  thật sự tiện và có thể update ingame"): two stages, the play stage loaded in the background and freed on the way
  back, the quick panel with in-place rows and no way out to Tò He.
