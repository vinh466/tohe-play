# R-02 — Brand and logo: from "a gear with a 16" to a mark that pulls

Status: research note for [D-09](../items/D-09-logo.md) and [D-10](../items/D-10-mascot.md).
Date: 2026-11-08. Facts from the references below; the taste calls belong to the owner.

## The question

The owner says the current icon (a gear with a 16, then a 4→16 + gear + rail) reads as a
functional icon, not a brand; he wants a more impressive, higher-quality mark that pulls players in.
Which logo system fits Ghép Khối and the Tò He family, and what exactly do we ship?

## What makes a game logo pull (the field)

A casual game mark does three jobs at once: **recognisable at 32 px** (the catalog, the favicon,
the share card), **characterful at 96–512 px** (the title, the store/OG, the console), and
**ownable** — one silhouette and colour that say this game, not the genre. The strongest casual
marks do it with a **character** (Crossy Road's chicken, Cut the Rope's Om Nom, Angry Birds' red
bird, Suika's watermelon), or with a **single geometric object** made premium (Monument Valley,
Alto's Odyssey, Two Dots). A wordmark is usually the third piece, not the mark.

**Mascot brands.** Crossy Road: a voxel chicken; the shape and the colour read at any size; the
game's loops are built around the character. Cut the Rope: Om Nom's eyes and green shape; the
character *is* the icon. Angry Birds: the red bird's silhouette and eyes. Suika: the watermelon is
the goal, the brand and the icon. Fact: a character gives the title, the OG and the store a face;
it also gives the UI a voice (the machine can react). Sources: the games' store pages and press
(accessed 2026-11-07; the exact logo files are the publishers').

**Premium geometry.** Monument Valley (pastel geometry, no mascot), Alto's Odyssey (the sunset and
the silhouette), Two Dots (two dots, a lot of restraint), Threes (the cards and the number). Fact:
the mark can be a **single, well-drawn object** with a strong palette and typography; the brand
comes from the restraint. These are useful references for the **wordmark and the palette**, not
for a mascot.

**The Tò He family.** Warm, handmade, Vietnamese, for children and adults; the platform's name is
a toy figurine. The game's own world is a warm workshop with a machine, brass, cream, blocks. The
brand should feel **made**, not corporate: a little machine with a face, a hand-built gear, a
stamp. The current palette (cream, orange, red, purple, blue, teal) and the Be Vietnam Pro type are
the base. Source: `docs/architecture/theming.md`, `packages/design-tokens/tokens.css`.

## Options

| Direction | What the mark is | Strengths | Costs / risks |
|---|---|---|---|
| A. **Mascot "Máy Ghép"** | The machine's face: a block-shaped head with the number, two gauge eyes, a chute mouth, gear ears, loader arms | The most pull; a face for the title/OG/catalog; a voice in the UI (the eyes fill with pressure, the mouth reacts, the shake) | Needs a real character design and a few expressions; can read childish; the 32 px face must survive |
| B. **Symbol: block + gear + shot** (the current, refined) | One block, a gear bite, the shot trail, the loader rail; no face | Works at 32; premium; quiet; the current direction | Generic "merge/gear"; no character; the owner already feels it is not enough |
| C. **Wordmark "Ghép Khối"** | Custom lettering: the blocks in the letters, the gear in the "ố", the 2/4/8/16 | Ownable, Vietnamese, the title is the brand; great for the OG/title | The 32 px icon still needs a mark; the English name "Merge Blocks" needs a second lockup; the lettering is real type work |
| D. **Hybrid (recommended)** | The mascot as the icon/mark + the custom wordmark as the lockup + the current 4→16 symbol as the machine's badge | The pull of the face, the identity of the wordmark, the scalability of the symbol; a system, not one picture | The most work; needs a strong hand on the character and the type; the owner must like the face |

## Recommendation

**D. A small brand system, not a single picture:**

1. **The mark**: "Máy Ghép", a warm little machine. A block-shaped head (the 16 as its face plate),
   two pressure-gauge eyes whose needles are the pupils, a chute mouth, gear ears, the loader rail
   as its base. Drawn in the game's palette (cream, orange, brass, dark), with a silhouette that
   reads at 32 px. It can be animated with two or three states (idle, pressure-full, jammed) in
   the title screen and the OG.
2. **The wordmark**: "Ghép Khối" in a custom, blocky Be Vietnam Pro-derived lettering; the "ố" or
   the "K" carries a gear tooth; the "ế" can be a block; the wordmark is the title's name beside
   the mark, not inside the icon.
3. **The badge**: the current 4→16 + gear + rail stays as the machine's stamp (the favicon detail,
   the ticket, the OG corner), so the work already done is not wasted.
4. **The system**: the lockup (mark + wordmark), the icon (the mark), the wordmark alone, the
   monochrome, the light/dark, the sizes (32, 96, 192, 512, 1200×630), the OG/catalog/title/
   favicon/PWA, the docs. The title screen uses the mark + wordmark; the catalog uses the mark;
   the OG uses the lockup; the ticket uses the badge.

Why the mascot: the game already has a machine with pressure, a shake, a chute and a safety line;
giving it eyes is the cheapest, warmest way to make the brand characterful, and the machine can
react in the UI (the first-run, the order, the daily) without a second character. The family and
the children are the audience; the Tò He brand is warm and handmade. The risk is taste: the
character must be **dry and charming**, not a generic robot; the owner's review is the gate.

## What the owner must decide (D-09/D-10)

- The direction: A, B, C or D (the recommendation is D).
- The mascot's presence: only the icon/OG, or also the title's animation, the how-to, the game over,
  the daily card, the order cards? (Start with the icon + title + OG; add the UI later.)
- The wordmark: Vietnamese only, or a second English lockup for the catalog? (The icon is
  language-neutral; the wordmark can be vi-first.)
- The palette: keep the current sunset/machine palette, or give the brand its own (the game's five
  block palettes stay a player setting).

## Deliverables and standards

- Vector SVG for the mark, the wordmark, the lockup and the monochrome; PNG/OG at 1200×630.
- Readable at 32 (favicon/catalog), 96 (hub card), 192 (PWA), 512 (store/OG), in light and dark.
- The mark's silhouette test (black fill) and the 32 px test; the wordmark's diacritics at 32.
- The title screen's mark can use CSS/SVG animation only (the menu stage has no canvas, ADR 0020);
  the in-game reactions go through the Phaser view.
- The Asset Studio may hold the final SVG/animation as a pack (ADR 0051) or the game's public
  folder; decide in D-09.

## What would change my mind

- The owner dislikes a face on the machine: go **C** (wordmark + the 4→16 badge) and keep the
  character in the copy/UI, not the logo.
- A playtest of the mascot reads as "for babies" to the adults: make the face drier (half-lidded
  gauge eyes, a small mouth), or go **B** and put the character in the workshop only.
- The 32 px face fails: simplify the mark to the **block + gauge eyes** only, no gear ears.
