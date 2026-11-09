# Plan — RPG thẻ bài treo máy (working title)

- Goal: Một RPG thẻ bài treo máy phone-first cho Tò He — tiến trình dài là trục chính, chiến đấu bằng thẻ dễ đọc, phiên ngắn chơi một tay, và nội dung mở rộng được lâu dài mà không phải xây lại nền.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases))
- Started: 2026-11-09 · Branch: `plan/idle-card-rpg` · PR: chưa mở
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)

## Next — one item

**D-01 — chốt định vị & lời hứa.** Ba hướng đã có trong [item](items/D-01-positioning.md): **Làng Mây** (làng trên mây + hộ vệ, recommended), **Đoàn Thám Hiểm** (thuần expedition), **Đấu Trường Cổ** (arena). Chốt D-01 mở khoá D-02 (platform) và D-04 (battle).

## Waiting on the owner

- **Brief**: xác nhận bản draft (đã bổ sung 5 câu trả lời 2026-11-09).
- **D-01**: chọn hướng thế giới/định vị — Làng Mây, Đoàn Thám Hiểm, hay Đấu Trường Cổ?
- **D-02**: chấp thuận hướng "adapt + E-01" (không đổi Game Contract), hay muốn mở rộng nền tảng trước?
- **D-04**: chọn battle model — round-based speed order (recommended), ATB, hay auto-charge?

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | Định vị, người chơi và lời hứa | decision | **proposed** | — |
| D-02 | Độ tương thích với nền tảng Tò He và các giới hạn | decision | **proposed** | D-01 |
| D-03 | Nền tảng kỹ thuật: engine, render, save, dữ liệu | decision | open | D-02, D-04 |
| D-04 | Core loop & mô hình chiến đấu | decision | **proposed** | D-01 |
| D-05 | Card/character core: vai trò, hệ, kỹ năng, đội hình | decision | open | D-04 |
| D-06 | Hệ thống phát triển và đường cong sức mạnh | decision | open | D-05 |
| D-07 | Kinh tế, phần thưởng idle và nhịp tiến trình | decision | open | D-06 |
| D-08 | Lớp meta: bộ sưu tập, farm/base, sưu tầm | decision | open | D-04, D-06 |
| D-09 | Khung nội dung: chương, dungeon, boss, sự kiện | decision | open | D-04, D-05, D-06 |
| D-10 | Nhịp chơi hằng ngày và cấu trúc live | decision | open | D-07, D-09 |
| D-11 | Pipeline sản xuất nội dung (data-driven) | decision | open | D-03, D-09 |
| D-12 | Kiến trúc UX: screen map, navigation, bố cục | decision | open | D-05, D-08, D-10 |
| D-13 | Art direction & cảm giác chiến đấu | decision | open | D-01, D-05, D-12 |
| D-14 | Thế giới, thème và tên game | decision | open | D-01 |
| D-15 | Âm thanh, haptics và cảm giác chạm | decision | open | D-12, D-13 |
| D-16 | Phạm vi v1, phasing và bộ wireframe | decision | open | D-04, D-07, D-10, D-12, D-13 |
| E-01 | Kit: shell cho game persistent (bỏ "Ván mới") | enhancement | **proposed** | D-02, D-12 |

## Research so far

- [R-01 — Genre landscape](research/R-01-genre.md): AFK, Idle Heroes, Summoners War, Epic Seven, Legend of Mushroom, Hero Wars/MU; what to take/avoid.
- [R-02 — Progression & economy](research/R-02-progression-economy.md): 12 h idle chest, no energy, 3 growth axes, one-week pacing.
- [R-03 — Battle & card UX](research/R-03-battle-card-ux.md): round-based speed order + manual ultimates; 4 cards fit a 360 px phone; pixel specs.
- [R-04 — Platform fit](research/R-04-platform-fit.md): 4.5 MB build, 64 KB save is enough; the only gap is the persistent shell (E-01).

## Graduation list

Điền ở phase 4 (Converge): từng ADR, thay đổi docs và pull request, theo thứ tự, truy về item.
