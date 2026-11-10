# D-12 — UX: one main board, panels over it (decided)

**Status:** decided — board v3 approved ("Ổn, giữ nguyên") on 2026-11-09 · **Kind:** decision · **Blocked by:** D-05, D-08, D-10, E-01

## Decisions (owner's words)

> "hầu hết ổn, nhưng về đội hình nghiên cứu cho tôi về dạng nhiều hàng để có chiến thuật sắp xếp hơn cả ta lẫn quái, có thể sắp tank lên trên sp ở dưới chẳng hạn"

> "3 hàng / 6 hero"

> "Ổn, giữ nguyên" (board v3, full info on the cards)

- The board layout is **approved**: top strip, turn rail, clash zone, controls, dock, sheets.
- **6 heroes**, arranged **3 rows × 2 columns** (front, mid, back); the enemy side uses the same 3×2.
- **Card-on-board** and **dark-first** are decided in D-13.
- Full info stays on the board cards (name, HP, element, star, skill ring); the hero sheet carries the detail. The density is accepted, with a 360×640 test during implementation.

```
┌──────────────────────────────────────┐
│ Vùng 1 · 3/12   [gold] [essence] [≡] │  stage progress + resources + menu
│  [turn rail: next 6 of 12 actors]     │
│        enemy back   [E5] [E6]         │  back: casters/healers
│        enemy mid    [E3] [E4]         │  mid: DPS/control
│        enemy front  [E1] [E2]         │  front: tanks/brutes
│        ────── clash zone ──────       │  clash, damage numbers, boss bar
│        hero front   [H1] [H2]         │  front: tank/melee
│        hero mid     [H3] [H4]         │  mid: DPS/control
│        hero back    [H5] [H6]         │  back: support/ranged
│ [auto-cast] [×2] [Dừng]   [Nâng cấp] │  battle controls + contextual upgrade
│ [Đội] [Trang bị] [Triệu hồi] [Sổ] [⋯]│  bottom dock (panels)
└──────────────────────────────────────┘
```

- **The board is the app.** There is no home screen and no tab that replaces the board.
- **Top strip**: region/stage progress, soft currencies, settings/menu.
- **Turn rail**: the next 6 of 12 actors, above the enemy rows.
- **Enemy zone**: 3 rows of 2 cards — back, mid, front; HP, buffs, boss bar.
- **Middle**: the clash — cards lunge, hit-stop, damage numbers, skill cut-ins; the region background.
- **Hero zone**: 3 rows of 2 cards — front, mid, back; HP, skill charge, element, star; tap to target/see details.
- **Battle controls**: auto-cast toggle, speed ×1/×2/×3, stop/farm, contextual "Nâng cấp" when something is affordable.
- **Bottom dock**: Đội · Trang bị · Triệu hồi · Sổ tay · ⋯ (daily, records, settings, credits). A dock button opens a **sheet** over the board.
- **Formation**: 3 rows × 2 columns per side; front +DEF/draws melee, mid +ATK/SPD, back +ATK/safer; the player arranges it in the formation sheet, not by dragging on the board.

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

- Owner's words, 2026-11-09: main zone is the fight; board of cards; 3 rows / 6 heroes; "Ổn, giữ nguyên".
- [R-06 — Main-screen auto-battler UX](../research/R-06-main-screen-ux.md): always-visible battle, dock, contextual upgrade.
- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md): 4-card width math; hit feedback.
- [R-07 — Formation](../research/R-07-formation.md): 3 rows / 6 heroes; density costs.
- [R-04 — Platform fit](../research/R-04-platform-fit.md): the shell gap (E-01).

## Discussion

**owner (2026-11-09):** approved board v3 ("Ổn, giữ nguyên").

**agent (2026-11-09):** recorded. The board is the app; the risk is density, not navigation. The implementation must test 360×640 and a real phone before art lock; if names truncate badly, the fallback is to move star/skill ring into the hero sheet, not to add more UI.
