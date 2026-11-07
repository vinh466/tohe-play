# D-09 — The logo and the brand system

Status: **proposed** — the owner's taste decides. Kind: decision.

## Question

The owner wants a logo "ấn tượng có chất hơn để hút người chơi". Which mark, wordmark and system do
we ship, and where does it live?

## Options

| Option | The mark | Strengths | Costs / risks |
|---|---|---|---|
| A. **Mascot "Máy Ghép"** | The machine's face: a block-shaped head, two gauge eyes, a chute mouth, gear ears, the loader rail | The most pull; a face for the title/OG/catalog; a voice in the UI | A real character design; can read childish; the 32 px face |
| B. **Symbol: block + gear + shot** (the current 4→16 + gear + rail, refined) | One block, a gear, the shot, the rail | Works at 32; premium; quiet | Generic "merge/gear"; the owner already feels it is not enough |
| C. **Wordmark "Ghép Khối"** | Custom lettering: the blocks in the letters, the gear in the "ố" | Ownable, Vietnamese; the title is the brand | The 32 px icon; the English name needs a lockup |
| **D. Hybrid (recommended)** | The mascot as the icon/mark + the custom wordmark + the 4→16 badge | The pull, the identity, the scalability; a system | The most work; the owner must like the face |

## Recommendation

**D**, with this system:

- **Mark**: the mascot's head (the block face + the gauge eyes + the chute/gear/rail), readable in
  a black silhouette at 32 px. Two or three states (idle, pressure-full, jammed) for the title/OG.
- **Wordmark**: "Ghép Khối" custom, blocky, Be Vietnam Pro-derived; the "ố"/"K" with a gear tooth;
  the "ế" can be a block. Vietnamese-first; a second English lockup only if the catalog needs it.
- **Badge**: the current 4→16 + gear + rail stays as the machine's stamp (ticket, daily card, OG
  corner, favicon detail).
- **Sizes/places**: 32 (favicon/catalog), 96 (hub card), 192 (PWA), 512 (store/OG), 1200×630 (OG);
  light/dark; monochrome; the title (mark + wordmark), the catalog (mark), the OG (lockup), the
  ticket (badge), the docs.
- **Motion**: the title can animate the mark with CSS/SVG (the menu stage has no canvas, ADR 0020);
  the in-game reactions (the eyes follow the shot, fill with pressure) are D-10/later.
- **Where it lives**: the game's `public/icon.svg` + an SVG wordmark/lockup beside it; the OG
  generator; the Asset Studio may hold the final pack (ADR 0051) if the owner wants a managed
  asset; the source is vector.

## Discussion

- **owner** (2026-11-08): "logo trông chưa ổn, làm cho nó brand hơn đi" (the 2.0.1 icon was the
  4→16 + gear + rail); then "tham khảo làm logo ấn tượng có chất hơn để hút người chơi đi".
- **agent** (2026-11-08): R-02 recommends the hybrid; the mascot is the pull, the wordmark the
  identity, the badge the continuity.

## Cost

The mascot design (3–4 iterations), the wordmark (the Vietnamese diacritics, 2–3 iterations), the
lockup/sizes/monochrome/light-dark, the title/catalog/OG/favicon/PWA wiring, the owner's review. The
main risk is taste, not technique; the review at 32/96/512 is the gate.

## What would change my mind

- The owner dislikes a face: go C (the wordmark + the badge) and keep the character in the copy/UI.
- The mascot reads "for babies" to the adults: dry the face (half-lidded gauge eyes, a small mouth)
  or keep the character in the Workshop only.
- The 32 px face fails: simplify the mark to the block + the gauge eyes; drop the gear ears.
