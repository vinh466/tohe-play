# R-06 — Main-screen auto-battler UX

Date: 2026-11-09 · Status: first pass

Question: khi main zone là bàn đánh bài và game tự đánh qua màn, màn hình chính nên tổ chức thế nào để vừa "treo máy" vừa có chỗ cho hệ thống?

## Sources

- Deconstructor of Fun, *The Magic of Legend of Mushroom* (2024): https://www.deconstructoroffun.com/blog/2024/4/15/the-magic-of-legend-of-mushroom
- Deconstructor of Fun, *AFK Arena* (2019): https://www.deconstructoroffun.com/blog/2019/6/6/afk-arena-puts-lilith-into-the-billionaire-club
- Game Developer, *Flexible time session design in AFK Arena* (2020): https://www.gamedeveloper.com/design/flexible-time-session-design-in-afk-arena
- Tò He game-kit: `packages/game-kit/src/phaser/juice.ts`, `overlay.ts`, `layout.ts`.

## What the references do

| Game | Main screen | Meta access | Idle/return |
|---|---|---|---|
| **Legend of Mushroom** | The character auto-kills waves; gear lamps drop at the bottom; the screen is the game | Tabs/panels around the action; gear opening is the main loop | Daily lamp batch; long sessions |
| **AFK Arena** | Campaign map/home; the idle chest is on the main screen; battle is a separate screen | Bottom bar + modes; the chest is the appointment | 12 h chest; two sessions/day |
| **Our direction** | The **board** is the main screen; cards fight; auto-advance | A bottom dock opens sheets over the board | Offline return + a 12 h cap |

The key difference from AFK: AFK's home is a campaign map; ours is the fight itself. The key difference from Legend of Mushroom: we keep a **card board** with 4 hero cards and a readable turn order, not a single character auto-attacking.

## Findings

1. **The main screen must be the game.** If the player has to navigate to a "battle" tab, the idle fantasy breaks. The board should be visible on open, with the last fight or the next wave already running.
2. **One primary action at a time.** Legend of Mushroom's lamp-opening is a second game; we do not want that. The board's primary actions are: watch, toggle auto-cast, tap a skill, tap "Nâng cấp" when affordable.
3. **The dock is for systems, not for modes.** Team, gear, summon, codex, daily — each is a sheet. The player should never lose the board for more than a tap.
4. **Contextual upgrade beats a menu.** A small "Nâng cấp" badge when a hero/gear can be upgraded is more discoverable than a deep menu. It opens the relevant sheet at the right row.
5. **The stage strip is the road.** "Vùng 1 · 3/12" at the top gives progress without a map screen. A stage picker is available for farming, but the default is auto-advance.
6. **Offline is a card, not a screen.** On return, a single card says what the company farmed; it does not force a detour.
7. **Battery/heat.** A board that animates continuously on a phone can drain battery. Idle mode should reduce animation (no particles, lower frame rate) when the player is not interacting; the battle can be "fast-forwarded" visually.

## Board layout options

### A — Two rows of 4 cards (recommended)

```
enemy back   [E] [E] [E] [E]
enemy front  [E] [E] [E] [E]
             ─── clash zone ───
hero front   [H] [H] [H] [H]
hero back    [H] [H] [H] [H]
```

- 4v4, front/back rows; cards are the units; lunge/collide; turn rail above.
- **Pros**: readable; matches 4-hero team; card identity; easy to map to a grid.
- **Cons**: 8 cards + turn rail + dock is dense on 360×640; needs careful spacing.

### B — Single lane per hero (4 lanes)

- Each hero card faces one enemy card in a lane; attacks travel along the lane.
- **Pros**: clear cause/effect; easy targeting.
- **Cons**: less "board" feeling; 4 lanes may look like a row, not a board.

### C — Free grid / auto-chess

- Cards placed on a grid; movement and positioning matter.
- **Pros**: deepest board feel.
- **Cons**: too much for v1; pathfinding, balance, UI; not the owner's "cards clash" image.

**Recommendation: A.** It is the simplest board that still feels like a board, and it reuses the 2×2 formation from D-05.

## A main-screen wireframe (low-fi)

```
┌──────────────────────────────────────┐
│ Vùng 1 · 3/12        ⛁ 1.2k  ✦ 40  ⚙ │
│  ┌────────────────────────────────┐  │
│  │  [E][E][E][E]   turn rail →    │  │
│  │      clash / damage / boss      │  │
│  │  [H][H][H][H]                   │  │
│  └────────────────────────────────┘  │
│  [auto-cast ●] [×2] [Dừng]  [Nâng cấp]│
│  [Đội] [Trang bị] [Triệu hồi] [Sổ] [⋯]│
└──────────────────────────────────────┘
```

- The **turn rail** can be a thin strip above the enemy row or a vertical rail on the left; test both.
- The **hero cards** at the bottom double as buttons: tap opens the hero sheet; the skill ring is the manual cast target.
- The **dock** is icon + label, not icon-only (Tò He's voice-and-look rule).
- The **top strip** has the stage, currencies and settings; no title, no logo (the title screen owns that).

## Risks

- **Clutter**: 8 cards, a turn rail, a boss bar, a dock and a top strip on 360×640. The wireframe must be tested at that size before art.
- **Readability**: pixel art + Vietnamese text + damage numbers; use Be Vietnam Pro for UI, not a pixel font for body text.
- **Auto-advance frustration**: if the board auto-advances into a loss, the player may feel it wasted time. A "Dừng" control and a clear "wall" state are essential.
- **Battery**: continuous animation; idle mode should animate less.
- **Panel pause**: pausing on every sheet is kind, but it makes the game feel less "live"; test both.

## Open questions for D-12

- Does the player choose a stage, or only auto-advance/farm? (Recommendation: auto-advance by default; a stage picker for farming.)
- Does the board keep fighting while a sheet is open? (Recommendation: pause.)
- Where does the "Nâng cấp" badge lead? (Recommendation: the cheapest meaningful upgrade, with a "Xem tất cả" link.)
- Does the turn rail go above the enemies or on the left? (Test both at 360×640.)
