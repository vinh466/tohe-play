# D-05 — The Daily Shift and its board

Status: open (blocked by D-01, D-12). Kind: decision.

## Question

What is the daily mode: how is its seed derived, what does the player compare, what is shared, and
is there a server board (and its timezone/contract)?

## Options

1. **Local date seed, local score/streak, share** (recommended for 2.2): the stage derives a seed
   from the local date (`YYYY-MM-DD` → a 32-bit seed); everyone who opens the game that local day
   gets the same blocks; the score/best/streak live in the save; the share is a `v: 3` entry/score
   card; no server board. Cheap, honest, offline.
2. **Local seed + the default leaderboard**: the score goes to the game's existing board as a normal
   score; the daily entries mix with the classic's, so the board is not "today's" and the classic
   ranking is muddied. Not recommended.
3. **Server daily board**: a board id/period per day, a timezone rule (UTC or the server's day), an
   API/board slice, an integrity/anti-cheat story (the seed + the moves + the verify). The real
   daily competition; a larger, T3 change (contract/API/ADR).
4. **No daily**: the Orders/Workshop only.

## Recommendation

1 for 2.2, with the door open to 3 in a later plan if the family asks and the contract/API slice is
worth it. The daily:
- **Seed**: the local date at the title/stage start (the logic stays pure; the date string is
  passed in; no `Date.now` in `logic.ts`); the same date → the same seed; a `daily` save slot with
  the date, seed, score, streak, last day.
- **Score**: the run's score; a **streak** for consecutive local days played; the best today; the
  last 7 days as a row (not a calendar grid).
- **Share**: a `v: 3` card ("Ca ngày 08/11: mình được 1.240, bạn vượt được không?"), opening a
  same-seed challenge; the date shown as the sender's local date, a claim, not a server truth.
- **UI**: the title's "Ca hôm nay" card with the date/stamp, the streak, the best, the "Chơi" and
  the "Chia sẻ"; the game over shows the date/streak; no countdown, no "streak lost" pressure.
- **Unranked**, clearly labelled; the classic stays the ranked mode.

## Cost and risks

The date→seed rule, the save slot, the daily card, the streak, the share `v: 3`, the tests. The risks:
the local date can be changed by the device (acceptable for a family ritual; the board is local);
the timezone (use the device's local date; the share shows the sender's date); the child (no
pressure; the streak is a memory, not a debt); the server board is deliberately out of the slice.

## What would change my mind

- The family wants a real competition: 3, with an ADR/API slice; the daily then becomes a ranked
  mode with a day board and a timezone rule.
- The daily without a board feels pointless in the playtest: add the local "family today" board
  (the household leaderboard for the day) before the server board.
- The daily is the first slice (D-01 B): ship 1 with the title card and no Orders.
