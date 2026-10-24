# D-08 — Trang chủ giới thiệu: những section nào để người mới cuộn xuống là hiểu Tò He?

- Status: **researching** ([R-10](../research/R-10-surface-round-2-plan.md) Q-A)
- Kind: decision
- Blocks: E-08 · Blocked by: — · Mở lại một phần: [D-06](D-06-introduction-surface.md) ("trang chủ danh mục trước", ADR 0047)
- Decided: —

## Why it matters

Owner, 2026-10-24: "landing page làm cho nó giới thiệu 1 chút có các section và căn giữa các nút phù hợp hơn đi, chủ yếu
là các văn ở đây, chúng ta có page game list đồ r thì k cần list game ở đây lặp, tôi thấy trang đầu tiên cho user mới
cuộn xuống có thể đọc hiểu sản phẩm ok".

## What is true today

`/` (`apps/web/src/pages/index.astro`, `/en/` cùng khuôn): H1 + một câu, lưới 4 game "Chơi gì hôm nay?" (trùng `/games/`
và `/play`), hộp "Chơi cùng", 3 câu Hỏi đáp, footer. Nút *Chơi ngay* chỉ ở góc header. Chi tiết và ảnh: R-10.

## Options

Sơ bộ, chưa đánh giá — bước 2–4 của R-10 làm đầy:

- **A — Trang giới thiệu theo section, không lưới game**: hero căn giữa có nút; Tò He là gì; chơi thế nào (3 bước); chơi
  cùng cả nhà qua link; cho bé và cho bố mẹ (không quảng cáo, hồ sơ trẻ có PIN); cài như app; Hỏi đáp; nút cuối trang.
  Một link "Xem các trò chơi" tới `/games/`.
- **B — A + một dải game nhỏ** (ảnh trượt ngang, không lưới) để người mới thấy ngay có gì chơi, giữ link nội bộ tới trang
  từng game cho SEO.

## Recommendation

None yet: chờ tiền lệ (R-10 bước 2) và câu hỏi SEO/GEO — trang game hôm nay được trang chủ dẫn tới trực tiếp.

## Decision

—

## Discussion

**agent** (2026-10-24): câu chữ do agent viết theo voice-and-look, owner soát (như S1).
