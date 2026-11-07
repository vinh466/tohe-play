# D-10 — The mascot "Máy Ghép"

Status: open (blocked by D-09). Kind: decision.

## Question

If the brand includes a character (D-09 D), who is it, how does it look and behave, and where does
it appear without becoming a second art pipeline?

## Concept

**Máy Ghép** — the workshop's machine, alive. A block-shaped head (the 16 as its face plate), two
round pressure gauges as eyes (the needles are the pupils), a chute mouth, gear ears, a loader-rail
base. Warm cream/brass/dark, a dry, kind expression. It is the machine the player already operates;
the character is the game, not a sidekick.

**States**: idle (the needles at rest), pressure-full (the eyes fill, a small steam), happy (an
order done, the chute opens), worried (the stack near the safety line), jammed (the eyes half-lidded,
a small puff). The in-game reactions are a later polish; the icon/OG need only the idle face.

**Where**: the icon/mark and the OG/lockup (D-09); the title screen (the mark/wordmark; the face
can animate in CSS/SVG, no canvas); the how-to (a line per beat); the game over (the proud/tired
face); the Workshop (the machine at the top); the Daily card (a small face/stamp). The UI voice is
one short line per beat, not dialogue trees.

## Options

1. **Idle face only** (the icon/OG/title) — the cheapest; the brand gets a face; no runtime cost.
2. **Idle + 3 states in the title/OG** (CSS/SVG) — more warmth; no Phaser.
3. **Idle + in-game reactions** (the Phaser view) — the warmest; a new art/animation surface; a
   later phase (2.3).
4. **No character** (D-09 C) — the wordmark + the badge.

## Recommendation

**1 in 2.1, 2 in 2.3, 3 only if the family loves it.** The character earns its place in the icon,
the title and the OG first; the in-game reactions (the eyes tracking the shot, the pressure) are a
small, delightful addition once the loops are proven. The mascot is not a quest-giver or a
dialogue system; a line per beat is enough.

## Cost and risks

The character design (3–4 iterations), the SVG states, the CSS animation, the title integration,
the review at 32/96/512. The risk is a generic robot or a childish face for the adults; the "dry,
kind machine" direction and the owner's review are the gate. The in-game reactions need the Phaser
view and the art; a separate phase.

## What would change my mind

- The owner dislikes the face: the character stays in the copy (the machine's lines), the logo goes
  to the wordmark/badge.
- The family loves it: pull the reactions (3) earlier, and the Workshop machine becomes the
  character's home.
