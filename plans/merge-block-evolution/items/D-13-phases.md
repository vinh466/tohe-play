# D-13 — The phase split and the first slice

Status: open. Kind: decision.

## Question

How do we split the evolution into shippable slices so the owner can play each one and the game
never spends a long time half-reworked?

## Options

| Option | 2.1 | 2.2 | 2.3 | 3.0 |
|---|---|---|---|---|
| **A. The full loop, phased (recommended)** | Brand + title/mode select + Orders + light Workshop | Daily + achievements + telemetry + onboarding polish | Mascot UI reactions + cosmetics + Zen + balance | Versus/rooms, server daily, campaign — a later plan |
| B. Brand first, then the loops | Brand + title | Orders + Workshop | Daily + Zen | — |
| C. One big 2.1 | Everything | — | — | — |
| D. Daily first | Daily + title | Orders + Workshop | Brand + mascot | — |

## Recommendation

**A.** 2.1 is the smallest version that answers the three questions (start: Orders; differ: parts;
return: Workshop + the promise of the daily); 2.2 is the habit and the measurement; 2.3 is the
warmth and the low-pressure door. Each phase ships to UAT and prod behind the owner's word, with
its own spec section, tests, conformance and release. The classic ranked game is in every phase and
never waits for the new layers.

The first slice's done-when:
- The title/mode select (Classic, Orders, Daily [card, "coming in 2.2"], Workshop [the light],
  Settings, How to play) — or the Daily hidden until 2.2 if the owner prefers no "coming soon".
- A 3-order Orders run with the 1-of-3 parts, the order rail, the ticket, the scrap.
- The Workshop's three slots and the machine level.
- The brand mark + wordmark on the title/catalog/OG/favicon.
- The classic unchanged; the ranked/verify/replay pass; the saves v3; the 320/light/dark checks.

## Discussion

- **owner** (2026-11-08): the evolution brief; no phase preference yet.
- **agent**: the phased recommendation; the plan's `PLAN` board.

## Cost

The 2.1 slice is the largest; 2.2/2.3 are smaller. The owner's time to play each phase is the real
constraint; the plan can graduate the 2.1 spec once D-01/D-09 are decided.

## What would change my mind

- The owner wants a quick win: B (brand first).
- The daily is the priority: D.
- The family finds the Orders too much: 2.1 keeps the classic + the brand, and the Orders move to
  2.2.
