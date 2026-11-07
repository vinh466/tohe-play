# Brief — Ghép Khối: từ MVP sang trò chơi có lý do quay lại

Status: **draft** — the owner confirms it, and the plan leaves *Frame* when they do.

## Why

The owner played 2.0.1 and said the core is good: "MVP ổn". The next step is not more of the
same core; it is a reason to **start** a run, a reason to **come back tomorrow**, a reason to
**care** about the machine, and a first screen + brand that sell all of that to the family and to
a newcomer. In the owner's words: *dive research and brainstorm so the game can have mechanics,
modes, progression or something, improve UI/UX, and make a more impressive, higher-quality logo
that pulls players in.*

## Constraints in force

- The core stays: fire blocks up into the hanging rack, pressure, the shake, ships, the classic
  endless score. The machine is the game's identity; the new layers grow from it, not beside it.
- The platform: the game never calls the API; `save`, `scores`, `ranked`, `share`, `shell` as
  documented; the console; profiles (a child's profile is a first-class player); the ranked
  verifier replays the game's own logic and moves; the challenge entry; local-first, offline,
  no ads, no IAP, no push notifications.
- The family and a 3-minute session: one hand, portrait, 320–430 px wide, light/dark, reduced
  motion, large text, sound/haptics, Vietnamese and English. Nothing that requires a second
  device or a network round trip to be fun.
- The ranked integrity: the classic run stays ranked and verifiable. New modes are unranked
  unless a contract change (ADR) lands. The owner's word is required for merge/tag/deploy.
- The release road: spec first, tests and conformance, PR, CI, UAT, production, checks.

## Done when

The owner can sit down and:

1. **Play a run of Orders**: three to five orders from the machine ("ship a 64", "ship two 32s",
   "make a 256"), each completed order offering one choice of machine part; the run ends at the
   jam like today; the result prints the completed orders, the shipped blocks and the scrap.
2. **Visit the Workshop**: scrap buys blueprints/cosmetics; the machine levels (Tập sự → Kỹ sư);
   the light meta persists per profile and never makes the ranked classic easier.
3. **Play the Daily Shift**: one seeded run per local day, the same for everyone who opens that
   day, a streak, a share, and a clear "today's board" — unranked, honest about it.
4. **Play Zen**: no pressure, no jam, the same rack; for a child, a tired adult or learning the
   aim; leaves by choice.
5. **Choose all of it from one title screen**: the mascot, Continue, Classic, Orders, Daily,
   Workshop, Leaderboard, Settings; works at 320 px with a thumb; the first-run teaches the
   order, the pressure, the shake and the ship in four beats.
6. **See the brand**: the new mascot + wordmark lockup on the title, catalog, OG, favicon/PWA and
   docs; reviewed at 32, 96, 512 and in light/dark; it reads as "a warm machine that merges
   blocks", not "a gear with a 16".
7. **Read the result**: the telemetry names the funnel (title → first shot → first merge → first
   shake → first ship → first order → workshop → daily) and the health report can answer whether
   the first run completed, whether the daily brought someone back, and which mode/part is chosen.

And the classic ranked run, its replay/verify, the challenge, the saves, the conformance and the
UAT/production checks still pass.

## Not this plan

- Real-time versus or rooms (the platform's rooms; a later plan/ADR), a global server-side daily
  leaderboard (unless D-05 decides it), or any IAP/ads/coins/push.
- The full campaign/story world, voice acting, mascot shorts, or a bespoke art pipeline; the
  Asset Studio's own work; the engine or the other games.
- A grind that makes the child play longer than the family wants, or a meta that changes the
  ranked classic.
