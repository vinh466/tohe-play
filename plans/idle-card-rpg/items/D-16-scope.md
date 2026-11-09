# D-16 — V1 scope, milestones and graduation

**Status:** decided — owner chose **thêm nội dung** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-04, D-07, D-10, D-12, D-13, D-17, E-03

## Decision (owner's words)

> "Thêm nội dung"

The v1 is **larger than the 3-region baseline**:

| Piece | V1 |
|---|---|
| **Regions** | **4 regions × 12 stages = 48 stages**; 4 region bosses |
| **Heroes** | **20** in the roster; 6 in the team (3 rows × 2 columns) |
| **Enemies** | 20 enemy types; 4 boss types |
| **Progression** | company level 1–20, star 1–5, gear 4 slots; 3 axes |
| **Modes** | campaign/auto-advance, tower 40 floors, daily expedition, weekly world boss |
| **Meta** | codex 20 heroes / 20 enemies / 4 regions; 10 bond pairs; company rank; local records |
| **Daily** | 3 tasks, 1 expedition, 1 boss; no energy/streak punishment |
| **Events** | 2: **Khởi Hành** (7-day launch journey) and **Thử Thách Đường Mây** (weekly rotating challenge with modifiers) |
| **Battle** | 6v6, 3 rows, round-based auto + manual skill toggle |
| **Art** | pixel card-on-board, dark-first; 20 hero cards, 20 enemy cards, 4 boss cards, 4 region backdrops; ~2 MB FX on-demand |
| **Audio** | SFX only, no music |
| **Platform** | P0: E-01 persistent shell, asset on-demand, save envelope 256 KB, E-03 FX player |
| **Not v1** | PvP, guild, chat, ranked/public boards, real-time events, content packs, push, light theme |

**Content duration target:** ~2 weeks at 2–3 short sessions a day. The owner chose 20 heroes / 20 enemies / 4 bosses / 2 events; the cost is more art, more balance and a longer build.

## Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 — Frame/Resolve** | This plan, wireframe v3, decisions | Brief confirmed (owner deferred; revisit) |
| **M1 — Platform P0** | E-01 persistent shell; asset on-demand; save envelope 256 KB; E-03 FX player | Contract/conformance tests; kit tests |
| **M2 — Battle prototype** | 6v6 board, 3 rows, auto + manual toggle, one pixelfx crit-hit, hit-stop/shake/push | 60 fps on a mid-range phone; 360×640 readability |
| **M3 — Meta slice** | Company level, star, gear, summon, codex, daily, save/migrations | Save round-trip; no lost progress |
| **M4 — Content slice** | Region 1 (12 stages), 6 heroes, 1 boss, tower 10, daily | Balance sim passes; one week of tuning |
| **M5 — Content full** | 4 regions, 20 heroes, 20 enemies, 4 bosses, tower 40, world boss, 2 events | Sim; content tests; art packs |
| **M6 — Polish** | FX set, SFX, haptics, onboarding, credits, conformance | `pnpm verify` + conformance + phone playtest |

## Graduation list (provisional)

Platform, in order:

1. **ADR + contract + API + hub + conformance**: save envelope 256 KB (D-17).
2. **ADR + contract + Studio + hub + conformance**: asset `on-demand` delivery (D-17, ADR 0051's future values).
3. **Kit PR**: E-01 persistent shell (no "Ván mới").
4. **Kit PR**: E-03 FX player (sprite sheet + act timing).
5. **Docs**: update Game Contract, asset Studio, game shell; add the ADRs.

Game, in order:

6. `games/van-du-ky/SPEC.md` — the game's spec: board, 6v6, 3 rows, progression, content, save.
7. Content schema + catalogs + Zod tests + reference checks (D-11).
8. Battle prototype + one pixelfx effect (D-03/D-13/E-03).
9. Meta slice: save envelope, company/star/gear, summon, codex, daily.
10. Content: region 1 → 4; art packs; balance sim.
11. Polishing: FX set, SFX/haptics, onboarding, credits, conformance.

## What is deliberately out

- PvP, guild, chat, social feed.
- Public leaderboards/ranked in v1; local records only.
- Content packs/remote content (P1); v1 content ships in the immutable build.
- Push notifications, live-ops calendar, seasonal events.
- Music, light theme, native app, 3D.
- A full base/camp/home.

## Open

- The exact 20-hero/20-enemy roster and the 2 events' content; owner can adjust before M4.
- The 7-day Khởi Hành tasks/rewards; the weekly challenge's modifiers.
- Whether tower is 40 floors or "40 at launch, scaling" (proposed).
- The content duration target (~2 weeks) and the balance sim before art lock.

## Evidence

- Owner's words, 2026-11-09.
- All decided items: D-01…D-15, D-17, E-01, E-03.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): the 2-week target.
- [R-08 — Pixel FX](../research/R-08-pixel-fx.md): FX budget.

## Discussion

**owner (2026-11-09):** chose "Thêm nội dung" (4 regions × 12), then **20 heroes / 20 enemies / 4 bosses / 2 events**.

**agent (2026-11-09):** recorded. This is a big v1: 48 stages, 20 heroes, 20 enemies, 4 bosses, 4 backdrops, 10 bonds, 40 tower floors and 2 events. It is achievable because the card-on-board art is cheap and assets are on-demand, but the balance sim and content tests become the gate. If the art/balance slips, the first cut is the second event, not the core board.
