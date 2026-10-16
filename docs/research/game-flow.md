---
title: Game flow research — menu, play and the in-game menu
description: How casual games separate their main menu from gameplay, what an in-game menu holds, and how pausing, Back and loading behave — the evidence behind ADR 0020.
sidebar:
  order: 4
---

Question (owner, 2026-10-16): *the main menu still looks like an overlay of the game. Make it a screen of its own —
the game's first stage, the only way back to Tò He, with proper screens for its options. Pressing play enters the
game stage, which loads the game and runs it, separate from the menu; there the in-game menu is an overlay with
the options that fit a game in progress — convenient, applied at once, not a copy of the main menu — and its way
out is the main menu, not Tò He. Design it the way ordinary games do.* Decision:
[ADR 0020](../decisions/0020-a-game-has-a-menu-stage-and-a-play-stage.md). Design:
[Game shell](../architecture/game-shell.md).

## What Tò He did before (ADR 0019)

- The game loaded its engine (Phaser, about 1.4 MB of JavaScript, 380 KB gzip) and drew its board first; the title
  screen was a blurred DOM layer over that board. Menu and play shared one page and one lifetime: the engine ran
  from opening to leaving, also while the player only sat in the menu.
- The in-game menu repeated most of the main menu (sound, settings, how to play) behind buttons that opened further
  cards, and held a second way out to Tò He.

## What the guidance says

| Source | Finding | What it means here |
| --- | --- | --- |
| Apple HIG, [Loading](https://developer.apple.com/design/human-interface-guidelines/loading) | "Show something as soon as possible"; "Let people do other things … while they wait for content to load … a game could load content in the background while players … view an in-game menu"; "For games, consider creating a custom loading view." | The main menu must not wait for the engine: show it at once and fetch the play stage in the background while the player looks at it. If play is entered before that is done, a short loading view in the game's style. |
| Apple HIG, [Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking) | "Pause activities that require people's attention or active participation when they switch away … When they switch back, let them continue as if they never left." | Hiding the game opens its in-game menu (ADR 0019 already does); the stage keeps its state. |
| Apple HIG, [Menus › In-game menus](https://developer.apple.com/design/human-interface-guidelines/menus) | Important items first; "be mindful of menu length"; submenus sparingly, one level; toggled items show their state (a changeable label, a checkmark); a row of three or four picture items above the list. | The in-game menu: Resume first, then a few switches and choices that apply where they are, then the rarer actions. Settings that need more room live in the main menu, one level deep. |
| Apple HIG, [Designing for games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games) | "Teach through play … offer [a written tutorial] as a resource … instead of making it a prerequisite"; buttons at least 44 × 44 pt; menus legible on every aspect ratio. | Keep the first-time how-to one card, then hints on the board; ❓ stays reachable. Keep 44 px targets. |
| Android Developers Blog, [More Android games that play nice](https://android-developers.googleblog.com/2011/12/more-android-games-that-play-nice.html) (2011) | Back "should return to the previous screen … in the game hierarchy"; during play it is customary to ask before leaving; at the main menu the game decides; Home is not an exit — save and restore. | Back steps up one level: play → in-game menu → (resume); main menu → Tò He. Leaving play goes through the main menu, so no question is needed: the game is saved. |
| Practitioners (Unity forums: [scene management](https://discussions.unity.com/t/what-is-the-best-practice-for-scene-management-for-a-serious-project-how-do-commercial-games-set-it-up/341989), [menu vs gameplay](https://discussions.unity.com/t/i-still-cant-understand-the-logic-behind-switching-scenes-between-the-gameplay-scene-and-main-menu/768662)) | A menu with no dependency on gameplay is its own scene "to avoid loading unnecessary stuff into memory"; the pause menu is a panel shown over the running game scene, which is destroyed on leaving it. | Two stages: the menu stage owns no engine; the play stage is created on play and destroyed when the player goes back to the menu. The in-game menu is an overlay of the play stage. |
| Casual puzzle games (Block Blast, as described by [Playgama](https://playgama.com/blog/game-faqs/how-do-i-enable-or-disable-sound-in-block-blast/), third party) | Settings behind a gear on the main menu, each an on/off toggle that applies instantly; a quick mute during play without leaving it. | Sound as a switch in the in-game menu; the game's looks (block colours, the deck) as choices that repaint the board behind the menu at once. |

Gaps: Apple's games page gives no pause wording of its own beyond multitasking; the Android guidance is old but
still how Back works in games; the casual-game examples are third-party descriptions, not specifications.

## Conclusions

1. **Two stages per game.** The *menu stage* is the game's own first screen — designed, not an overlay — with the
   title, play, the game's options as full screens, the leaderboard and online play, and the only way back to Tò He.
   The *play stage* is created when the player presses play: it loads the engine, builds the board and HUD, and is
   destroyed (saved first) when the player goes back to the menu.
2. **Load in the background.** The menu shows at once; the play stage's code is fetched while the player is on the
   menu, so pressing play starts the engine without a download. A short loading view in the game's style covers the
   rare case where it is not there yet, and the board until its first frame.
3. **The in-game menu is a quick panel over the game**, not a second main menu: ▶ Tiếp tục first; live switches and
   choices (sound, the game's looks) applied in place; then 🔄 Ván mới (asks), ❓ Cách chơi, ☰ Menu chính. No way out to
   Tò He: that is one level up, in the main menu. At an online table or in a replay there is no main menu, so their
   menu keeps the seat's way out.
4. **Back steps one level:** play → in-game menu → play; a screen of the menu → the menu; the menu → Tò He.
5. **Settings live in the main menu**, one level deep, each as a section of one screen; the rules of a game are
   chosen there and apply from the next game; looks also change during play from the in-game menu.
