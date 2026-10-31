# Plan — Bề mặt sản phẩm v2: sạp game cho người 16+

- Goal: một bề mặt sản phẩm mà người 16+ hiểu trong 5 giây và chơi trong 10 giây — trên điện thoại, tablet, máy tính —
  trong khi chế độ gia đình vẫn ở đó cho phụ huynh, như một lớp phụ.
- Phase: **Converge** — brief confirmed; D-01…D-08 decided; **V0 spec đã viết** (ADR 0057 + docs); đang chốt thứ tự PR
  và bắt đầu P0.
- Started: 2026-10-31 · Branch: `plan/surface-v2` (chưa mở PR)
- Brief: [brief.md](brief.md) · Design: [design.md](design.md) · Map: [map.md](map.md) · Log: [log.md](log.md)
- Research: [R-01 bề mặt hôm nay](research/R-01-current-surface-review.md) ·
  [R-02 tiền lệ 16+](research/R-02-peers-16plus.md) ·
  [R-03 hướng đi](research/R-03-direction.md)
- Prototype: [home.html](prototype/home.html) · [game.html](prototype/game.html) · [door.html](prototype/door.html)
  (concept, không phải spec)

## Next — one item

**Viết graduation list thành PR nhỏ, bắt đầu V0 (spec) rồi P0 (quick wins).** V0 sửa ADR 0049/0055 + `voice-and-look`,
`surfaces.md`, `identity.md`; P0 gồm card có "Chơi", tab "Sạp", bỏ SHA, đổi thứ tự cửa, "Chơi tiếp" có cover, empty state,
lưới desktop.

## Waiting on the owner

Không còn câu hỏi định vị. Chỉ còn một lựa chọn triển khai: **P0 trước hay brand (V1) trước?** Đề xuất: P0 trước để có kết
quả thấy được trong 1–2 tuần, brand làm song song sau.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | [Định vị và giọng: 16+ mặc định, gia đình là lớp phụ](items/D-01-positioning-and-voice.md) | decision | **decided** | — |
| D-02 | [Trang chủ công khai: sạp game như prototype](items/D-02-public-home.md) | decision | **decided** | D-01 |
| D-03 | [Catalog và khám phá: cover, search, tag, tab "Sạp"](items/D-03-catalog-and-discovery.md) | decision | **decided** | D-01, D-08 |
| D-04 | [Trang game công khai: store page, ảnh, facts, tuổi](items/D-04-game-page.md) | decision | **decided** | D-08 |
| D-05 | [Cửa vào: giữ cửa, "Chơi ngay" trước, gợi ý đăng ký sau](items/D-05-door-and-signup-nudge.md) | decision | **decided** | D-01 |
| D-06 | [Brand và design language: giấy, mực, gấc, nghệ, lá](items/D-06-brand-and-look.md) | decision | **decided** | D-01 |
| D-07 | [Chế độ gia đình: `/family` + `Tôi → Gia đình`](items/D-07-family-mode.md) | decision | **decided** | D-01 |
| D-08 | [Nội dung game: screenshot + khung tạm, cover về sau](items/D-08-game-content.md) | decision | **decided** | — |
| E-01 | Card game có "Chơi" rõ; bỏ "Rủ bạn" làm hành động chính | enhancement | open | D-03 |
| E-02 | Bỏ SHA khỏi Tôi; bỏ "Dữ liệu kỹ thuật" khỏi màn auth | enhancement | open | — |
| E-03 | Bố cục đa thiết bị: grid, rail, max width, player full-bleed | enhancement | open | D-06 |
| E-04 | Trang Tôi có tiến độ; empty state Chơi cùng/Tôi | enhancement | open | D-07 |
| E-05 | Đo TTFP và phễu chơi; 5–8 buổi thử 5 giây | enhancement | open | D-02 |

## Graduation list — draft

Thứ tự đề xuất. Mỗi PR nhỏ, `pnpm verify` xanh, ảnh 360/768/1440 + axe.

| PR | Nội dung | Từ | Cần trước | Ghi chú |
|---|---|---|---|---|
| **V0** | ADR 0057 (định vị 16+ / sạp / gia đình là lớp phụ), sửa ADR 0049, 0055; `voice-and-look.md`, `surfaces.md`, `theming.md`, `vision.md`, `index.md`, `identity.md`, `hosts-and-paths.md`; route `/family` trong `packages/routes` | D-01…D-07 | — | **Spec đã viết**; PR pending |
| **P0** | Quick wins: card có "Chơi" + cover khung tạm; tab "Sạp"; bỏ SHA; cửa "Chơi ngay" trước; "Chơi tiếp" có cover; empty state; lưới desktop 4–6 cột | E-01, E-02, D-03, D-05 | V0 | 1–2 tuần |
| **V1** | Brand foundation: token giấy/mực/gấc/nghệ/lá + contrast test; primitive `GameCard`, `Cover`, `Button`, `Tag`, `Shelf`; wordmark; dark mode | D-06 | V0 | Có thể song song P0 |
| **V2** | `apps/web`: `/` sạp (hero + shelf + tất cả), `/games/` card cover, `/games/<id>/` store page, header **Sạp · Chơi cùng · Về**, playbar mobile; SEO/JSON-LD; ảnh icon crop tạm | D-02, D-04, D-08 | V0 | **Code xong** (token hiện tại; V1 thay look) |
| **V3** | `apps/hub`: `/play` catalog cover-first + search/tag/shelf; `/account` tiến độ + bỏ SHA; `/together` empty state; auth "Chơi ngay" trước + gợi ý sau chơi; layout tablet/desktop | D-03, D-05, E-01…E-04 | V1, P0 | Chia V3a catalog / V3b auth+account |
| **V4** | Gia đình: `/family` công khai + `/account/family` sau PIN; hồ sơ/giới hạn; copy family | D-07 | V2, V3 | Có thể sau |
| **V5** | Nội dung: `coverUrl`/`shotUrls` + convention `page/cover.png`, `shot-*.png`; API + web build + games; `hook`/`tags` | D-08 | V0 | Spike contract trước |
| **V6** | Đo + kiểm: TTFP, phễu, 5–8 buổi thử 5 giây; e2e journey mới; screenshots light/dark; axe | E-05 | P0, V2 | Trước khi tuyên bố xong |

## Không nằm trong graduation này

- Game mới/luật chơi; chat/kết bạn; thanh toán/quảng cáo; viết lại Điều khoản (E-05 của `launch-review`).
