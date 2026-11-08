# Design — Lấp Ô

The target design as the items compose it. It decides nothing; each claim cites the item that owns it.

## 1. The promise

> **Một ván ngắn, một hành trình dài, không áp lực.**

A player opens Lấp Ô and is placing a piece within seconds. A run is a few minutes. Over weeks, a journey of
curated levels, a daily puzzle and personal ranks give reasons to return — never a timer, an energy bar, a
punishing streak or a purchase. [D-01](items/D-01-positioning-and-age.md), [D-03](items/D-03-long-progression.md)

## 2. Two layers, one core

| Layer | What it is | Why |
|---|---|---|
| **Chơi tự do** | Endless 8 × 8; personal best; mastery rank; stats | The pure puzzle, always available, no gate |
| **Hành trình** | 3–6 chapters × 6 levels; goals; stars; unlocks | Curated long progression; mastery and variety |
| **Thử thách hôm nay** | One seed per day; 3 goals; a calendar stamp | A gentle appointment, Wordle-like, not a streak |
| **Thành tích & thống kê** | Achievements, totals, best combo | Recognition and self-knowledge |

The core rules are identical in every layer. A layer changes the **goal**, the **board/piece set** or the
**presentation**, never the physics of placing a piece. [D-02](items/D-02-core-loop.md), [D-03](items/D-03-long-progression.md)

## 3. Core loop

### Board and pieces

- **8 × 8** board, portrait first. Cells read at a glance on a 360 px phone.
- **3 pieces** in a tray under the board; no rotation.
- About 20 fixed shapes: 1 × 1, dominoes, trominoes, 2 × 2, small L, 1 × 4/4 × 1, 1 × 5/5 × 1, 3 × 3, big L,
  T, S, Z. The exact set is content, not code. [D-02](items/D-02-core-loop.md)
- A weighted **bag** draws pieces: small shapes dominate early; large shapes appear as the run grows. At least
  one piece in a fresh tray fits while any shape fits (**helpful draw**). A tray never contains more than one
  very large piece early. [D-02](items/D-02-core-loop.md), [R-04](research/R-04-run-length-simulation.md)

### A move

1. Pick a piece; **drag** it above the finger or **tap** it then tap a cell (tap-to-place is mandatory).
2. A ghost snaps to the nearest legal cells. If it fits nowhere, nothing is shown and the piece returns.
3. Placing scores **+1 per cell**.
4. Clear every full row and column at once. A placement that clears **n** lines scores **10 × n²** before the
   combo: 10, 40, 90, 160…
5. **Combo**: a clear raises the multiplier by 1 (cap ×5). A non-clear lowers it by 1 (floor ×1) — a soft decay,
   not a reset. The meter is visible beside the score. [D-02](items/D-02-core-loop.md)
6. A **perfect clear** (empty board after a clear) adds **300** and a fanfare.
7. Refill the tray when it is empty.

### Assists (recommended set)

- **Đổi khay** (rescue): once per run, only when no piece fits; reshuffles the tray. Earned at 1,000 points and
  by a perfect clear, max 2. No ads, no purchase. [D-02](items/D-02-core-loop.md)
- **Undo**: one step per journey level (not in endless or ranked). A calm game should forgive a slip.
  [D-02](items/D-02-core-loop.md)
- **Hint**: after 8 seconds idle, gently pulse one legal placement; can be turned off. [D-02](items/D-02-core-loop.md)
- **Helpful draw** is a fairness guarantee, not a difficulty setting; it is always on. [D-02](items/D-02-core-loop.md)

### End

The run ends when no tray piece fits and no rescue is left. The end card shows score, best, rank progress, the
journey stars/goals (if a level), and **Chơi lại** / **Tiếp theo** / **Về hành trình**. [D-02](items/D-02-core-loop.md), [D-06](items/D-06-ui-and-shell.md)

## 4. Long progression

### 4.1 Hành trình (the spine)

- **6 chapters × 6 levels = 36** for the full journey; **3 chapters × 6 = 18** is the MVP cut.
  [D-04](items/D-04-journey-content.md)
- Each chapter has a paper/ink theme and a piece-set flavour:
  1. **Giấy** — small pieces, generous goals; teaches place, clear, combo.
  2. **Mực** — L/T/S/Z; goals on two-line clears.
  3. **Gấc** — 4-cell pieces; precision and combo.
  4. **Nghệ** — 3 × 3 and 5-cell pieces; board management.
  5. **Lá** — blocked cells / board shapes; planning.
  6. **Đêm** — mixed mastery; the hardest goals.
- A level is a **fixed seed**, a piece set, an optional board mask and **3 goals**. The player earns up to
  **3 stars**; stars unlock the next chapter and cosmetics. No energy; replay any level.
- Goals are concrete and readable: reach a score, clear N lines, clear 2+ lines in one move, make a perfect
  clear, finish within N moves, keep the board under X% full, clear a line with a given piece. [D-04](items/D-04-journey-content.md)
- Every level is validated by a bot (completable, not trivial, target difficulty band). [E-02](items/E-02-level-validator.md)

### 4.2 Mastery rank (the endless ladder)

- A persistent rank from **personal best score**, e.g. 10 ranks at 0 / 100 / 250 / 500 / 1,000 / 2,000 / 3,500 /
  5,000 / 7,500 / 10,000. Thresholds are tuned after playtests. No decay, no seasons, no reset.
- The rank badge sits on the title screen and the end card. It is a statement of mastery, not a gate.
  [D-03](items/D-03-long-progression.md)

### 4.3 Daily challenge

- One seed per day (`session.seed`, `YYYYMMDD`), same board and goals for everyone on that date.
- 3 goals; one scored attempt per day; practice allowed without changing the stamp.
- A **calendar** of stamps; missing a day never removes a stamp or breaks a streak. [D-05](items/D-05-daily-challenge.md)
- The result can be shared as a challenge link with the same seed (existing `entries/share` pattern); a
  platform-wide daily board is later (PB-06). [D-05](items/D-05-daily-challenge.md), [E-03](items/E-03-save-ranked-daily.md)

### 4.4 Achievements and stats

- **15 achievements** in four groups: first steps, clears, combos, journey. Examples: first line, 3-line clear,
  ×5 combo, first perfect clear, 1,000/5,000 points, 100/500 lines, 10 games, all chapter 1 stars.
- **Stats**: games, total score, lines, best combo, perfect clears, journey stars. All in the save and shown on
  a "Thành tích" screen. [D-03](items/D-03-long-progression.md), [D-06](items/D-06-ui-and-shell.md)

## 5. Journey content

- Levels are data: `defineCatalog('level', [...])` with `id`, `chapter`, `seed`, `pieceSet`, `boardMask`,
  `goals`, `starThresholds`, `intro`. The logic imports the catalog and the tests check references and schema.
  [D-04](items/D-04-journey-content.md)
- A level's seed is fixed, so the same pieces come for every player and a retry is fair. The endless mode mixes
  the daily seed with the run counter (or previous RNG) so "Chơi lại" is a new board. [E-03](items/E-03-save-ranked-daily.md)
- The journey map is a scrollable set of paper pages/stamps, not a grid of identical buttons. Each chapter is a
  page; each level is a stamp with 0–3 stars. The next unplayed level is the "Tiếp tục" target.
  [D-06](items/D-06-ui-and-shell.md)
- The end card for a level shows the three goals as a checklist, the stars earned, and **Chơi lại** / **Tiếp theo**
  / **Về hành trình**. A missed goal says which one. [D-06](items/D-06-ui-and-shell.md)

## 6. UI/UX

### 6.1 Title screen

- **Chơi tự do** and **Hành trình** as two large cards; the daily challenge as a smaller card or stamp below.
- Best score, rank badge, journey progress (`Chương 2 · 8/18 sao`), and "Ván đang chơi dở" when relevant.
- Tools: Cách chơi, Cài đặt, Xếp hạng, Thành tích. The kit's icon + word rule.
- The title screen needs a small extension to the shell: a second primary card and a progress line.
  [D-06](items/D-06-ui-and-shell.md), [E-01](items/E-01-kit-screens.md)

### 6.2 Journey screen

- A custom shell screen, not an overlay over the board. It needs a generic `screens` API in the kit: a screen
  has an id, an icon, a label, a render function and a back action. [E-01](items/E-01-kit-screens.md)
- The map scrolls vertically; chapters are pages; stamps show stars; locked levels are dimmed with a lock icon
  and the reason ("Cần 6 sao chương Giấy"). No timers, no energy.
- Tapping a level opens a small card: goals, best stars, "Chơi". A "Tiếp tục" button jumps to the next unplayed.

### 6.3 Playing

- Board above, tray at the bottom (thumb zone); score and best in the kit HUD; combo meter beside the score.
- Journey: the HUD's center shows the goals (`2/3`) and moves left; a goal completed pulses once.
- Tray: 3 slots, pieces scaled to fit; a 5-cell piece may shrink in the tray and grow when picked. Test at
  320/360/390 px. [D-06](items/D-06-ui-and-shell.md)
- Tap-to-place: first tap lifts and glows the piece; second tap places it. Drag lifts the piece above the finger.
- Invalid placement: soft "nope", piece returns, no score change; the slot never covers the board.

### 6.4 End card

- **Endless**: score, best, rank progress (e.g. "Còn 240 điểm để lên bậc Nghệ nhân"), **Chơi lại**, **Về nhà**.
- **Journey**: stars, goal checklist, **Chơi lại**, **Tiếp theo**, **Về hành trình**.
- **Daily**: date, stars, stamp, **Chia sẻ** (challenge link) and **Về nhà**.
- A record gets confetti and a fanfare; a missed goal gets a quiet explanation, not a scold.

### 6.5 Onboarding

- Board first, not a deck of tutorial cards. A 3-step interactive first run: place a piece, clear a line, clear
  two lines. The shell's "Cách chơi" remains available with 3 picture hints. [D-06](items/D-06-ui-and-shell.md), [R-02](research/R-02-ux-and-retention.md)
- The first move pulses a legal cell; the hint system takes over after 8 seconds idle.
- A child can play before reading; every goal has an icon and a number.

### 6.6 Accessibility

- Touch targets ≥ 44 px; the 8 × 8 grid snaps to the nearest cell and enlarges the hit area.
- Colour is never the only channel: shape, pattern and a "Dễ phân biệt" palette. [D-07](items/D-07-art-and-skins.md)
- Contrast 4.5:1 for text, 3:1 for UI; reduced motion snaps animations and removes confetti.
- Sound and haptics can be turned off; the game is playable muted.
- Light and dark follow the hub; board skins must keep both readable.

## 7. Art and identity

- **Paper and ink**: cream board in light, warm charcoal in dark; gấc red for actions, turmeric and leaf for
  attention. The palette comes from the design tokens and the V1 brand work. [D-07](items/D-07-art-and-skins.md)
- **Pieces**: 8 hues, each used by several shapes; shape is the primary identity. A colour-blind-safe palette
  (Okabe–Ito) is an option. One colour per shape (20+ colours) is rejected as noisy and hard to read.
  [D-07](items/D-07-art-and-skins.md)
- **Board skins** (6): Giấy, Mực, Gấc, Nghệ, Lá, Đêm. They change the board frame/background, not the piece
  palette. Unlocked by stars/ranks; no purchase. [D-07](items/D-07-art-and-skins.md)
- Draw everything with Phaser textures (`drawTexture` + `crispImage`), no asset pack for MVP; the size stays
  near Ghép Khối. [R-03](research/R-03-platform-and-reuse.md)

## 8. Technical shape

- Copy `games/merge-block`: `logic.ts` pure, events out; `view.ts`/`stage.ts` animate; `app.ts` shares; `main.ts`
  is the menu stage. [R-03](research/R-03-platform-and-reuse.md)
- **Save** (≤ 64 KB), versioned:
  `{ v, best, game, tutorialSeen, run, journey, daily, stats, achievements, settings, ranked? }`.
  The game state holds board, tray, score, combo, PRNG; journey holds chapter/level/stars; daily holds the last
  date and result; stats/achievements are counters and ids. Ranked moves are compact and only kept for the
  current run. [E-03](items/E-03-save-ranked-daily.md)
- **Scores**: use the live `session.run(id).update(score)` / `finish(score)` pattern; no ranked in MVP. Ranked
  endless is V4 after the simulation proves runs end within `maxMoves`. [E-03](items/E-03-save-ranked-daily.md)
- **Seed**: endless mixes `session.seed` with the run counter (or previous RNG) so a restart is a new board;
  daily uses the raw `YYYYMMDD` seed. [E-03](items/E-03-save-ranked-daily.md)
- **Shell**: add a generic `screens` option to `createShell` for Journey, Stats and Achievements. This is the
  only kit change the MVP needs; it should be designed so other games can use it. [E-01](items/E-01-kit-screens.md)
- **Level validator**: a `simulate` script plays each level with a bot, checks completability and prints a
  difficulty band; it runs in the game's tests or a `pnpm --filter @tohe/game-fill-blocks simulate` command.
  [E-02](items/E-02-level-validator.md)
- **Public pages**: `page/vi.md`, `page/en.md`, `page/facts.json`, OG images; the standard `/new-game` step.
  [E-03](items/E-03-save-ranked-daily.md)

## 9. Phasing

| Release | What | Why |
|---|---|---|
| **V0** | Spec rewrite + ADRs/docs | The rules and decisions must be written before code |
| **V1** | Core + endless + save/scores + how-to + end card | The pure game, shippable and testable |
| **V2** | Journey 3 × 6 + journey screen + stars + ranks + stats | The long progression the owner asked for |
| **V3** | Daily + achievements + 6 skins + 3 more chapters | The return loop and expression |
| **V4** | Ranked endless + platform daily board + hub progress | Competitive/platform layer, only after data |

[D-08](items/D-08-scope-and-phasing.md)

## 10. Deliberate non-goals

- No energy, ads, IAP, currency, loot boxes, battle pass, countdowns, FOMO, punishing streak loss.
- No online/PvP in this plan; the game is one player.
- No user-generated levels or editor.
- No platform-wide achievements/daily board in V1–V3; those are V4 and need an ADR.
- No new engine or art style; the game uses the kit and the paper/ink language.

## 11. Evidence

- **Market**: Block Blast / 1010! / Woodoku / Blockudoku show the core loop is the product; meta layers work
  when they serve mastery and curiosity, and hurt when they sell relief. [R-01](research/R-01-block-puzzle-market.md)
- **UX**: board-first onboarding, tap-to-place, ghost above the finger, 44 px targets, error prevention/undo,
  soft feedback, reduced motion, colour + shape. [R-02](research/R-02-ux-and-retention.md)
- **Platform**: the kit gives the shell/HUD/juice/theme/layout; the contract gives save, live scores, entries and
  a daily seed; the shell lacks a custom screen hook; the hub only shows best. [R-03](research/R-03-platform-and-reuse.md)
- **Simulation**: 8 × 8 is viable; a random player ends in ~15 moves, a greedy player lasts ~65–104 moves; a
  gentle piece bag lengthens games; journey levels need move/goal limits; ranked needs a move cap.
  [R-04](research/R-04-run-length-simulation.md)
