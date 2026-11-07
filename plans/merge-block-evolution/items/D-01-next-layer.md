# D-01 — The next layer and its order

Status: **proposed** — the owner's priority is the first call. Kind: decision.

## Question

The MVP is good ("MVP ổn", owner, 2026-11-08). Which layer comes first, and how much of it: the
brand + Orders + Workshop, the Daily, the brand alone, or everything?

## Options

| Option | What the first slice is | The pull | The cost | The risk |
|---|---|---|---|---|
| **A. Brand + Orders + Workshop (light)** | The mascot + wordmark; the title/mode select; a 3–5 order run with 1-of-3 parts; a light Workshop (scrap/cosmetics/levels; stat parts in Orders only); the classic untouched | The strongest loop: a reason to start, a different run, a reason to return; the brand sells it | The largest of the first slices; the run/save/UI/balance | The classic could feel flat; the parts' balance |
| **B. Daily Shift** | A local seeded daily, a streak, a share; the current title | The habit; cheap; a reason to open every day | Small | A daily without the Orders is a score chase; the habit may not stick |
| **C. Brand + title/mode select only** | The mascot + wordmark; the mode cards; the classic | The first impression; the pull; quick | The visual work; the owner's taste | A pretty shell over the same game; the retention does not move |
| **D. A, then B, then Zen** | The phased full loop | The start, the difference, the return, the relax | More time; more states; the ranked boundary | Scope; the family's attention |

## Recommendation

**D, phased** (see [D-13](D-13-phases.md)):

1. **2.1**: brand + title/mode select + the Orders run + the light Workshop. The classic stays the
   same and ranked; the Orders are unranked; the parts are Orders-only.
2. **2.2**: the Daily Shift (local seed/date, streak, share), the achievements/telemetry, the
   game-over story, the onboarding polish.
3. **2.3**: the mascot's UI reactions, the cosmetics, the Zen, the balance after a fortnight on UAT.
4. **3.0** (a later plan): the versus/rooms, a server-side daily board, or a full campaign — only
   if the family asks.

Why this order: the brand + Orders + Workshop is the change that answers all three "why" questions
(start, differ, return); the Daily is the habit on top; the Zen is the low-pressure door. Doing the
Daily first would test the habit without the reason to play; doing the brand alone would not move
the retention.

## Discussion

- **owner** (2026-11-08): "MVP ổn nha, giờ là mvp ổn, từ đây bạn có thể dive research và brainstorm
  để trò chơi có thể có cơ chế, chế độ, tiến trình hay sao đó, và cải thiện UIUX, tham khảo làm logo
  ấn tượng có chất hơn để hút người chơi đi." — the intent; the priority is not stated yet.
- **agent** (2026-11-08): the recommendation above; the research in R-01/R-02/R-03/R-04/R-05.

## Cost

The 2.1 slice: the run logic (orders/parts), the save v3, the title/mode select, the Orders HUD,
the choice sheet, the Workshop (light), the brand mark/wordmark, the tests and the release. It is
the largest one-slice change since the core; the owner's time and the family's playtest are the
gate.

## What would change my mind

- The owner wants the quickest visible change: C first, A second.
- A family playtest shows the Orders/parts make the classic feel pointless: keep the Orders as a
  light "shift" wrapper, drop the stat parts.
- The daily is the owner's priority: B first, A second; the Daily is cheaper and can carry the
  habit while the Orders bake.
