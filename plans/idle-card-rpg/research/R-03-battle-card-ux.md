# R-03 — Battle, card UX and pixel art

Date: 2026-11-09 · Status: first pass

Question: mô hình chiến đấu nào đọc được trên phone, cho cảm giác "thẻ cụng nhau", và vừa sức với pixel art + game-kit?

## Battle models compared

| Model | How it works | Depth | Readability on phone | Idle fit | Examples |
|---|---|---|---|---|---|
| **ATB / Combat Readiness** | Each unit fills a gauge; speed and CR manipulation decide who acts; the turn bar can be pushed | High | Medium: needs a turn bar and timing | Good with auto | Epic Seven |
| **Round-based speed order** | Each round, every living unit acts once in SPD order; buffs/debuffs tick at round end | Medium-high | High: a clear "who acts next" rail | Very good | Summoners War |
| **Auto-charge ultimates** | Normal attacks auto; ultimates charge; player taps to fire or holds | Medium | Very high: only ultimate buttons | Excellent | AFK Arena |

**Recommendation: round-based speed order + manual ultimates.** It is the best compromise for "cân bằng": the player can auto a farm stage, but on a first clear or boss can hold an ultimate, pick a target, and change the order of the next round. ATB's continuous gauge is harder to read on a 360 px screen and harder to simulate; pure auto-charge gives too little agency.

## Battle shape

- **4 heroes vs 4 enemies**, two rows (front/back), portrait.
- **3–5 rounds**, 20–40 s; boss 60–90 s. Speed ×1 / ×2 / ×3; auto toggle.
- **Turn rail** at the top: the next 6 actors in order, with hero/enemy icons. Speed buffs/debuffs visibly move icons.
- **Ultimate**: charges with turns/energy; tap the card to fire; hold to save for a burst. Auto mode fires when ready.
- **Targeting**: default lowest-HP enemy; tap an enemy to focus; bosses with adds can be targeted.
- **Formation**: front row takes more melee and protects the back; some skills hit rows. Position is a real decision, not decoration.
- **Win/lose**: kill all enemies / all heroes down. Retry is free; no energy. A loss shows "what to change" (under-power, element, gear) not a paywall.
- **Determinism**: seeded RNG; the same team/seed produces the same battle. Needed for balance sim and a future ranked daily boss.

## Card presentation — the "cards clash" feel

The owner's image: characters and monsters are **cards**, and when they fight, the cards **collide** and deal damage with weight.

Three ways to stage it:

| Option | What the player sees | Cost | Fit |
|---|---|---|---|
| **Card-on-board** | The cards themselves slide forward, collide, shake; damage numbers pop; a dying card shatters into pixels | Low: no character animation, only card transforms + FX | Very distinctive; strongest "card" identity; weakest "living character" feel |
| **Sprite-on-board** | Pixel characters stand in lanes; card frames live in the UI | Medium-high: 8–12 frames per hero | Traditional; more expressive; more art |
| **Hybrid (recommended)** | A card frame at the bottom is the command; above it, a pixel sprite steps out and fights. On attack, the sprite lunges and the card flashes; on death, the card shatters | Medium | Best of both: card identity + character life |

For v1, the hybrid can be faked cheaply: the "sprite" is a 32×32 pixel portrait that pops out of the card, lunges, and returns. No walk cycles, no 8-direction animation. Later, full sprite sheets.

## Feedback recipe (use the kit's juice)

- **Hit-stop**: freeze 40–60 ms on impact; 90 ms on a critical/ultimate.
- **Shake**: 2–4 px, 80–120 ms; only on hits, not every frame.
- **Damage numbers**: `floatText` above the target; crit bigger, coloured; heal green.
- **Flash**: target card whites out for 60 ms; element-coloured burst.
- **Knockback**: card/sprite moves back 4–8 px and springs.
- **Death**: card shatters into 6–10 pixel shards; the slot dims.
- **Ultimate**: a full-card cut-in slides across the screen for 300 ms, then the effect; skip on auto/×3.
- **Reduced motion**: respect `prefers-reduced-motion`; no shake, shorter cut-ins.

The kit already has `shake`, `floatText`, `burst`, `squash`, `pulse`, `popIn`, `tweenAsync` and `prefersReducedMotion` (`packages/game-kit/src/phaser/juice.ts`).

## Pixel art specification (proposal)

| Piece | Size | Notes |
|---|---|---|
| Character sprite | 32×32 or 48×48 px | 3/4 side view; 2-frame idle, 3-frame attack, 1-frame hit, 3-frame skill, 2-frame death |
| Card portrait | 64×64 px | Head/shoulders, framed by the card; same palette as the sprite |
| Enemy sprite | 32×32 / 48×48 | Reuse rigs; recolour variants |
| Boss | 64×64 / 96×96 | 2–3 phases, bigger silhouette |
| Tiles / background | 16×16 tiles | 2–3 layers; chapter palette |
| Card frame | 9-slice, 3 rarities | Bronze/silver/gold; element gem, role icon, star pips |
| UI icons | 16×16 / 24×24 | One set; never emoji |

- **Palette**: 24–32 colours, one master palette + chapter accents. The Studio's pixel style can enforce a palette and binary alpha.
- **Animation**: frame-by-frame for attacks; tween for movement. No skeletal animation in v1.
- **Font**: Be Vietnam Pro for UI (Vietnamese diacritics), a chunky pixel font only for numbers/Latin titles. Do not use a pixel font for Vietnamese body text.
- **Theme**: design dark first (dusk parchment/ink, warm highlights), then map the same roles to a light "day" palette. The game can declare both themes; the card frames and sprites do not change.

## Screen-size math

On a 360 px wide phone, with 12 px side padding and 8 px gaps:

| Team size | Card width | Verdict |
|---|---|---|
| 4 | ~78 px | Comfortable: portrait, name, HP bar, ultimate ring |
| 5 | ~62 px | Tight but possible; names truncate |
| 6 | ~50 px | Too small for a command card |

This is the strongest argument for **4 heroes**.

## UX rules for the battle screen

- **Bottom 40% is the command zone**: hero cards, ultimate buttons, auto/speed. One-hand reach.
- **Top 35% is the enemy zone**: enemy cards, boss HP, wave counter.
- **Middle 25% is the stage**: sprites, effects, damage numbers; keep it uncluttered.
- **One primary action at a time**: "Tiếp tục", "Đánh lại", "Nhận thưởng". No nested menus in battle.
- **Readability first**: HP bars thick enough, colour-blind-safe element icons (not colour alone), damage numbers with stroke.
- **No text walls**: skill descriptions on the hero screen, not in battle.

## Risks

- **Too much UI on a small screen.** Four cards + turn rail + boss bar + controls is already dense. Wireframes must be tested at 360×640.
- **Manual timing that does not matter.** If auto is always as good, the "balanced" promise is false. Give ultimates real timing value (burst windows, boss telegraphs).
- **Animation cost.** 12 heroes × 12 frames is 144 frames; doable, but 3 bosses and 12 enemies add up. Reuse rigs and recolour.
- **Pixel readability.** Small sprites + Vietnamese text + damage numbers can turn to mush; test on a real phone early.
