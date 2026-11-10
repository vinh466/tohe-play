# R-14 — DOM/CSS for the long run: expansion and battle feel

Date: 2026-11-10 · Status: **live** in v1.1.0/v1.1.1 (`view.ts` + `style.css`)

Question: if the board is DOM/CSS, is it good for future expansion, and how do we make attacks and hits feel right?
The short answer: **yes for the UI and card game; effects are CSS/WAAPI first, with a tiny canvas overlay only if a
future effect needs hundreds of particles.** The battle FX spike is
[`tech-spike/dom-effects.html`](tech-spike/dom-effects.html); open it and click the buttons (or let it auto-run).

## Is DOM/CSS good for expansion?

| Growth | DOM/CSS |
|---|---|
| More heroes/enemies/gear/events | Data + templates; no engine constraint |
| More screens (codex, daily, events, tower) | Already DOM; same tech |
| 12 → 24 cells/board | 24 elements; tested |
| Turn rail, sheets, onboarding | Native DOM, accessible |
| Localisation, text, numbers | Native text; no canvas upload |
| 20–100 simultaneous card effects | CSS transforms + pooling; fine |
| Thousands of particles / shaders / 3D | not the goal; add a small canvas/WebGL overlay for FX only |

The board is a **turn-based card UI**, not a 60 fps sprite game. 24 hexes, 12 units and a handful of animations are
well inside DOM/CSS. The engine would only earn its 1.4 MB if the game later became a real-time particle game.

## Effect spike

The spike has 24 hexes, 6v6, a turn rail, road/feed, and a DOM effect layer. It auto-plays hits, crits, an active
skill, heal, shield and death; buttons trigger each. It measured, in the same headless Chrome at DPR 2 while auto-
playing an effect every 1.4 s:

| Screen | p50 | p95 | long tasks |
|---|---|---|---|
| 390×844 | **16.7 ms** | 16.7 ms | 0 |

The effect layer uses ~18 temporary nodes per hit (strike, slash, ring, impact wash, flash, 9–12 sparks, projectile,
number), a pool of 16 number nodes, and removes nodes after the timeline. It never creates a per-frame game loop: the next turn is a timer, the
animation is CSS. A game can cap concurrent bursts at 3 and still feel rich.

## The attack/hit language

The current card game already has a good core: the attacker lunges, the target flinches, a number floats, the HP bar
drops. The next pass should make the **cause and the hit** readable in three beats:

```text
wind-up ──▶ travel ──▶ impact + hit-stop ──▶ recovery
 160 ms      220 ms      60 ms                260 ms      (×1, the default)
```

×1 is deliberately readable. ×2 halves every beat, ×5 quarters it, ×10 compresses it to ~0.12×; the turn gap, hit-stop
and number animation scale with it.

### Normal hit — Tier 1

- Attacker: body scales 1.12 and leans 10 px toward the target (wind-up), with an element-coloured cast glow.
- A bright **element streak** runs from attacker to target before impact; ranged skills also send a projectile.
- Target: flinches 8 px away, a coloured **slash**, a **flash**, an **element wash** and a **ring** in the element colour.
- 9–12 **sparks** (CSS squares/dots) fly 16–30 px; they are gone in 300 ms.
- Damage number: red-orange, 16 px; crit: gold, 24 px, with a board shake and haptic.
- HP: fill drops immediately; a **ghost bar** (white/red, 50% opacity) catches up 100 ms later, so the lost chunk is
  visible.
- Hit-stop: 40 ms on the board (no new turn), not a camera freeze; SFX one hit; no haptic.
- At ×3, the wind-up is skipped and the sparks drop to 4; the number and HP still read.

### Crit — Tier 2

- Wind-up 180 ms, a brighter ring, 10 sparks, gold number, a 2 px board shake for 120 ms, hit-stop 70 ms, haptic bump.
- A short `CRIT` word above the number is optional; do not add a modal.

### Active skill — Tier 3

- A **skill banner** at the top of the board (`CHIÊU · CHÉM ĐÔI`) slides in for 900 ms; the caster's card rises and
  gets a gold ring.
- For melee, a larger lunge + slash arc; for ranged, a projectile with a trail; for AoE, a ring on every target.
- Board dims 8% for 120 ms (a scrim layer, not a filter) and a single hit-stop 90 ms; then the numbers.
- SFX: skill sound + impact; haptic success.
- The banner is informational, not blocking; the auto flow continues.

### Heal, shield, status, death

- **Heal**: green ring and upward sparks; `+N` green; target's HP bar rises with the ghost bar behind.
- **Shield**: blue hex ring around the target, a brief `+shield` if the number exists; no text label.
- **Burn/poison**: 2–3 small embers/bubbles at the end of the round, with a tiny repeated tick number; do not shake.
- **Stun**: 2 small stars/orbits around the portrait; no screen effect.
- **Death**: desaturate the portrait, scale the card 0.92 and tilt 2°, fade to 55%, 6 pale sparks; the slot stays visible
  until the wave resets. One death sound; no explosion.
- **Bond/synergy**: a small link glyph between adjacent bonded hexes; no extra animation.

### Turn and outcome

- Active card: gold ring; the turn rail chip also gets the ring.
- Turn rail: the next six actors; current in gold; no names on the board.
- Clear: ribbon in the feed, road marker moves; no popup; auto always.
- Loss: small popup + rewind (R-12), not a blocking modal.
- Boss/chapter: larger ribbon/chest, still no modal.

## Timing and performance rules

1. **One impact per card at a time.** If a second hit lands, replace the animation or queue a short follow-up; never
   stack 10 classes.
2. **Compositor-only properties**: `transform`, `opacity`. Do not animate `width`, `height`, `left`, `top`, `filter` or
   `box-shadow` (filter only for the static dead state).
3. **Cache card centres** after layout/resize; do not `getBoundingClientRect` on every hit in the game.
4. **Pool** numbers (16), rings (8), bursts (6), projectiles (6); cap bursts at 3; remove on animation end.
5. **Fast mode ×3**: wind-up off, travel 40% shorter, sparks 4, hit-stop 40 ms; keep numbers/HP readable.
6. **Reduced motion**: no shake, sparks or projectiles; keep flash/ring (short) and numbers; no haptics.
7. **SFX throttle** 45–60 ms; one impact sound per burst; haptic only crit/active.
8. **No filters/shadows on large layers**; one small box-shadow on the projectile is fine (static).
9. **Test on a real phone** with `#perf`; the headless numbers are a floor, not a phone proof.
10. **Fallbacks**: if `clip-path` is unsupported, rounded cards still work; if WAAPI is unsupported, CSS class
    animations still work.

## Future effects (without an engine)

- **pixelfx sprite sheets** as CSS `background-image` + `steps()` keyframes: one element per effect, no JS loop; a
  data-driven `fx.ts` names the sheet, frame count, fps and hit time. This matches the kit's E-03 timing.
- **Canvas 2D overlay** only if a future effect needs 100+ particles or per-pixel work; the board and UI stay DOM. A
  small overlay is ~10 KB versus a 1.4 MB engine.
- **SVG filters/patterns** for special boss auras; keep them static or short.
- **No WebGL** unless the game becomes a different genre.

## Verdict

- **DOM/CSS is good for expansion** for this game: content, sheets, formation, events, terrain and 24-cell boards are
  all DOM-native.
- **Effects are not a reason to keep Phaser.** CSS/WAAPI covers the attack/hit language; a tiny canvas overlay is the
  escape hatch for heavy particles.
- **Next effect pass**: implement the Tier 1/2/3 timelines above with a 16-number pool, 3-burst cap, cached centres,
  reduced-motion and ×3 variants; measure with the spike and a real phone.

## Files

- [`tech-spike/dom-effects.html`](tech-spike/dom-effects.html) — interactive effect spike.
- The game's shipped effect layer: `games/van-du-ky/src/view.ts` (pooled numbers, 3-burst cap, cached centres).
- [`tech-spike/dom-board.html`](tech-spike/dom-board.html) — board performance spike.
- [R-13](R-13-tech-stack.md) — renderer comparison.
