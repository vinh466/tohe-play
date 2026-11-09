# D-12 — UX: one main board, panels over it

**Status:** researching — **2 rows of 4 cards decided**; dock, sheets and pause behaviour open · **Kind:** decision · **Blocked by:** D-05, D-08, D-10, E-01

## Decision (owner's words)

> "2 hàng 4 card (Recommended)"

- **4 hero cards in the bottom row, 4 enemy cards in the top row**, a turn rail, and a clash zone between them.
- Cards lunge/collide; damage numbers; skill cut-ins; the board is the main screen.
- No home; the board is the app.

**Wireframe v1:** [board-v1.html](../wireframes/board-v1.html) — board, team sheet, hero detail, summon, offline return, stage picker (low-fi, 380 × 676).

```
┌──────────────────────────────────────┐
│ Vùng 1 · 3/12   [gold] [essence] [⚙] │  stage progress + resources + menu
│        ┌──────────────────────┐      │
│        │  enemy cards (4)      │      │  enemy zone (top)
│        │  [turn rail]          │      │  next 6 actors
│        ├──────────────────────┤      │
│        │  board / effects      │      │  clash, damage numbers, boss bar
│        ├──────────────────────┤      │
│        │  hero cards (4)       │      │  hero zone (bottom)
│        └──────────────────────┘      │
│ [auto-cast] [×2] [Dừng]   [Nâng cấp] │  battle controls + contextual upgrade
│ [Đội] [Trang bị] [Triệu hồi] [Sổ] [⋯]│  bottom dock (panels)
└──────────────────────────────────────┘
```

- **The board is the app.** There is no home screen and no tab that replaces the board.
- **Top strip**: region/stage progress, soft currencies, settings/menu.
- **Enemy zone**: 4 enemy cards, their HP, buffs, boss bar; the turn rail sits above/below.
- **Middle**: the clash — cards lunge, hit-stop, damage numbers, skill cut-ins; the region background.
- **Hero zone**: 4 hero cards with HP, skill charge, element, star; tap to target/see details.
- **Battle controls**: auto-cast toggle, speed ×1/×2/×3, stop/farm, contextual "Nâng cấp" when something is affordable.
- **Bottom dock**: Đội · Trang bị · Triệu hồi · Sổ tay · ⋯ (daily, records, settings, credits). A dock button opens a **sheet** over the board.

## Navigation options

### A — Bottom dock + sheets (recommended)

- 4–5 icon+label buttons; each opens a sheet from the bottom; the board stays behind.
- One-hand reach; the battle is never more than one tap away.
- The sheet pauses the battle (or dims it); closing resumes.
- **Cost**: the dock takes ~56–64 px of height; on a short phone the board must still fit.

### B — Side rail

- A vertical rail on the left; more room for the board, but harder one-hand reach and less standard on phones.
- **Verdict**: worse for the phone-first promise.

### C — Hamburger menu

- A single menu button; maximum board space, but every meta action is two taps and the game feels like a settings app.
- **Verdict**: reject for the main loop; keep only for settings/credits.

## Sheet behaviour (to decide)

| Question | Recommendation |
|---|---|
| Does a sheet pause the battle? | **Yes** for team/gear/summon/codex; the battle is a single-player, no-timer fight; pausing is kind. |
| Can the player upgrade from the sheet? | Yes; a "Nâng cấp" button and a "Dùng ngay" on new gear. |
| Does auto-advance stop when a sheet opens? | Yes; resume on close. |
| Where does the offline summary appear? | A card over the board on first open, then a small "while away" row in the daily sheet. |
| Where do daily tasks live? | A badge on the ⋯ or a dedicated daily sheet; no home. |
| How does the player choose an earlier stage to farm? | A "stage picker" sheet from the top strip; default is auto-advance/farm highest. |

## Screen map

```
Title (menu stage) ─ Chơi tiếp ─▶ Board (play stage)
                                     ├─ Đội (sheet): team, formation, hero list
                                     ├─ Hero detail (sheet): stats, star, skills, gear
                                     ├─ Trang bị (sheet): inventory, equip, upgrade
                                     ├─ Triệu hồi (sheet): pull, pity, results
                                     ├─ Sổ tay (sheet): codex, bonds, records
                                     ├─ Nhiệm vụ (sheet): daily, expedition, boss
                                     ├─ Stage picker (sheet)
                                     ├─ Offline summary (card on return)
                                     └─ ⋯: settings, credits, how-to
```

## What it changes

- **D-13**: the board is the hero visual; the sheets reuse card art.
- **D-10**: daily is a sheet + badge, not a home tab.
- **D-16**: wireframes must cover the board at 360×640 and the five sheets.
- **E-01**: the persistent shell must not add a "Ván mới"; the board is the world.

## Evidence

- Owner's words, 2026-11-09: main zone is the fight; board of cards.
- [R-06 — Main-screen auto-battler UX](../research/R-06-main-screen-ux.md): always-visible battle, dock, contextual upgrade.
- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md): 4-card width math; hit feedback.
- [R-04 — Platform fit](../research/R-04-platform-fit.md): the shell gap (E-01).

## Discussion

**agent (2026-11-09):** recommend A. The game should feel like a board you watch and poke, not a menu with a battle inside. The dock is the smallest navigation that still gives access to team/gear/summon/codex; sheets pause the battle so the player can think. The risk is vertical space on a 360×640 phone; the wireframe must prove the board still reads with the dock.

**owner:** _chưa trả lời._
