# D-05 — Daily challenge and sharing

**Status:** decided — owner approved the recommended option on 2026-11-08 ("ok tốt nha, làm đi") · **Kind:** decision · **Blocked by:** D-03

## Question

How does a daily puzzle give a reason to return without becoming an obligation or a fairness problem?

## Options

### A — Local-first daily (recommended)

- Seed = `session.seed` (`YYYYMMDD`), the same board and goals for everyone on that date.
- 3 goals; one **scored** attempt per day; practice allowed without changing the stamp.
- A **calendar** of stamps; a missed day never removes a stamp or breaks a streak.
- A result card: date, stars, goals; share a challenge link with the same seed (the existing `entries/share`
  pattern). The recipient plays the same board as a challenge, not a global leaderboard.
- No account needed; no server change in V1–V3.

**Cost:** the date is local and the clock can be changed; no official daily ranking. That is acceptable for a
calm game; the stamp is personal.

### B — Platform daily board now (PB-06)

- A server daily seed and a daily board, one score per profile, a card on the shelf.
- Fair and social, but needs an ADR, API, hub UI and a separate board per game; much slower. It also mixes with
  the integrity model and public boards.

### C — No daily; journey only

- Simpler, but loses the gentle return loop and the Wordle-like share that fits Tò He.

## Recommendation

**A** for V3; **B** in V4 if the daily is used and the platform wants a shared board. The daily is a **calendar**,
not a streak: no loss, no freeze, no purchase.

## Rules

- The daily uses the fixed core rules and the full piece bag; no journey unlocks change it.
- The first scored attempt is the stamp; later attempts show "Đã đóng dấu hôm nay" and are for practice.
- The share payload is `{ v: 1, kind: 'daily', seed, score, stars }`; the game opens it as a challenge in its
  own save slot, never as a ranked run.
- No notification outside the game; the card is on the title screen when the player opens it.

## Evidence

- Daily challenge/calendar patterns: [R-01](../research/R-01-block-puzzle-market.md).
- Wordle-like once-a-day, no pressure: [R-02](../research/R-02-ux-and-retention.md).
- `session.seed` is already the daily seed; `entries/share` already exists:
  [R-03](../research/R-03-platform-and-reuse.md).
- PB-06 is the platform version, still an idea: `docs/roadmap/product-backlog.md`.

## Discussion

**agent (2026-11-08):** recommend A. A local daily is honest: no fake global ranking, no server work, and it
still gives the appointment and the share. The platform board can come when the daily proves itself.
