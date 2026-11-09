# D-09 — Content: auto-advance stages, regions, bosses

**Status:** researching — **auto-advance + farm decided**; counts and side modes open · **Kind:** decision · **Blocked by:** D-04, D-05, D-06

## Decision (owner's words)

> "Auto-advance + farm (Recommended)"

- The board **auto-advances** through stages: wave → wave → stage clear → next stage, until a loss.
- On a loss, the company **farms the highest cleared stage**; the player can retry the wall or open a **stage picker** to farm elsewhere.
- No energy; no manual stage selection required for normal progress.
- The stage strip at the top is the road: `Vùng 1 · 3/12`.

## Proposed content shape for v1

| Piece | v1 proposal | Why |
|---|---|---|
| **Regions** | 3 regions, 12 stages each (36 stages) | One week of progression at 2–3 short sessions a day |
| **Waves** | 2–3 waves per stage; the last wave may be elite | Keeps a stage 20–40 s; auto-advance has a rhythm |
| **Bosses** | Every 4th stage elite; region end boss (3 bosses) | A spike and a reward; a reason to change the team |
| **Stage picker** | A sheet from the top strip; choose any cleared stage to farm | The player can target gear/element drops |
| **Tower** | A landmark on the road; 30 floors at launch, scaling | A second progression path when the road walls |
| **Daily expedition** | One rotating resource dungeon per day | A short daily reason to log in |
| **World boss** | A weekly async boss; damage record, local in v1 | A long-term goal without PvP |
| **Codex** | Hero/enemy/region entries; bonds | Collection content that reuses battle art |

## Open

- Exact stage count per region (10/12/15) and boss cadence (every 4th/5th).
- Whether a stage has a fixed enemy composition or a small pool per stage.
- Whether the tower is a separate mode or a "landmark" on the road.
- Whether the world boss is weekly or daily; local record only in v1.
- The stage schema (D-11): `region → stage → waves → enemies → rewards`.

## What it changes

- **D-07**: loot tables per stage/region; offline farm uses the highest cleared stage.
- **D-10**: daily expedition and world boss are daily/weekly anchors.
- **D-11**: content is data-driven; a stage is a record, not code.
- **D-12**: the board needs a stage strip, a stage picker sheet, a loss/wall card.
- **D-16**: 3 regions × 12 stages + 3 bosses + tower + expedition + world boss is the v1 content budget.

## Evidence

- Owner's words, 2026-11-09.
- [R-06 — Main-screen auto-battler UX](../research/R-06-main-screen-ux.md): auto-advance, stop/farm, stage strip.
- [R-01 — Genre landscape](../research/R-01-genre.md): AFK campaign walls, Legend of Mushroom waves.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): one-week pacing.

## Discussion

**owner (2026-11-09):** chose auto-advance + farm.

**agent (2026-11-09):** auto-advance is the right default for a board that is the app. The stage picker is the escape hatch; the wall card is the moment the player learns the systems. The content count is a proposal; the simulation in D-11 should tune it before art is produced.
