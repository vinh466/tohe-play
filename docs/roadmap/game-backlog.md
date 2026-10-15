---
title: Game backlog
description: Games proposed for Tò He, with what each would be like, who it is for, and what it would prove about the platform.
sidebar:
  order: 3
---

Ideas to pick from, not commitments. Each game still starts as a `SPEC.md` reviewed by the owner (`/new-game`).

**Effort:**
- **S:** about a day with the kit.
- **M:** a few days.
- **L:** a week or more, or new platform work.

**Proves** says what the game would teach us about the platform, beyond being fun.

## Built

| Game | What | Spec |
| --- | --- | --- |
| Ghép Khối (`merge-block`) | Drop number blocks into columns; equal blocks merge and chain | [SPEC](../../games/merge-block/SPEC.md) |
| Chạm Ghép (`tap-merge`) | The owner's variant of Ghép Khối: tap a block on a full board, and its whole group of equal blocks (connected in 8 directions) adds up into it, rounded up to a power of two; a long, relaxed game; 🔀 rescues a stuck board | [SPEC](../../games/tap-merge/SPEC.md) |
| Chạm Chấm (`hello`) | The minimal sample game: tap the dots | [SPEC](../../games/hello/SPEC.md) |

## Next

### Lấp Ô (`fill-blocks`) — block puzzle · ages 3+ · S–M
Place shapes on an 8×8 board; full rows and columns clear ("Block Blast" / "1010!").
- **Spec:** written and waiting for review in [`games/fill-blocks/SPEC.md`](../../games/fill-blocks/SPEC.md).
- **Kid-friendly twists:** tap-to-place instead of precise dragging, and a "helpful draw" that always deals a piece
  that fits while one exists. No timer.
- **Proves:** a second real game built quickly from the kit, with drag-and-drop input, a tray of choices, and
  line-clear juice. These parts carry over to every grid puzzle.

## Puzzles and arcade (quick to build, high replay)

### Xếp Gạch — falling blocks (Tetris-like) · ages 6+ · M
Pieces fall; rotate and move them to complete lines; speed rises with level.
- **Kids:** slow start, big buttons (← ↻ →, drop), optional "ghost" landing, no game over in a calm mode
  (lines just clear).
- **Proves:** a real-time loop that must stop exactly on `pause`; swipe gestures; a difficulty curve. It is also
  the classic benchmark of "does it feel good on a phone".

### Rắn Săn Mồi — snake · ages 5+ · S
Steer a snake to eat fruit and grow; don't bite yourself.
- **Kids:** wrap around the edges, a slow speed, a swipe or 4 big arrows.
- **Proves:** the simplest real-time game; a good "build it in an afternoon" test of the agent workflow.

### Bắn Bong Bóng — bubble shooter · ages 5+ · M
Aim and shoot coloured bubbles; three of a colour pop and drop what hangs below.
- **Proves:** aiming with a trajectory preview, bounce physics on walls, and flood fill for clusters, plus
  satisfying cascade juice.

### Nối Đường Ống — pipe connect · ages 6+ · S–M
Rotate tiles until water flows from the source to the tap; hand-made levels.
- **Proves:** level-based progression (unlock the next level) in the save, and a level format agents can write.

## For the youngest (ages 3–6)

### Lật Hình — memory match · ages 3+ · S
Flip two cards; matching pictures stay up. Grids from 2×3 (toddlers) to 4×5.
- **Theme sets:** animals, fruit, vehicles (emoji or simple SVG; no network).
- **Proves:** a DOM-only game with the kit's overlay and sounds, no Phaser. It shows the kit works for UI-style
  games, and the bundle is tiny.

### Đếm Cùng Bé — counting & first maths · ages 3–6 · S–M
"How many 🍎?" — tap the right number; later "2 + 3". Spoken numbers via short synthesised tones, not voice.
- **Proves:** an educational game type, and per-profile progress that adapts its difficulty (stored in the save).
- **Risk:** content quality matters more than code; needs the owner's eye.

### Tô Màu — colouring · ages 3+ · S
Tap areas of a line drawing to fill them with colour; no score, no end.
- **Proves:** a game **without** `scores` (capability left out), saving artwork in the 64 KB save, and a calm mode
  for bedtime.

## Logic and two players

### Sudoku Nhí — 4×4 / 6×6 sudoku with pictures · ages 5+ · M
Shapes or animals instead of digits for the youngest; digits and 9×9 for adults.
- **Proves:** a generator with a unique-solution check (pure logic, heavy tests), and hints.

### Cờ Caro — gomoku / tic-tac-toe · ages 5+ · M
3×3 for kids, 15×15 five-in-a-row for adults. Play on one device against each other, or against a simple AI.
- **Proves:** two players on one device (pass-and-play), a turn-based AI in pure logic, and leaderboards that are
  win counts rather than scores.

## Online (rooms, ADR 0016 proposed)

### Tiến Lên (`tien-len`) — Tiến lên miền Nam · ages 6+ *(proposed)* · M offline, L with rooms
The southern Vietnamese shedding game for 2–4 players: beat the table with a higher single, pair, triple, straight
or double straight, chop 2s with bombs, go out first.
- **Owner's request (2026-10-16):** play with other people on the platform on their own phones — public and private
  rooms, a code or a share link, room options, bots for empty seats — as the reference flow for multiplayer games.
- **Research for review:** rules, house rules as room options, and the feature list in
  [Tiến lên research](../research/tien-len.md); rooms in [Online rooms](../architecture/rooms.md).
- **Proves:** a rules module shared by the phone and the server, bots in pure logic, and the whole rooms platform
  (lobby, codes, links, seats, reconnection) that later turn-based games reuse.

## Bigger (later, after a few small ones)

### Vườn Rau Mini — mini farm · ages 5+ · L
Plant, water and harvest; crops grow in real time; sell to buy new seeds and decorations.
- **Proves:**
  - time-based progress across sessions (the save stores timestamps; what grows while the game is closed);
  - a tilemap world;
  - long-term saves near the 64 KB limit.
- **Risk:** needs a careful economy, and offline time must not be cheatable by changing the clock (or must not
  matter for a family game).

### Hiệp Sĩ Tò He — light RPG · ages 7+ · L
Explore small tile maps, talk to characters, turn-based fights, a few quests; chapters of about 15 minutes.
- **Proves:** Phaser tilemaps, cameras, dialogue, inventory, and a content pipeline (maps and dialogue as data
  agents can write).
- **Risk:** content-heavy; would benefit from an ADR on asset licensing (free art packs) and on content formats.

### A Godot game (spike S4) · L
Any of the above built in Godot 4 instead of Phaser, to measure size and start-up time inside the iframe.
- **Proves:** the "any engine" promise of the Game Contract (ADR 0001); see the spikes in the
  [roadmap](walking-skeleton.md).

## How to choose

- Small and fast first (Lấp Ô, Rắn Săn Mồi, Lật Hình): each grows the kit a little and keeps the family playing new
  things.
- One per age band: the youngest (Lật Hình, Tô Màu), school age (Xếp Gạch, Bắn Bong Bóng), adults (Sudoku 9×9,
  Cờ Caro 15×15).
- Large games (farm, RPG) once the kit has drag, tilemaps and levels from the small ones.
