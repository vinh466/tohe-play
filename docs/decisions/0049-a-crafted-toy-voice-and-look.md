---
title: "0049: Make Tò He look and talk like a toy someone made — one icon set, its own type, a tò he palette, drawn pictures"
description: "Tò He drops the defaults that make it read as machine-made — emoji as interface, a borrowed palette, the system font, templated copy. One SVG icon set with labels, Be Vietnam Pro, a voice guide every screen passes, and a brand drawn from the tò he toy itself: a palette from its traditional dyes and pictures drawn by an illustrator."
sidebar:
  order: 49
---

- **Status:** Accepted — steps S1 and S2 in place or building; S3 waits for the illustrator's pictures
- **Date:** 2026-10-24
- **Decided by:** the owner, 2026-10-24, on the launch review's item D-07 (plans/launch-review): "chốt theo đề xuất
  nha, bạn triển nghiêm túc đi" — every proposal of D-07 as written: direction A, *Xưởng tò he*, reached in three steps;
  an illustrator hired from the agent's brief; the palette re-derived from the toy's dyes; Be Vietnam Pro; Phosphor
  icons; the voice written and applied by the agent.

## Context

- The owner (2026-10-23): "làm kỹ thay đổi để bớt AI style đi … để phục vụ cho người dùng tốt hơn". A survey of
  production and two research rounds (`plans/launch-review/research/R-07-ai-style.md`, `R-09`) found the tells of a
  machine-made interface on almost every screen: emoji as icons (tabs, buttons, a game's logo), everything a centred
  white card, Tailwind's orange ramp as the brand, the system font, copy joined by "·" triads and long dashes, a random
  guest name that did not match its avatar.
- Children read little and expect pictures, sound and movement; parents notice the generic and leave (NN/g, Toca Boca,
  Sago Mini, Poki — R-07 §1). The name already holds a brand: tò he, the rice-dough figurines of Xuân La, coloured with
  plant dyes (yellow, gấc red, leaf green, soot black).
- Copy is the agent's to write (the owner's earlier decision); the terms and the privacy notice wait for their review
  (launch review E-05).

## Decision

### Voice

`docs/conventions/voice-and-look.md` is the rule and the checklist for every screen and every string: talk like
family, Vietnamese first; active voice; everyday words; "·" only in rows of data; at most one long dash a screen;
sentence case; nothing internal (SHA, "game mẫu", contracts) on a player's surface; the parent's material where parents
look. The Definition of Done includes the checklist.

### Look

- **One icon set, always labelled**: Phosphor (MIT), regular and fill weights, drawn as SVG by the hub, the public pages
  and the game kit. No emoji acts as interface anywhere; emoji remain only as content a person chose.
- **Type**: Be Vietnam Pro (OFL), self-hosted from `packages/design-tokens` as `--tohe-font`, for the hub, the public
  pages and the game kit. A rounded display face for titles may join it in step S3, chosen only with complete
  Vietnamese diacritics.
- **Palette** *(step S3)*: the design tokens are re-derived from the toy's dyes — a rice-white page, gấc red as the
  brand colour, leaf green, yolk yellow, soot-black ink — keeping the contrast rules `contrast.test.ts` checks in light
  and dark. Until then the tokens keep their values and the brand colour is used for actions only.
- **Pictures** *(step S3)*: drawn by an illustrator from a brief the agent writes (`plans/launch-review/illustrator-brief.md`):
  the sixteen profile avatars as tò he figures of the same sixteen animals the suggested names use, one cover per game
  (one figure in front, no text), a mascot for empty and waiting screens, each in light and dark. No machine-generated
  pictures: they are what this decision moves away from, and they do not hold one hand across a set.
- **Movement and sound** *(step S3)*: a press that squeezes like dough, a soft dough tap — through the game kit, with
  the sound setting respected.

### Steps

| Step | What | Where |
| --- | --- | --- |
| S1 | Voice guide, copy, the icon set in the hub and the public pages, Be Vietnam Pro, quieter screens | in place (tohe-play #129, #130) |
| S2 | The game kit's menus: SVG icons with labels, each game's own drawn logo instead of an emoji | building |
| S3 | The tò he palette, the illustrator's avatars, covers and mascot, movement and sound | when the pictures arrive |

## Consequences

- `docs/conventions/voice-and-look.md` binds every pull request that changes a screen or a string; reviews use its
  checklist. Tests already refuse emoji in the hub's interface and in public strings (`voiceAndLook.test.ts`,
  `content.test.ts`).
- `packages/design-tokens` holds the font and, at S3, the new palette — one change for the hub, the public pages, the
  docs and the kit, with the contrast tests.
- `packages/game-kit` draws its menus with the same icons (S2); a game's logo in its title screen is the game's own icon
  art, the one the catalog shows.
- Avatars stay emoji until S3; the suggested names and the avatars already share one list of animals, so the drawn set
  replaces them one for one.
- The owner finds and pays the illustrator; the agent writes the brief, checks the delivered files and wires them in.

## Alternatives considered

- **B — tidy defaults only** (icons, copy, layout; no pictures). Cheap and S1 already did most of it, but it stays
  generic and says nothing of the name. Lost to A, of which it is the first step.
- **C — Đông Hồ woodblock prints.** Texture costs legibility and dark mode, and speaks to parents' nostalgia more than to
  children. Lost.
- **Machine-generated pictures** for S3. Fast, but the opposite of the goal, and a set does not keep one hand. Lost.
- **Keep emoji as icons** because they are free and colourful. Read differently on every system, announced by their
  Unicode names, and the first tell of a template. Lost.
