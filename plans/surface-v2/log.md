# Log — Bề mặt sản phẩm v2

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

## 2026-10-31 (V2 web: home sạp + game store) — agent, phiên "Surface v2"

- `apps/web`: `/` thành sạp (hero game, Đang mở, Chơi tiếp/greeting, Chơi nhanh, band Rủ bạn, Tất cả + tag); `/games/`
  dùng card cover; `/games/<id>/` thành store page (cover, facts chip, cách chơi, facts table, trò khác, playbar mobile
  chỉ hiện sau hero). Header đổi **Sạp · Chơi cùng · Về**; hero/card "Chơi" trỏ thẳng `/play/<id>` (1 chạm), header vẫn
  vào cửa.
- Web build 26 trang + check-build pass; 114 test web pass; hub 356 test + typecheck + build pass; docs 270 trang link resolve.
- `pnpm verify` dừng ở API tests (29 fail, `pk_profiles` duplicate/test DB isolation), không liên quan bề mặt; các package đã đổi đều xanh. Ảnh bìa vẫn là icon crop tạm; OG tagline cũ chờ V1 brand.
- Tiếp: V1 token brand + primitive, V3 hub (nudge đăng ký, Tôi tiến độ), V4 `/family`.

## 2026-10-31 (P0 slice) — agent, phiên "Surface v2"

- Đã làm từ spec: tab **Sạp**, tagline 16+; cửa **Chơi ngay** trước, bỏ tab bar ở cửa, bỏ "Dữ liệu kỹ thuật" khỏi cửa;
  card catalog có nút **Chơi**, cover 16:9 tạm, bỏ pop-in, lưới desktop có max; "Chơi tiếp" có cover; empty state
  Chơi cùng có câu dẫn; bỏ SHA khỏi Tôi; e2e đổi sang Sạp/Chơi ngay.
- Hub: 356 test pass, typecheck, build. Docs: 270 trang, link nội bộ resolve. Chưa commit.
- Tiếp: home `/` thành sạp (V2), game page/store, token brand, nudge đăng ký sau ván đầu, `/family`.

## 2026-10-31 (V0 spec viết) — agent, phiên "Surface v2"

- Owner: "spec rõ ràng sạch sẽ hướng, luồng, token style … sau đó impl". Đã viết **ADR 0057** (shelf 16+, family layer)
  và cập nhật `voice-and-look`, `surfaces`, `theming`, `vision`, `index`, `identity`, `hosts-and-paths`.
- Spec nói rõ: hai register giọng; `/` và `/play` là sạp; `/games/<id>/` là store page; cửa "Chơi ngay" trước + gợi ý
  đăng ký sau ván đầu; `/family` + `Tôi → Gia đình`; token giấy/mực/gấc/nghệ/lá, card viền mực, offset shadow.
- Tiếp: P0 quick wins từ spec; V1 brand; V2 web; V3 hub. Chưa commit.

## 2026-10-31 (owner chốt D-01…D-08) — agent, phiên "Surface v2"

- Owner trả lời 6 câu: giữ Tò He/chất đồ chơi nặn tay; home như prototype; giữ cửa + "Chơi ngay" trước + gợi ý đăng ký
  sau khi chơi; gia đình trong `Tôi` + `/family`; screenshot + khung tạm; tab **"Sạp"**.
- D-01…D-08 **decided**; `design.md` v1; graduation list nháp: V0 spec → P0 quick wins → V1 brand → V2 web → V3 hub →
  V4 family → V5 content → V6 đo.
- Chờ owner: P0 trước hay V1 brand trước (đề xuất P0).

## 2026-10-31 — agent, phiên "Surface v2"

- Owner: "review và dive research và brainstorm … product surface, UIUX, content … hiện tại nó khá là AI … người dùng
  chủ yếu là các 16+ … phần trẻ em nên là một phần nhỏ". Brief nháp, PLAN, map.
- Chụp prod 2026-10-31 (390/820/1440, sáng/tối, vi/en) + đọc code → R-01 (12 chỗ đau, 6 dấu hiệu AI); xem Poki,
  CrazyGames, Coolmath, itch.io, Miniblox, Y8 → R-02; ba hướng + đề xuất A (sạp game) → R-03.
- Chờ owner: xác nhận brief, chọn hướng, 6 câu hỏi ở PLAN.
