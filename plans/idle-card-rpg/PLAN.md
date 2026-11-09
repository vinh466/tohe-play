# Plan — RPG thẻ bài treo máy (working title)

- Goal: Một RPG thẻ bài treo máy phone-first cho Tò He — một đoàn thám hiểm đi qua thế giới fantasy gốc, tiến trình dài là trục chính, chiến đấu thẻ bài dễ đọc, phiên ngắn một tay, và nội dung mở rộng được lâu dài.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-09 · Branch: `plan/idle-card-rpg` · PR: chưa mở
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)

## Decided so far

- **D-01**: **Đoàn Thám Hiểm** — không base/làng; caravan là home; trọng tâm là con đường, đội hình và tiến trình. (owner, 2026-11-09)
- **D-02**: **Mở rộng nền tảng trước** — không ép game vào giới hạn hiện tại; gói mở rộng cụ thể ở D-17. (owner, 2026-11-09)
- **D-05 (team size)**: **4 hero** một đội. (owner, 2026-11-09)
- **D-04 (control)**: **auto đánh thường + auto cast skill**, có toggle tắt auto cast để tự cast. (owner, 2026-11-09)

## Next — one item

**D-17 — chốt gói platform extension.** Đề xuất trong [item](items/D-17-platform-extension.md): P0 gồm E-01 persistent shell + asset on-demand + save envelope 256 KB + music helper; content packs để P1 sau khi loop được chứng minh. Song song, chốt **D-04 timing** (round-based auto recommended vs real-time auto).

## Waiting on the owner

- **D-17**: chọn P0 (minimal enablers), P1 (live-content platform), hay P2 (full) — và có muốn content packs ngay từ v1 không.
- **D-04**: chốt nhịp trận — round-based auto (recommended) hay real-time auto.
- **Brief**: xác nhận bản draft (đã bổ sung các quyết định 2026-11-09).

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | Định vị, người chơi và lời hứa | decision | **decided** | — |
| D-02 | Độ tương thích với nền tảng Tò He và các giới hạn | decision | **decided** (direction: extend) | D-01 |
| D-03 | Nền tảng kỹ thuật: engine, render, save, dữ liệu | decision | open | D-17, D-04 |
| D-04 | Core loop & mô hình chiến đấu | decision | **researching** (control decided; timing open) | D-01 |
| D-05 | Card/character core: vai trò, hệ, kỹ năng, đội hình | decision | **researching** (team size 4 decided) | D-04 |
| D-06 | Hệ thống phát triển và đường cong sức mạnh | decision | open | D-05, D-17 |
| D-07 | Kinh tế, phần thưởng idle và nhịp tiến trình | decision | open | D-06 |
| D-08 | Lớp meta: bộ sưu tập, codex, bonds, company rank (no base) | decision | open | D-01, D-06 |
| D-09 | Khung nội dung: vùng, stage, dungeon, boss, sự kiện | decision | open | D-04, D-05, D-06 |
| D-10 | Nhịp chơi hằng ngày và cấu trúc live | decision | open | D-07, D-09 |
| D-11 | Pipeline sản xuất nội dung (data-driven) | decision | open | D-03, D-09 |
| D-12 | Kiến trúc UX: screen map, navigation, bố cục | decision | open | D-05, D-08, D-10, E-01 |
| D-13 | Art direction & cảm giác chiến đấu | decision | open | D-01, D-05, D-12 |
| D-14 | Thế giới, thème và tên game | decision | open | D-01 |
| D-15 | Âm thanh, haptics và cảm giác chạm | decision | open | D-12, D-13 |
| D-16 | Phạm vi v1, phasing và bộ wireframe | decision | open | D-04, D-07, D-10, D-12, D-13, D-17 |
| D-17 | Gói platform extension: P0/P1/P2 | decision | **proposed** | D-02 |
| E-01 | Kit: shell cho game persistent (bỏ "Ván mới") | enhancement | **proposed** | D-17 |

## Research so far

- [R-01 — Genre landscape](research/R-01-genre.md): AFK, Idle Heroes, Summoners War, Epic Seven, Legend of Mushroom, Hero Wars/MU; what to take/avoid.
- [R-02 — Progression & economy](research/R-02-progression-economy.md): 12 h idle chest, no energy, 3 growth axes, one-week pacing.
- [R-03 — Battle & card UX](research/R-03-battle-card-ux.md): auto + manual override; 4 cards fit a 360 px phone; pixel specs.
- [R-04 — Platform fit](research/R-04-platform-fit.md): current facts; 64 KB/4.5 MB estimates; the persistent-shell gap.
- [R-05 — Platform extension options](research/R-05-platform-extension.md): P0/P1/P2, costs, what the game can rely on.

## Graduation list

Điền ở phase 4 (Converge): từng ADR, thay đổi docs và pull request, theo thứ tự, truy về item.
