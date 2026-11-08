# R-01 — The block-puzzle market

What the proven games do, what makes them last, and what Tò He should copy or refuse. Facts are from public
pages and community guides; where a number is not official it is marked. **Inference** is marked separately.

## Method and caveat

A scout read store pages, support pages, press coverage and community guides for Block Blast, 1010!, Woodoku,
Blockudoku and Block Heads. Store reviews are self-selected; community scoring formulas are not official; retention
figures differ by source. Treat the numbers as orders of magnitude, not truth.

## The games

| Game | Core | Meta | Scale / note |
|---|---|---|---|
| **Block Blast!** (Hungry Studio) | 8 × 8, tray 3, no rotation, full row/column clears; Classic + Adventure (~96 levels, 1–3 stars) | Daily puzzle, events, gems/skins; no battle pass, no remove-ads purchase; one revive/session (ad) | 70M DAU / 300M MAU (1/2026), 870M downloads; ads are the revenue (~$127M/5 months) |
| **1010!** (Gram Games) | 10 × 10, tray 3, 19 fixed shapes, no timer | Classic endless; Adventure (2026), Weekly Challenge, daily puzzle, mini-games | 10M+ Android; Zynga bought Gram for $250M (2018); ads after runs |
| **Woodoku** (Tripledot) | 9 × 9 with 3 × 3 boxes; clears row/column/box; tray 3, no rotation | Weekly Journey (Sat–Fri), weekly League (6 tiers), Daily Challenge (1/3/10/24), gems | 100M+ downloads; ad-gated booster; ads before/after runs |
| **Blockudoku** (Easybrain) | 9 × 9 sudoku board; clears row/column/3 × 3 box; tray 3, no rotation | Daily Challenge trophy, seasonal event postcards, tournament + leaderboard | 100M+ Android; ads, one-time remove-ads purchase |
| **Block Heads** (Bombay Play) | 1v1 real-time, 1-minute rounds, tetrominoes on a sudoku grid, boosters | Trophy → arena | 1M+ Android; ads/boosters criticised as pay-to-win |

## Core-loop findings

- **Small board, 3 pieces, no rotation** is the common spine. The order of the three pieces is the main puzzle:
  it rewards planning, not reflexes. Rotation adds input complexity and is deliberately absent in all four.
- **Non-linear scoring** creates the skill ceiling: Block Blast (community) uses 1/cell + 10 × lines² with a
  combo ×1…×8; 1010! uses 5r(r+1) for r lines (10/30/60/100/150…). A single move can feel huge.
- **Combo/streak + perfect clear** are the drama. The exact formulas differ; the important thing is that a
  planned multi-line clear is visibly worth more than three small clears.
- **No timer, no energy** in the pure mode. A run ends because the board jams, not because a clock ran out. That
  is why "one more game" works: the player believes the loss was their decision.
- **RNG must feel fair.** Community guides disagree on the exact shape set; players accuse Block Blast of
  "rigged" draws when they are near a high score. A visible fairness rule (weighted bag, helpful draw) matters
  more than the exact weights.
- **A short run is fine.** Mobile sessions are commonly 3–6 minutes; Block Blast's average session is reported
  around 12 minutes, but that is an outlier. A 1–5 minute run with instant restart fits Tò He better.

## Meta and progression findings

- **Adventure/level maps** (Block Blast ~96 levels, 1010! Adventure) turn a score chase into curated mastery:
  fixed goals, 1–3 stars, a next node. They are the strongest "long progression" pattern in the genre.
- **Daily challenge** is the appointment mechanic: one board a day, same for everyone, a calendar/trophy. It
  works without pressure when missing a day costs nothing (Wordle-like). Woodoku's move from 10 to 14 daily
  diamonds shows how a gentle daily can become a chore.
- **Weekly Journey/League** (Woodoku) creates a return rhythm but also a timer and promotion/relegation pressure.
  Tò He should take the **rhythm**, not the **timer**.
- **Seasonal collections** (Blockudoku postcards) give curiosity and expression; FOMO is the dark version. A
  permanent "earned once" album is the calm version.
- **Achievements/leaderboards** are secondary in the genre; players mostly care about the next level and their
  best. A household/family board is enough; public boards are a later platform feature.
- **No ads/IAP** in Tò He changes the design: there is no "revive for ad", no "booster for gems", no
  "continue for coins". The game must be satisfying without a monetisation loop. That is an advantage for trust,
  and a constraint on how much meta we can justify.

## What players criticise

- Ads between runs, mid-run, unskippable; ads opening browser tabs.
- "Rigged" piece draws near a high score; no undo; a mistake feels irreversible.
- Difficulty spikes in adventure modes; levels that require a lucky draw.
- UI clutter, lag causing a piece to land in the wrong cell, progress lost on crash.
- Daily/seasonal systems that become obligations; pay-to-win boosters in PvP.
- 1010! criticised for not explaining why points happen; a child does not learn from the game.

## What to copy / what to refuse

| Copy | Refuse |
|---|---|
| 8 × 8, 3 pieces, no rotation | 10 × 10 or 9 × 9 for the core (keep 8 × 8 on phones) |
| Non-linear clear score, combo, perfect clear | Hidden/opaque scoring |
| Adventure-style levels with 1–3 stars | Energy, timers, forced waits |
| Daily seed + calendar | Punishing streaks, FOMO seasons |
| Board-first onboarding | Long tutorial decks |
| Personal best + mastery rank | Public pressure for children |
| Calm, no timer | Ads, IAP, "revive for ad" |

## Implications for Lấp Ô

1. **The core loop is the product.** Do not let the journey layer hide a weak endless mode. Ship endless first,
   then add the journey.
2. **A journey of 18–36 short levels** is the strongest long-progression pattern; it gives mastery and variety
   without a timer.
3. **A daily seed with a calendar** is a gentle return loop; local-first is enough for V1, platform board later.
4. **Fairness is a feature**: weighted bag, helpful draw, undo/rescue, visible combo. This directly answers the
   "rigged" criticism.
5. **Keep the first run short and legible**: 8 × 8, 1–5 minutes, instant restart, no reading required.
6. **Do not copy the monetisation**: no ads, no gems, no revive purchase. The "long progression" must be
   mastery/curiosity, not relief from pressure.

## Sources

- Block Blast: <https://en.wikipedia.org/wiki/Block_Blast!>, <https://www.blockblast.com/>,
  <https://apps.apple.com/us/app/block-blast/id1617391485>,
  <https://play.google.com/store/apps/details?id=com.block.juggle>,
  <https://block-blast.fandom.com/wiki/Block_Blast!>, <https://block-blast.gg/scoring>,
  <https://www.appgamer.com/block-blast-cheats-tips/>,
  <https://blocksolver.ai/en/block-blast-adventure-mode>,
  <https://www.blog.udonis.co/statistics/block-blast>,
  <https://www.applixir.com/blog/the-block-blast-playbook-what-127m-in-ad-revenue-actually-bought/>
- 1010!: <https://www.gram.gs/game-detail-1010.html>,
  <https://play.google.com/store/apps/details?id=com.gramgames.tenten>,
  <https://apps.apple.com/us/app/1010-block-puzzle-game/id911793120>,
  <https://blog.coelho.net/1010-analysis/>, <https://gram.gs/game-detail-1010-World.html>
- Woodoku: <https://play.google.com/store/apps/details?id=com.tripledot.woodoku>,
  <https://woodoku.zendesk.com/hc/en-us/articles/4419672575249-How-long-does-each-Journey-last>,
  <https://woodoku.zendesk.com/hc/en-us/articles/29409674319389-What-is-the-League-Feature-in-Woodoku>,
  <https://woodoku.zendesk.com/hc/en-us/articles/4419665155473-What-is-the-Daily-Challenge>,
  <https://woodoku.zendesk.com/hc/en-us/articles/4419664901905-What-are-Streaks-and-Combos>
- Blockudoku: <https://easybrain.com/blockudoku>,
  <https://play.google.com/store/apps/details?id=com.easybrain.block.puzzle.games>
- Block Heads: <https://play.google.com/store/apps/details?id=games.blockheads.sudoku.puzzle.match.bombayplay>
