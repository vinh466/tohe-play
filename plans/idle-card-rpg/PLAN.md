# Plan — RPG thẻ bài treo máy (working title)

- Goal: Một RPG thẻ bài treo máy phone-first cho Tò He — một đoàn thám hiểm đi qua thế giới fantasy gốc, **main zone là bàn đánh bài** tự động đánh qua màn, tiến trình dài là trục chính, phiên ngắn một tay, và nội dung mở rộng được lâu dài.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-09 · Branch: `plan/idle-card-rpg` · PR: chưa mở
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)

## Decided so far

- **D-01**: **Đoàn Thám Hiểm** — không nhà, không camp; **main zone là bàn đánh bài**, tự đánh qua màn kiểu Legend of Mushroom; phong cách board các card đánh nhau. (owner, 2026-11-09)
- **D-02**: **Mở rộng nền tảng trước**; gói cụ thể ở D-17. (owner, 2026-11-09)
- **D-04**: **Round-based auto**; auto đánh thường + auto cast skill, có toggle tắt auto cast để tự cast. (owner, 2026-11-09)
- **D-05**: **4 hero**, **4 role** (Vanguard/Blade/Seer/Binder), **4 element** (Ember/Tide/Stone/Gale). (owner, 2026-11-09)
- **D-06**: **company level + star + gear** — 3 trục; company level dùng chung, star 1–5, gear 4 slot set 2; không level từng hero, không prestige ở v1. (owner, 2026-11-09)
- **D-07**: **offline vẫn đánh** — đoàn tự farm màn cao nhất khi đóng app, cap 12 h, summary card. (owner, 2026-11-09)
- **D-09**: **auto-advance + farm** — board tự đánh qua màn; thua thì farm màn cao nhất; có stage picker. (owner, 2026-11-09)
- **D-12 (board)**: bố cục board ổn; **formation phải nhiều hàng cho cả ta lẫn quái** — đang research 2×2 per side (R-07). (owner, 2026-11-09)
- **D-17**: **P0 tối thiểu** — persistent shell (E-01) + asset on-demand + save envelope 256 KB + music helper; content packs để P1. (owner, 2026-11-09)
- **E-01**: nằm trong P0; shell của game-kit có option `persistent`, bỏ "Ván mới". (owner, 2026-11-09)

## Next — one item

**D-12 — dựng wireframe v2 cho formation 2×2.** Chốt 2×2 per side (2 front/2 back, cả ta lẫn quái), rồi vẽ lại board + formation sheet + stage preview. Đây là đầu ra wireframe chính của phase Frame.

## Waiting on the owner

- **D-12**: formation 2×2 per side (2 front, 2 back) — ổn không, hay muốn 3 hàng / 6 hero?
- **D-05**: rarity 3 bậc, gear 4 slot, 1 basic + 1 active + 1 passive, bond pairs — theo đề xuất?
- **D-13**: art direction — dark-first hay cả light/dark; card-on-board hay sprite-on-board?
- **Brief**: xác nhận bản draft (đã bổ sung các quyết định 2026-11-09).

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | Định vị, người chơi và lời hứa | decision | **decided** | — |
| D-02 | Độ tương thích với nền tảng Tò He và các giới hạn | decision | **decided** (extend) | D-01 |
| D-03 | Nền tảng kỹ thuật: engine, render, save, dữ liệu | decision | open | D-17, D-04 |
| D-04 | Core loop & mô hình chiến đấu | decision | **decided** | D-01 |
| D-05 | Card/character core: vai trò, hệ, kỹ năng, đội hình | decision | **researching** (4 hero, 4 role, 4 element decided) | D-04 |
| D-06 | Hệ thống phát triển và đường cong sức mạnh | decision | **decided** (company + star + gear) | D-05, D-17 |
| D-07 | Kinh tế, phần thưởng idle và nhịp tiến trình | decision | **researching** (offline combat decided) | D-06 |
| D-08 | Lớp meta: codex, bonds, company rank; **no home** | decision | **researching** (no home decided) | D-01, D-06 |
| D-09 | Khung nội dung: wave/stage/vùng/boss, auto-advance, chế độ phụ | decision | **researching** (auto-advance + farm decided) | D-04, D-05, D-06 |
| D-10 | Nhịp chơi hằng ngày và cấu trúc live | decision | open | D-07, D-09 |
| D-11 | Pipeline sản xuất nội dung (data-driven) | decision | open | D-03, D-09 |
| D-12 | UX: một bàn đánh bài, panel mở trên đó; formation 2×2 | decision | **researching** (board ok; formation 2×2 proposed) | D-05, D-08, D-10, E-01 |
| D-13 | Art direction & cảm giác chiến đấu | decision | open | D-01, D-05, D-12 |
| D-14 | Thế giới, thème và tên game | decision | open | D-01 |
| D-15 | Âm thanh, haptics và cảm giác chạm | decision | open | D-12, D-13 |
| D-16 | Phạm vi v1, phasing và bộ wireframe | decision | open | D-04, D-07, D-10, D-12, D-13, D-17 |
| D-17 | Gói platform extension: P0/P1/P2 | decision | **decided** (P0) | D-02 |
| E-01 | Kit: shell cho game persistent (bỏ "Ván mới") | enhancement | **decided** (P0) | D-17 |

## Research so far

- [R-01 — Genre landscape](research/R-01-genre.md): AFK, Idle Heroes, Summoners War, Epic Seven, Legend of Mushroom, Hero Wars/MU; what to take/avoid.
- [R-02 — Progression & economy](research/R-02-progression-economy.md): 12 h idle chest, no energy, 3 growth axes, one-week pacing.
- [R-03 — Battle & card UX](research/R-03-battle-card-ux.md): auto + manual override; 4 cards fit a 360 px phone; pixel specs.
- [R-04 — Platform fit](research/R-04-platform-fit.md): current facts; 64 KB/4.5 MB estimates; the persistent-shell gap.
- [R-05 — Platform extension options](research/R-05-platform-extension.md): P0/P1/P2, costs, what the game can rely on.
- [R-06 — Main-screen auto-battler UX](research/R-06-main-screen-ux.md): board as the app, bottom dock + sheets, auto-advance, offline return.
- [R-07 — Formation: rows, ranks and what they buy](research/R-07-formation.md): 2×2 per side; front/back rules; 3 rows needs 6 heroes.

## Wireframe

- [board-v1.html](wireframes/board-v1.html) — first layout (one row of four); history.
- [board-v2.html](wireframes/board-v2.html) — current: 2×2 per side, formation sheet, stage preview, boss board. Screenshot: `/tmp/opencode/wireframe-board-v2.png` (local).

## Graduation list

Điền ở phase 4 (Converge): từng ADR, thay đổi docs và pull request, theo thứ tự, truy về item.
