# R-07 — Formation: rows, ranks and what they buy

Date: 2026-11-09 · Status: first pass

Question: với 4 hero, nên có bao nhiêu hàng, hàng thay đổi gì, và làm sao để "tank trên, support dưới" có ý nghĩa mà không làm board rối?

## Sources

- Darkest Dungeon Wiki, *Getting Started* (ranks 1–4; front ranks tank/DPS, back ranks support): https://darkestdungeon.wiki.gg/wiki/Getting_Started
- Steam Community, *Significance of position in battle*: https://steamcommunity.com/app/262060/discussions/0/392183857631203204/
- BlueStacks, *Idle Heroes Combat Guide* (6 heroes: 2 front, 4 back; front takes the brunt): https://www.bluestacks.com/blog/game-guides/idle-heroes/everything-need-battle-system-en.html
- AFK Arena Wiki, *Lineups guide*: https://afk-arena.fandom.com/wiki/Lineups_guide
- Epic7x, *Combat Readiness Guide* (speed/order, not rows): https://epic7x.com/combat-readiness-tutorial/

## Models compared

| Model | Slots | Tactics it buys | Readability on phone | Cost | Fit for 4 heroes |
|---|---|---|---|---|---|
| **1 row of 4** (current) | 4 | Almost none; only order | High | Low | Wastes the "board" idea |
| **2 rows × 2 columns (2×2)** | 4 | Front/back, tank/support, row-target skills, taunt/guard | High | Medium | **Best** |
| **3 rows × 2 columns (2×3)** | 6 | More layers: front/mid/back | Medium | High; needs 6 heroes | Conflicts with 4-hero readability |
| **4 ranks in a line** (Darkest Dungeon) | 4 | Position-specific skills, movement, rank requirements | Medium | High; lots of UI/text | Deep but too much for v1 |
| **Free grid / auto-chess** | 9+ | Placement, pathing, synergies | Low | Very high | Not v1 |

## What rows do in the references

- **Idle Heroes**: 6 heroes, **2 front / 4 back**; the front row takes the brunt of regular attacks; when the front dies, the back row starts taking damage. Position is a real defensive choice.
- **Darkest Dungeon**: 4 ranks; ranks 1–2 are tanks/melee, ranks 3–4 are support/healers; each skill has rank requirements and targets; enemies also have ranks. The deepest version, but it needs a lot of skill text and UI.
- **AFK Arena**: 5 heroes, front/back; position changes who is targeted and which skills connect.
- **Epic Seven**: 4 heroes, front/back; position affects targeting/passives, while speed decides turn order.

## Recommendation: 2×2 per side

Each side has **2 rows × 2 columns**: 4 slots.

```
enemy back    [E3] [E4]
enemy front   [E1] [E2]
              ─ clash ─
hero front    [H1] [H2]
hero back     [H3] [H4]
```

### Row rules for v1

| Rule | Front row | Back row |
|---|---|---|
| **Defence** | +15% DEF, +10% HP | — |
| **Offence** | — | +10% ATK |
| **Targeting** | Draws single-target melee; protects the back | Safer; some enemies/skills can hit the back row |
| **Skills** | Melee/taunt/guard skills require or prefer front | Ranged/heal/control skills prefer back |
| **Swap** | Free before a stage and from the formation sheet; no cost | Same |

- **Column (left/right)** matters only for **adjacency** skills ("guard the ally beside you", "hit the same column") and for targeting order. Keep it light in v1; do not build a full positional skill system.
- **Enemy formations** use the same 2×2: front tanks/brutes, back casters/healers. The stage preview shows the enemy formation, so the player can counter with rows/roles/elements.
- **Bosses** have a fixed 2×2 (or a single big boss + adds), with telegraphed row attacks; a boss that hits the back row forces a formation change.
- **No 3-row v1.** With 4 heroes, 3 rows would be 1/2/1 or 2/1/1 — awkward, and the cards would shrink. If the owner wants 3 rows later, the team size must grow to 6 and the board re-tested.

## Board layout implications

- 4 card rows of **2 cards** each: enemy back, enemy front, hero front, hero back.
- Card width ~170 px on a 380 px phone; portrait 48×48; name, HP, element/star, skill ring. Much more readable than 4-across.
- Board height ~390 px; turn rail above; clash zone 40–48 px; controls and dock below. Fits 380×676.
- The formation sheet is a 2×2 grid with front/back labels and drag handles; a hint: "Hàng trước +DEF, hút đòn; hàng sau +ATK, an toàn hơn."

## Risks

- **Board height**: 4 rows + clash + controls + dock is tight on a 640 px-tall phone; test at 360×640, not only 380×676.
- **Hidden math**: row bonuses must be visible as icons/badges, not invisible percentages.
- **Too many positional skills**: one row-target skill per role is enough for v1; a full positional system is a v2 feature.
- **Column confusion**: if left/right does not matter, do not pretend it does; label rows clearly.
- **Enemy readability**: 4 enemy cards + 4 hero cards + turn rail is a lot; enemy cards can be slightly smaller/dimmer than hero cards.

## Open questions for D-12

- Do we show both rows at full size, or make the back row slightly smaller/dimmer?
- Does the player drag cards on the board, or only in the formation sheet? (Recommendation: sheet only; the board is for watching/tapping.)
- Does the turn rail show all 8 units or only the next 6? (Recommendation: next 6, with a "+" for the rest.)
- Does a dead card leave an empty slot, or does the row collapse? (Recommendation: empty slot stays visible; no collapse, to keep position meaningful.)
