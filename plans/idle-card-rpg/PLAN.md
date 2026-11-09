# Plan — RPG thẻ bài treo máy (working title)

- Goal: Một RPG thẻ bài treo máy phone-first cho Tò He — một đoàn thám hiểm đi qua thế giới fantasy gốc, **main zone là bàn đánh bài** tự động đánh qua màn, tiến trình dài là trục chính, phiên ngắn một tay, và nội dung mở rộng được lâu dài.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-09 · Branch: `plan/idle-card-rpg` · PR: chưa mở
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)

## Decided so far

- **D-01**: **Đoàn Thám Hiểm** — không nhà, không camp; **main zone là bàn đánh bài**, tự đánh qua màn kiểu Legend of Mushroom; phong cách board các card đánh nhau. (owner, 2026-11-09)
- **D-02**: **Mở rộng nền tảng trước**; gói cụ thể ở D-17. (owner, 2026-11-09)
- **D-04**: **Round-based auto**; auto đánh thường + auto cast skill, có toggle tắt auto cast để tự cast. (owner, 2026-11-09)
- **D-05 (team size)**: **4 hero** một đội. (owner, 2026-11-09)
- **D-17**: **P0 tối thiểu** — persistent shell (E-01) + asset on-demand + save envelope 256 KB + music helper; content packs để P1. (owner, 2026-11-09)
- **E-01**: nằm trong P0; shell của game-kit có option `persistent`, bỏ "Ván mới". (owner, 2026-11-09)

## Next — one item

**D-05 — chốt card core: roles, elements, rarity, gear slots, skills.** Đây là thứ khoá bàn đánh bài (D-12) và progression (D-06). Đề xuất: 4 role (Vanguard/Blade/Seer/Binder), 4 element, 3 rarity, 4 gear slot, 1 basic + 1 active + 1 passive, bond pairs.

## Waiting on the owner

- **D-05**: roles/elements/gear/skills — theo đề xuất, hay muốn giữ ít hơn (3 role/3 element)?
- **D-09**: auto-advance mặc định hay có stage picker? (đề xuất: auto-advance, stage picker để farm)
- **D-12**: board layout — 2 hàng 4 card (recommended), 4 lane, hay grid?
- **Brief**: xác nhận bản draft (đã bổ sung các quyết định 2026-11-09).

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | Định vị, người chơi và lời hứa | decision | **decided** | — |
| D-02 | Độ tương thích với nền tảng Tò He và các giới hạn | decision | **decided** (extend) | D-01 |
| D-03 | Nền tảng kỹ thuật: engine, render, save, dữ liệu | decision | open | D-17, D-04 |
| D-04 | Core loop & mô hình chiến đấu | decision | **decided** | D-01 |
| D-05 | Card/character core: vai trò, hệ, kỹ năng, đội hình | decision | **researching** (team size 4 decided) | D-04 |
| D-06 | Hệ thống phát triển và đường cong sức mạnh | decision | open | D-05, D-17 |
| D-07 | Kinh tế, phần thưởng idle và nhịp tiến trình | decision | open | D-06 |
| D-08 | Lớp meta: codex, bonds, company rank; **no home** | decision | **researching** (no home decided) | D-01, D-06 |
| D-09 | Khung nội dung: wave/stage/vùng/boss, auto-advance, chế độ phụ | decision | open | D-04, D-05, D-06 |
| D-10 | Nhịp chơi hằng ngày và cấu trúc live | decision | open | D-07, D-09 |
| D-11 | Pipeline sản xuất nội dung (data-driven) | decision | open | D-03, D-09 |
| D-12 | UX: một bàn đánh bài, panel mở trên đó | decision | **proposed** | D-05, D-08, D-10, E-01 |
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

## Graduation list

Điền ở phase 4 (Converge): từng ADR, thay đổi docs và pull request, theo thứ tự, truy về item.
