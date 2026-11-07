# R-01 — Modes, run structure and progression: what the field does

Status: research note for [D-01](../items/D-01-next-layer.md), [D-02](../items/D-02-orders.md),
[D-03](../items/D-03-parts.md), [D-04](../items/D-04-workshop.md), [D-05](../items/D-05-daily.md),
[D-06](../items/D-06-modes.md). Date: 2026-11-08. Facts from the pages below, assumptions marked.

## The question

The core is a 3-minute endless merge. What run structure and progression can give a family a
reason to start again and come back tomorrow **without** turning the game into a grind, an ad
machine or a second job — and without breaking the ranked classic?

## What the field does

**Number Shoot (UNIT5, 2020).** Combines a bubble shooter with number merging: blocks stack at the
top, the player fires up, matching values merge, chains follow. It adds a **goal block** per stage
("build the 512 to clear"), two boosters (bomb, shuffle), collectable themes and a world ranking.
Fact: stages give every session an end point and a purpose; the boosters are rescue tools, not
the loop. Lesson: **orders/goals** are a proven, light layer for this exact core; the theme
collection is a cosmetic meta the family can like. Source: <https://www.unit5soft.com/games/numbershoot>
(accessed 2026-11-07).

**Drop the Number / X2 Blocks (Superbox).** The genre's baseline: endless columns, drop and merge,
boosters, missions/events, skins, coins, ads/IAP. Fact: the session is endless; the progression is
largely cosmetic/event-driven; the monetization is the ads/IAP the platform forbids. Lesson: take
the **missions/skins** idea, leave the ads/coins; the family can earn a skin by playing, not by
paying. Sources: <https://apps.apple.com/us/app/drop-the-number-merge-puzzle/id1454637812> and the
App Store listing of *X2 Blocks* (accessed 2026-11-07).

**Ball Blast / Fire Up (Voodoo, 2018).** A cannon at the bottom, numbered shapes falling; the run
ends when a shape reaches the cannon; **upgrades** (rapid fire, multi-shot, blast radius, double
damage, ricochet) are picked between waves; every fifth wave is a boss. Fact: the upgrade pick is
the reason a run differs, and the danger line is the same tension as our safety line. Lesson: the
**1-of-3 part** after an order is a compact, readable version of this; the parts should change how
the machine behaves (pressure, chute, sorter), not just a score multiplier. Sources:
<https://pokeyball.web.app/ball-blast> and <https://www.desura.com/fire-up.html> (accessed 2026-11-07).

**Suika Game (2023).** A physics merge toy: drop fruit, merge equal fruit, make a watermelon; no
meta, no levels; the brand is the watermelon and the cozy look; the score is the loop. Fact: a
single, readable core + a mascot/brand can carry a huge audience without progression. Lesson: the
machine and the mascot can be the brand; the progression should stay **optional** for the player
who only wants the classic. Source: the game's store pages and press (accessed 2026-11-07; the
game's exact daily/event features vary by platform — assumption).

**2048 / Threes.** The daily/minimal variant; the score chase; the undo; the simple rules. Fact:
the **daily seed** is a cheap retention habit; the score is the comparison. Lesson: a local daily
seed + a share/streak is enough to test the habit before a server board. Sources:
<https://2048.now/blog/understanding-2048-game-rules-and-mechanics> and the Threes/2048 histories
(accessed 2026-11-07).

**Brotato / Vampire Survivors (2022–2023).** Short runs, in-run choices, a light meta; the build is
the fun. Fact: the "one more run" comes from a **different combination**, not from a longer grind.
Lesson: 3–5 orders × 1-of-3 parts is enough variety for a 3-minute family run; the meta should
unlock **options/cosmetics**, not raw power that breaks the classic.

**The platform (Tò He).** The family, the child profile, the leaderboard, the ranked runs, the
challenge links, the no-ads/no-IAP promise, the offline-first game, the console. The classic run is
the ranked one; the server replays the game's logic. Lesson: the **classic stays ranked and
verifiable**; the new modes are unranked unless a contract change; the child must not be pushed to
play longer than the family wants. Sources: `docs/architecture/game-shell.md`,
`docs/contracts/game-contract-v1.md`, ADR 0014/0030/0032/0045.

## Options

| Option | What it adds | Cost | Risk |
|---|---|---|---|
| A. Orders + 1-of-3 parts + light Workshop | A reason to start, a reason a run differs, a reason to return; the machine's character | The biggest of the three; needs the run/save/UI and the balance | The classic could feel flat; the parts could make the run too easy |
| B. Daily Shift only | The habit; a share; a streak; cheap to build | Less depth per run; the daily can feel like a chore | The local date/seed and the board need a rule |
| C. Brand/logo + title/mode select only | The first impression; the pull; the mascot | The visual work; the owner's taste; the asset pipeline | A pretty shell over the same game; the retention does not move |
| D. A + B + Zen, phased | The full loop: start, differ, return, relax | More time; more states; the ranked boundary | Scope; the family's attention |

## Recommendation

**D, phased: brand + Orders + Workshop (light) first, then Daily + telemetry, then Zen + mascot
polish.** The Orders are the run's reason; the 1-of-3 parts are the variety; the Workshop is the
light meta (cosmetics/stamps first, stat sidegrades only in the unranked Orders); the Daily is the
habit; Zen is the family's low-pressure door. The **classic stays the ranked game**, untouched by
the stat parts. This matches Number Shoot's goals, Ball Blast's parts and the platform's no-IAP
rules.

## What would change my mind

- The owner's priority is a quick visible change: then the **brand + title/mode select** first, the
  Orders second.
- A playtest shows the Orders/parts make the classic feel pointless or the runs too long: drop the
  parts, keep the orders as a "shift" wrapper, or make the parts cosmetic only.
- The daily needs a server board to be meaningful to the family: D-05/D-12 then need an ADR and an
  API slice before the daily ships.

## Assumptions to check

- The family plays in 3-minute sessions on phones; the owner's own playtest is the primary evidence.
- The child's profile plays the same modes; a daily/streak must not become pressure.
- The ranked classic remains the only server-verified mode; the new modes are clearly unranked.
