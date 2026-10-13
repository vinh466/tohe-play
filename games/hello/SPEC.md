# Chạm Chấm (`hello`) — spec

Reference game for the platform: the smallest game that uses every part of the Game Contract.

## Rules

- A round lasts **20 seconds**.
- One orange dot is on the square playfield at a time. Tapping inside it scores **1 point** and moves the dot to
  a new random position (from the session seed).
- The dot shrinks as the score grows: radius = max(0.05, 0.12 − 0.003 × score) of the playfield side.
- Missed taps do nothing.
- When time runs out the round ends: show the score and the best score, with **Chơi lại** (play again) and
  **Thoát** (exit).

## Screens

1. Intro overlay: title, one-line explanation, **Chơi**.
2. Playing: HUD `N điểm · Ts`, progress bar, playfield.
3. Paused overlay (hub sent `pause`): **Tiếp tục**. Time does not run while paused.
4. Game over overlay.

## Contract usage

| Capability | Use |
| --- | --- |
| `save` | `{ best: number }` after every round. |
| `scores` | `submitScore(score)` after every round, board `default`. |
| settings | Respects `muted` (beep on hit). |
| seed | Dot positions. |

## Invariants (tested by the random-play bot)

- The dot is always fully inside the playfield.
- Score is a finite, non-negative integer; time left is never negative.
- Every round ends after 20 s of play time.
