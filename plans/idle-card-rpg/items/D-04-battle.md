# D-04 — Core loop and battle model (decided)

**Status:** decided — owner chose the control model and round-based timing on 2026-11-09 · **Kind:** decision · **Blocked by:** D-01

## Decision (owner's words)

> "auto đánh thường, auto cast skill (có thể tắt auto cast skill để tự cast)"

> "Round-based auto (Recommended)"

- Normal attacks happen **automatically**.
- Skills are **auto-cast by default**.
- A toggle turns **auto-cast off**, so the player can cast manually.
- The battle runs in **rounds**: each round, every living unit acts once in SPD order; auto attacks/skills; the player can turn auto-cast off and choose a skill/target on their heroes' turns.
- 4 heroes per team (D-05 decision).

This is the "balanced" control layer: the game can be watched on auto, but the player can take over the skills when it matters.

## Battle shape (decided direction; details in D-05/D-09/D-12)

- 4 heroes vs 4 enemies, 2 rows (front/back), portrait.
- 3–5 rounds, 20–40 s; boss 60–90 s; speed ×1/×2/×3.
- **Turn rail** at the top: the next 6 actors in order; speed buffs/debuffs move icons.
- **Auto-cast toggle** on the battle HUD: on by default; turning it off pauses the skill decision for the player's heroes, not the enemies.
- **Targeting**: default lowest-HP enemy; tap to focus; bosses with adds can be targeted.
- **Skills**: each hero has 1 basic + 1 active + 1 passive; active charges over turns; auto-casts when ready unless the toggle is off.
- **Win/lose**: kill all enemies / all heroes down; retry free; no energy; a loss suggests a change (gear, formation, element), not a paywall.
- **Determinism**: seeded RNG; same team/seed → same battle (needed for balance sim and a future ranked daily boss).
- **Auto-advance**: the board keeps clearing waves and moving to the next stage until a loss; then the player can farm the highest cleared stage or upgrade. (Details in D-09.)

## Battle shape (provisional, follows the timing decision)

- 4 heroes vs 4 enemies, 2 rows (front/back), portrait.
- 3–5 rounds, 20–40 s; boss 60–90 s; speed ×1/×2/×3.
- **Turn rail** at the top: the next 6 actors in order; speed buffs/debuffs move icons.
- **Auto-cast toggle** on the battle HUD: on by default; turning it off pauses the skill decision for the player's heroes, not the enemies.
- **Targeting**: default lowest-HP enemy; tap to focus; bosses with adds can be targeted.
- **Ultimate/skill**: each hero has 1 basic + 1 active + 1 passive; active charges over turns; auto-casts when ready unless the toggle is off.
- **Win/lose**: kill all enemies / all heroes down; retry free; no energy; a loss suggests a change (gear, formation, element), not a paywall.
- **Determinism**: seeded RNG; same team/seed → same battle (needed for balance sim and a future ranked daily boss).

## What it changes

- **D-05**: 4 heroes, roles/elements, 1 basic + 1 active + 1 passive; the active is the skill the player can cast.
- **D-06**: SPD is a real stat; gear can change turn order.
- **D-09**: stages are built from rounds/waves; bosses have phases and telegraphed skills.
- **D-12**: battle HUD needs a turn rail, 4 cards, an auto-cast toggle, a speed toggle and a target marker.
- **D-13**: card/sprite lunge, hit-stop, damage numbers, skill cut-in.
- **D-16**: the battle prototype is the first milestone.

## Evidence

- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md): the three models compared; 4-card math.
- [R-01 — Genre landscape](../research/R-01-genre.md): AFK's auto + manual ultimates; Summoners War's 4-unit turn-based battles.
- AFK Arena: Deconstructor of Fun (2019); Summoners War: Troy Dunniway (2017); Epic Seven CR: Epic7x (2019).

## Discussion

**owner (2026-11-09):** auto normal attacks + auto-cast skills, with a toggle to cast manually; then chose **round-based auto** as the timing.

**agent (2026-11-09):** recorded. Round-based auto is the right first playable: it is fair, readable and simulatable, and the manual toggle still gives the player a real decision. Real-time can be a later experiment if the board feels too static.
