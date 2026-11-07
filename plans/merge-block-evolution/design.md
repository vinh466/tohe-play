# Design — Ghép Khối: the evolution (v0, taking shape)

This page **composes** the items into one picture. It decides nothing: every claim points at the
item that decides it, and *(proposed)* marks an item not yet `decided`. Date: 2026-11-08.

## Short answer: how complete is it?

The core is settled (2.0.1, owner-approved) and the research is in place. The shape below is a
recommendation, not a decision: D-01, D-09 and D-13 are the owner's call; D-02…D-08 and D-10…D-12
are open. The first slice can be built once D-01/D-09/D-13 are decided.

## 1. The picture

```text
TITLE (mascot + mode cards)                       WORKSHOP (light meta)
  ├─ Chơi tiếp (last run)                            ├─ scrap → blueprints / cosmetics
  ├─ Cổ điển (ranked endless)                        ├─ machine levels: Tập sự → Kỹ sư
  ├─ Ca làm (Orders, unranked)                       └─ stats/sidegrades only in Orders
  ├─ Ca hôm nay (Daily, unranked)
  ├─ Thư giãn (Zen)
  ├─ Xưởng · Bảng · Cài đặt · Cách chơi · Về Tò He
  └─ four-beat onboarding the first time

CA LÀM (Orders)                          CỔ ĐIỂN (today's core)
  3–5 orders from the machine              the same endless run
  → ship goals → one part of three         ranked, verified, replayable
  → run ends at the jam                    challenge/share
  → ticket: orders, shipped, scrap
  → scrap → Workshop
```

The machine is the same machine in every mode; the modes change the **goal** and the **pressure**,
not the physics.

## 2. The pieces, the standard behind each, and where each lives

| Piece | Does | Standard / prior art | Lives in | Item |
|---|---|---|---|---|
| Orders | 3–5 ship goals per run, escalating, with a short line from the machine | Number Shoot's goal block; Ball Blast's waves; a postal shift | run logic + HUD | D-02 |
| In-run parts | After an order, choose 1 of 3 parts (pressure tank, chute, spring, sorter, magnet, lubricant, combo gear, safety rail, extra bay) | Roguelite-lite (Ball Blast, Brotato, Vampire Survivors), reduced to a 3-minute run | run logic + a choice sheet | D-03 |
| Workshop | Scrap, blueprints, machine levels, cosmetics, sidegrades | Merge/casual meta, but light: no energy, no timers, no purchase | save + a screen | D-04 |
| Daily Shift | One seeded run per local day, a streak, a share, later a board | 2048/Wordle daily; Suika's score chase | daily seed + save | D-05 |
| Zen | The same rack without pressure/jam | A child's free play; a cozy mode | mode flag | D-06 |
| Modes + title | One screen that sells the choice; Continue | The platform's shell, one primary action | menu stage | D-06, D-07 |
| Onboarding | Four beats: aim/fire, merge, pressure→shake, ship→order | The current how-to, extended progressively | first-run | D-07 |
| Brand | Mascot "Máy Ghép" + "Ghép Khối" wordmark lockup; 32/96/512; light/dark | Mascot brands (Crossy Road, Cut the Rope), premium marks (Monument Valley, Alto), the Tò He family | icon, title, catalog, OG, favicon | D-09, D-10 |
| Telemetry | The funnel and retention events, opt-in, child-safe | The platform's ADR 0015 + the health report | telemetry calls | D-11 |
| Contract | Save v3, ranked classic only, challenge/entry v3, daily seed | The platform's Game Contract | save/ranked/share | D-12 |

## 3. The main flows

**First run (4 beats + one order).** Title → "Chơi" → the machine points at the loader: fire one
block, merge one pair, fill the gauge until the shake, ship one 8/16. The machine gives the first
order ("Xuất một khối 16"). Complete it → the ticket → one part of three → the Workshop is
unlocked (scrap). The run continues until the jam or the player leaves; the result says what was
shipped and what was earned.

**A Ca làm (Orders) run.** The title's "Ca làm" → the machine's shift card: three orders for this
run (e.g., 16, 64, "two 32s") → the HUD's order rail (the current order, progress, reward) → each
completed order pauses briefly, offers one part of three, and the next order arrives. The run ends
at the jam; the ticket prints orders completed, blocks shipped, scrap, and the machine's line. The
scrap goes to the Workshop; the parts and the order set make the next run different.

**The classic.** The title's "Cổ điển" → the current 2.0.1 game, unchanged: ranked, verified,
replayable, challengeable. The Workshop's stat parts **never** apply here; cosmetics may (the
block palette, the machine skin) because they do not change the rules.

**The Daily Shift.** The title's "Ca hôm nay" card: the local date, today's seed, the streak, the
best today, a "Chia sẻ" button. The seed is derived from the local date; everyone who opens that
day gets the same blocks. The run is unranked; the score is kept per day/profile; the share is a
v2/v3 challenge-style link or a text card. A server board is a later phase (D-05).

**Zen.** The title's "Thư giãn" → the rack with pressure off and the jam off; the same aim and
merge; a quiet palette; leaves by choice. For learning, for a child, for a bad day.

**The Workshop.** From the title or the ticket: the machine in the middle, the scrap counter, the
blueprints; a tap on a part shows what it does and what it costs; buying is permanent (the light
meta); the machine levels up with XP from runs/orders. The Workshop is **not** a shop: no money, no
timers.

## 4. Still open

- D-01: the first slice and the order of the layers.
- D-02: the exact order set, the escalation, the run's end (the jam; or also a "shift complete"?).
- D-03: the part list, the balance, and whether the parts are permanent or per run.
- D-04: the meta's weight: cosmetics/stamps only, or stat sidegrades too; the machine levels.
- D-05: the daily's board and the timezone; the local vs server.
- D-06: whether Versus/Ghost is in or after; the Zen's exact rules.
- D-08: the HUD space for the order rail at 320 px; the Workshop's mobile layout.
- D-09/D-10: the logo direction and the mascot's presence.
- D-12: the save version, the ranked boundary, the challenge/entry version, the daily seed.
- D-13: the phase split and the owner's time.

## 5. Known risks without an answer yet

| Risk | Where it will be answered |
|---|---|
| The Orders/parts make the run too easy or too random; the classic feels better | D-02/D-03, the random-play bot + the owner's playtest |
| The Workshop turns into a grind or makes the classic unfair | D-04, the ranked boundary (D-12) |
| The daily's local date/seed is exploitable or the server board is too much | D-05, D-12 |
| The title grows into a wall of cards; a newcomer still doesn't start | D-06/D-07, the onboarding + the 320 screenshots |
| The mascot is too childish for the adults or too complex at 32 px | D-09/D-10, the owner's review at 32/96/512 |
| The new layers break the ranked verifier/replay or the save | D-12, the conformance + the API tests |
| The telemetry becomes surveillance or a child sees it | D-11, the platform's privacy/child rules |
| The scope grows; the first slice slips | D-13, the phase split |
