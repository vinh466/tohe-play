# Chạm Chấm (`hello`) — spec

Reference game for the platform: the smallest game that uses every part of the Game Contract.

## Rules

- A round lasts **20 seconds**.
- One orange dot is on the square playfield at a time. Tapping inside it scores **1 point** and moves the dot to
  a new random position (from the session seed).
- The dot shrinks as the score grows: radius = max(0.05, 0.12 − 0.003 × score) of the playfield side.
- Missed taps do nothing.
- When time runs out the round ends: show the score and the best score, with **Chơi lại** (play again) and
  **☰ Menu chính**.

## Screens

The kit's game shell and HUD ([Game shell](../../docs/architecture/game-shell.md), ADR 0019), with no engine: the
smallest game shows that a Canvas 2D game gets the same screens as every other one by bringing only its content.

1. **Title screen:** 🟠 **Chạm Chấm**, **▶ Chơi**, tools 🔊 ⚙️ 🏆 (signed-in players: the hub's board over the game)
   ❓, **← Về Tò He** in the corner.
2. **How to play** (before the first round only, then from ❓): one card — tap the dot as often as you can in 20
   seconds; it shrinks as you score; missed taps cost nothing. **▶ Bắt đầu** starts the round.
3. **Playing:** the kit's HUD — ☰, score, seconds left (⏱, glowing for the last five), best; the progress bar and
   the playfield.
4. **Menu** (☰, phone Back, Esc, or the hub hiding the game): **▶ Tiếp tục**, **🔄 Ván mới**, **☰ Menu chính**, tools
   🔊 ⚙️ ❓, **← Về Tò He**. Time does not run while it is open; **Tiếp tục** counts 3, 2, 1 first.
5. **Round over:** "Hết giờ!" (or "Kỷ lục mới!"), score and best, **▶ Chơi lại**, **☰ Menu chính**; Back goes to the
   title screen.

## Sounds

The kit's synthesised sounds: a pop on every hit, rising with the score; a fanfare for a record.

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013). The page and the cards use the design
tokens; the canvas reads the same tokens (`soft` arena, `brand` dot, `accent` score) after every theme change.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | `{ best, tutorialSeen }` after every round and once the how-to is seen. |
| `scores` | `submitScore(score)` after every round, board `default`. |
| settings | Respects `muted`; follows `theme`. |
| seed | Dot positions. |

## Invariants (tested by the random-play bot)

- The dot is always fully inside the playfield.
- Score is a finite, non-negative integer; time left is never negative.
- Every round ends after 20 s of play time.
