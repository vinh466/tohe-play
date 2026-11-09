# Plan — Vân Du Ký (RPG thẻ bài treo máy)

- Goal: Một RPG thẻ bài treo máy phone-first cho Tò He — **Vân Du Ký**, một đoàn thám hiểm đi qua thế giới fantasy gốc, **main zone là bàn đánh bài** tự động đánh qua màn, tiến trình dài là trục chính, phiên ngắn một tay, và nội dung mở rộng được lâu dài.
- Phase: **Graduate** — v1.0.0 is implemented and green; it waits on the owner's release word (merge/tag/deploy). The ledger is [EXECUTION.md](EXECUTION.md). ([process](../README.md#phases))
- Started: 2026-11-09 · Branch: `feat/van-du-ky-core` · PR: chưa mở
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md) · Execution: [EXECUTION.md](EXECUTION.md)

## Decided so far

- **D-01**: **Đoàn Thám Hiểm** — không nhà, không camp; **main zone là bàn đánh bài**, tự đánh qua màn; board các card đánh nhau. (owner, 2026-11-09)
- **D-02**: **Mở rộng nền tảng trước**; gói cụ thể ở D-17. (owner, 2026-11-09)
- **D-04**: **Round-based auto**; auto đánh thường + auto cast skill, có toggle tắt auto cast để tự cast. (owner, 2026-11-09)
- **D-05**: **6 hero / 3 hàng**, 4 role, 4 element, 3 rarity, 4 gear slot, 1 basic + 1 active + 1 passive, bond pairs, 5 stats. (owner, 2026-11-09)
- **D-06**: **company level + star + gear** — 3 trục; không level từng hero, không prestige ở v1. (owner, 2026-11-09)
- **D-07**: **offline vẫn đánh** + **earned gacha + pity** — shards from play, 10-pull, pity 10/50, duplicates → shards; no money. (owner, 2026-11-09)
- **D-08**: **codex + bonds + company rank + local records**; không home. (owner, 2026-11-09)
- **D-09**: **auto-advance + farm**, **4 vùng × 12 = 48 stage**, 4 boss, tower 40, daily expedition, world boss, **2 event**. (owner, 2026-11-09)
- **D-10**: **daily nhẹ** — 3 task, 1 expedition, 1 boss; không energy, không streak phạt. (owner, 2026-11-09)
- **D-11**: **TS catalogs + balance sim** — content là data có kiểu, Zod/reference check trong test. (owner, 2026-11-09)
- **D-12**: board v3 approved — 3 hàng / 6 hero, full info, dock/sheets, dark-first. (owner, 2026-11-09)
- **D-13**: **card-on-board** + **dark-first**; pixel art; card lao vào nhau, hit-stop/damage/shatter. (owner, 2026-11-09)
- **D-14**: tên game **Vân Du Ký** — ký sự đoàn người đi trên con đường mây. (owner, 2026-11-09)
- **D-15**: **chỉ SFX**, không music. (owner, 2026-11-09)
- **D-03**: **hybrid Phaser board + DOM sheets**; pixelfx sprite sheets + E-03; prototype crit-hit. (owner, 2026-11-09)
- **D-16**: **thêm nội dung** — 4 vùng × 12, **20 hero, 20 quái, 4 boss, 2 event** (~2 tuần); không PvP/guild/ranked. (owner, 2026-11-09)
- **D-17**: **P0 tối thiểu** — persistent shell (E-01) + asset on-demand + save 256 KB; content packs để P1; không music. (owner, 2026-11-09)
- **E-01**: nằm trong P0; shell có option `persistent`, bỏ "Ván mới". (owner, 2026-11-09)
- **E-03**: kit FX player cho sprite sheet + act timing. (owner, 2026-11-09)

## Next — one item

**Release v1.0.0.** The release candidate is green: 48 stages, 20 heroes, 20 enemies + 4 bosses, 10 bonds, tower/daily/boss/challenge, save v2, 44 portraits, public pages/OG, `pnpm verify` and all-game conformance. Nothing is merged, tagged or deployed until the owner says so.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | Định vị, người chơi và lời hứa | decision | **decided** | — |
| D-02 | Độ tương thích với nền tảng Tò He và các giới hạn | decision | **decided** (extend) | D-01 |
| D-03 | Nền tảng kỹ thuật: engine, render, save, dữ liệu | decision | **decided** (hybrid + E-03) | D-17, D-04 |
| D-04 | Core loop & mô hình chiến đấu | decision | **decided** | D-01 |
| D-05 | Card/character core: 6 hero/3 hàng, vai trò, hệ, kỹ năng, đội hình | decision | **decided** | D-04 |
| D-06 | Hệ thống phát triển và đường cong sức mạnh | decision | **decided** (company + star + gear) | D-05, D-17 |
| D-07 | Kinh tế, summon, phần thưởng idle và nhịp tiến trình | decision | **decided** (offline + earned gacha) | D-06 |
| D-08 | Lớp meta: codex, bonds, company rank; **no home** | decision | **decided** (codex + bonds + rank) | D-01, D-06 |
| D-09 | Khung nội dung: 4 vùng × 12, boss, tower, event | decision | **decided** | D-04, D-05, D-06 |
| D-10 | Nhịp chơi hằng ngày và cấu trúc live | decision | **decided** (daily nhẹ) | D-07, D-09 |
| D-11 | Pipeline sản xuất nội dung (data-driven) | decision | **decided** (TS catalogs + sim) | D-03, D-09 |
| D-12 | UX: một bàn đánh bài, panel mở trên đó; formation 3 hàng/6 hero | decision | **decided** | D-05, D-08, D-10, E-01 |
| D-13 | Art direction & cảm giác chiến đấu | decision | **decided** (card-on-board, dark-first) | D-01, D-05, D-12 |
| D-14 | Thế giới, thème và tên game | decision | **decided** (Vân Du Ký) | D-01 |
| D-15 | Âm thanh, haptics và cảm giác chạm | decision | **decided** (chỉ SFX) | D-12, D-13 |
| D-16 | Phạm vi v1, phasing và bộ wireframe | decision | **decided** (thêm nội dung) | D-04, D-07, D-10, D-12, D-13, D-17, E-03 |
| D-17 | Gói platform extension: P0/P1/P2 | decision | **decided** (P0, no music) | D-02 |
| E-01 | Kit: shell cho game persistent (bỏ "Ván mới") | enhancement | **decided** (P0) | D-17 |
| E-03 | Kit: FX player cho sprite sheet + act timing | enhancement | **decided** | D-03, D-13 |

## Research so far

- [R-01 — Genre landscape](research/R-01-genre.md): AFK, Idle Heroes, Summoners War, Epic Seven, Legend of Mushroom, Hero Wars/MU; what to take/avoid.
- [R-02 — Progression & economy](research/R-02-progression-economy.md): 12 h idle chest, no energy, 3 growth axes, pacing.
- [R-03 — Battle & card UX](research/R-03-battle-card-ux.md): auto + manual override; card width math; pixel specs.
- [R-04 — Platform fit](research/R-04-platform-fit.md): current facts; 64 KB/4.5 MB estimates; the persistent-shell gap.
- [R-05 — Platform extension options](research/R-05-platform-extension.md): P0/P1/P2, costs, what the game can rely on.
- [R-06 — Main-screen auto-battler UX](research/R-06-main-screen-ux.md): board as the app, bottom dock + sheets, auto-advance, offline return.
- [R-07 — Formation: rows, ranks and what they buy](research/R-07-formation.md): 3 rows / 6 heroes chosen; density costs.
- [R-08 — Pixel FX: pixelfx, sprite sheets and the platform](research/R-08-pixel-fx.md): MIT, 244 effects, act timing; measured sizes; sprite sheets + E-03.

## Wireframe

- [board-v1.html](wireframes/board-v1.html) — history: one row of four.
- [board-v2.html](wireframes/board-v2.html) — history: 2×2 per side.
- [board-v3.html](wireframes/board-v3.html) — current: 3 rows / 6 heroes, card-on-board, dark-first; board, formation, stage preview, boss.

## Graduation list

The brief is confirmed. Phase 5 *Graduate* starts when the owner says; the 20/20/4 roster and the 2 events can be tuned before art lock.

Platform P0, in order:

1. **ADR + contract + API + hub + conformance**: save envelope 256 KB (D-17).
2. **ADR + contract + Studio + hub + conformance**: asset `on-demand` delivery (D-17, ADR 0051's future values).
3. **Kit PR**: E-01 persistent shell (no "Ván mới").
4. **Kit PR**: E-03 FX player (sprite sheet + act timing).

Game, in order:

5. `games/van-du-ky/SPEC.md` — board, 6v6/3 rows, progression, 4 regions/48 stages, save.
6. Content schema + catalogs + Zod tests + reference checks + balance sim (D-11).
7. Battle prototype + one pixelfx crit-hit (D-03/D-13/E-03); gate at 360×640, 60 fps.
8. Meta slice: save envelope, company/star/gear, summon, codex, daily.
9. Content: region 1 → 4; 20 heroes/20 enemies/4 bosses/2 events; art packs; sim.
10. Polish: FX set, SFX/haptics, onboarding, credits, conformance.

Docs to update in the same PRs: Game Contract (save/asset delivery), Asset Studio (on-demand), Game shell (persistent), and the new ADRs.
