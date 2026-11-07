# R-04 — Run-length simulation

A throwaway simulation of the core 8 × 8 rules to estimate how long a run lasts and which piece weights are
worth testing. This is **not** game code and not a substitute for a human playtest.

## Method

- Board 8 × 8, tray 3, no rotation. Shape set: 1 × 1, dominoes, trominoes, 2 × 2, four small L, 1 × 4 / 4 × 1,
  1 × 5 / 5 × 1, 3 × 3, four big L, four T, two S, two Z (27 shapes).
- A move: choose a piece and a legal placement; score +1/cell; clear full rows/columns; clear score
  `10 × n² × combo`; combo starts at 1, rises by 1 on a clear and caps at 8; a non-clear resets it (hard) or
  lowers it by 1 (soft). Perfect clear +300. Helpful draw guarantees one fitting piece when any shape fits.
- Two players: **random** (a lower bound, like a young child) and **greedy** (maximise immediate score, then
  fewer holes; a rough upper bound).
- Four piece-weight profiles: `legacy` (many large pieces), `gentle` (small pieces dominate early), `nolarge`
  (no 5-cell/3 × 3), `blockblastish` (small early, large later).
- 400 games per profile/player, seeded. Cap 20,000 moves; no game hit the cap.

## Results

| Profile / player | Median moves | p10–p90 moves | Median score | p90 score | Max moves |
|---|---:|---:|---:|---:|---:|
| legacy / random | 14 | 11–26 | 58 | 157 | 46 |
| legacy / greedy | 65 | 29–152 | 555 | 1,455 | 329 |
| gentle / random | 17 | 13–29 | 64 | 174 | 53 |
| **gentle / greedy** | **104** | **38–229** | **865** | **2,102** | **410** |
| nolarge / random | 17 | 11–26 | 64 | 156 | 41 |
| nolarge / greedy | 83 | 32–232 | 716 | 2,208 | 494 |
| blockblastish / random | 16 | 11–26 | 61 | 167 | 44 |
| blockblastish / greedy | 64 | 29–145 | 540 | 1,337 | 314 |

## Interpretation

- **A random player ends in ~15 moves** on every profile. That is a lower bound, not a target: a child who places
  randomly will fill the board. The tap-to-place ghost, the dimmed unusable pieces, the hint and the journey's
  easy levels are what make the first minutes kind.
- **A greedy player lasts ~65–104 moves**, roughly 2–6 minutes at 2–4 seconds per move. That is the right order
  for a casual run. The `gentle` bag is the best balance: more small pieces early, large pieces later.
- **The hard vs soft combo barely changes the score** in this bot (it rarely chains clears). The choice is
  therefore a **feel** choice, not a balance one: soft decay is more forgiving and readable for a child; hard
  reset is a sharper mastery test. This plan recommends soft decay, with a visible meter. [D-02](../items/D-02-core-loop.md)
- **Perfect clears are rare**: at most 1 in 400 greedy games. A 300 bonus is a rare, special moment, not a
  scoring engine.
- **A 5-cell/3 × 3-heavy bag shortens the run** and makes the early game feel unfair. The bag should be weighted
  toward small pieces and introduce large ones gradually; a tray should not contain more than one very large
  piece early.
- **Journey levels need a move/goal cap**, not endless play: a 1–3 minute level is ~20–50 moves. Goals such as
  "clear 8 lines", "2-line clear", "perfect clear", "score 500" fit that window.
- **Ranked endless needs a move cap**: the greedy p90 is 229 moves and the max 494; a human planner could go
  longer. A `maxMoves` of 2,000 leaves room, but the bot must be simulated on the final rules before declaring
  `ranked` in `game.json`. [E-03](../items/E-03-save-ranked-daily.md)

## Caveats

- The random bot is not a child; it never plans. The greedy bot is not a good human; it has no lookahead.
- Shapes and weights are approximations of the spec, not the final content.
- The simulation does not model level goals, board masks, undo/rescue, or the journey's smaller piece sets.
- The session length estimate assumes 2–4 seconds per move; real play varies.
- The script is a throwaway in `/tmp/opencode/fill-blocks-sim2.mjs`, not committed. If the plan graduates, a
  proper `simulate` command belongs in the game (E-02).

## Recommendation

1. Use a **gentle weighted bag**: small pieces dominate early; large pieces appear as score grows; at most one
   very large piece per early tray.
2. Keep **8 × 8**; it gives a readable phone board and runs in the right range.
3. Use **soft combo** (recommended) and teach it with a visible meter; test hard reset in the first playtest.
4. Put **move/goal limits** on journey levels; keep endless uncapped.
5. Simulate the final rules before adding `ranked`; if runs exceed `maxMoves`, ship unranked only.
