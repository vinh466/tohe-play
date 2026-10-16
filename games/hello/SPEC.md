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

The game shell ([ADR 0018](../../docs/decisions/0018-every-game-opens-on-its-own-main-menu.md)), drawn by hand: this
is the minimal game without the kit, so it shows what any game must do (`data-tohe-play`, `data-tohe-exit`, `menu`).

1. **Main menu:** title, one-line explanation (the how-to), **▶ Chơi**, **🏆 Bảng xếp hạng** (signed-in players: the
   hub's board over the game), **← Về Tò He**.
2. **Playing:** ☰ top left, HUD `N điểm · Ts`, progress bar, playfield.
3. **Menu** (☰, phone Back, Esc, or the hub's `pause`): **▶ Tiếp tục**, **🔊 Âm thanh**, **☰ Menu chính**,
   **← Về Tò He**. Time does not run while it is open.
4. **Round over:** score and best, **Chơi lại**, **☰ Menu chính**.

Back steps back: the menu closes, the round's end goes to the main menu, the main menu leaves.

## Themes

Light and dark, following the hub (`"themes": ["light", "dark"]`, ADR 0013). The page and the cards use the design
tokens; the canvas reads the same tokens (`soft` arena, `brand` dot, `accent` score) after every theme change.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | `{ best: number }` after every round. |
| `scores` | `submitScore(score)` after every round, board `default`. |
| settings | Respects `muted` (beep on hit); follows `theme`. |
| seed | Dot positions. |

## Invariants (tested by the random-play bot)

- The dot is always fully inside the playfield.
- Score is a finite, non-negative integer; time left is never negative.
- Every round ends after 20 s of play time.
