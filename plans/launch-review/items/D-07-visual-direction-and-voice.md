# D-07 — Tò He nên trông và nói thế nào để không còn như máy làm?

- Status: **proposed**
- Kind: decision
- Blocks: E-02 (rà từng màn), E-04 (câu chữ) · Blocked by: —
- Decided: —

## Why it matters

Owner 2026-10-23: "làm kỹ thay đổi để bớt AI style đi … để phục vụ cho người dùng tốt hơn". Hôm nay Tò He mang gần đủ
các dấu hiệu của giao diện do máy dựng ([R-07](../research/R-07-ai-style.md)): emoji làm icon, thẻ trắng căn giữa khắp nơi,
bảng màu orange mặc định của Tailwind, font hệ thống, câu nối "·", tên khách không khớp hình. Người lớn nhận ra ngay và
"bỏ qua ngay"; trẻ nhỏ thì cần hình rõ, ít chữ, phản hồi vui — thứ emoji và thẻ chữ không cho được.

## What is true today

- Màu: `packages/design-tokens/tokens.css` — dải orange Tailwind gần như nguyên giá trị; có test tương phản
  (`contrast.test.ts`) cho sáng và tối.
- Chữ: `system-ui` (`apps/hub/src/styles.css`, `apps/web/src/styles/site.css`).
- Icon: emoji ở tab, ô game (🔗), nút, menu trong game (`packages/game-kit`), avatar (16 emoji).
- Hình của game: icon vẽ cho danh mục (`games/<id>/public/icon.*`), ảnh xem trước từng game (G2b); không có ảnh bìa
  hay ảnh màn chơi.
- Câu chữ: agent tự áp dụng câu chữ UI (quyết định cũ của owner), Điều khoản/Quyền riêng tư để E-05.

## Options

Chi tiết ở [R-07 §4](../research/R-07-ai-style.md#4-ba-hướng).

### A — Xưởng tò he (thương hiệu là nghề nặn)

Avatar là 16 con tò he vẽ tay (khớp danh sách tên), linh vật cho màn trống, ảnh bìa mỗi game (một vật chính, không
chữ); màu lấy từ màu nhuộm truyền thống (trắng gạo, đỏ gấc, vàng, xanh lá, mực đen); font có dấu Việt chuẩn; bấm như bóp
bột, tiếng gõ bột nhẹ; giọng như người nhà. **Giá lớn** — cần một người vẽ; code vừa.

### B — Đồ chơi gọn (không cần minh hoạ)

Bộ icon SVG có nhãn (Phosphor, MIT), ảnh bìa từ ảnh chụp game, phân cấp chữ rõ (cam chỉ cho hành động), danh mục dày
và lệch nhịp với ô *Chơi tiếp* lớn, câu chữ ngắn. **Rẻ → vừa.** Rủi ro: vẫn có thể chung chung.

### C — Chợ phiên Đông Hồ

Nét khắc gỗ, giấy dó, âm chợ. **Vừa → lớn.** Khó đọc, dark mode khó, hợp bố mẹ hơn trẻ.

## Recommendation

**A là đích, làm theo ba bước — bước 1 và 2 không cần chờ người vẽ:**

1. **S1 — Nền (B)**: hướng dẫn giọng văn + hình (`docs/conventions/voice-and-look.md`, spec trước); viết lại câu chữ
   (hub, trang công khai, trang game); bộ icon SVG thay mọi emoji làm icon (tab, 🔗 → nút "Rủ bạn" có chữ, #, ✉️, ☀️🌙,
   🏆); danh mục: bỏ H1 lặp tên tab, bỏ dải "Tiến độ đang lưu…" thường trực (chuyển vào Tôi, hoặc hiện một lần sau điểm
   đầu tiên), không cắt chữ (dòng `kind` ngắn viết riêng), dày hơn trên tablet/máy tính; trang chủ công khai gọn: một
   dòng, ô game, một dải "Chơi cùng", footer; font tự host có dấu Việt chuẩn (Be Vietnam Pro).
2. **S2 — Trong game**: menu của `packages/game-kit` dùng icon SVG và logo vẽ của chính game (bỏ 🧱 🔊 ⚙️ ❓ ▶).
3. **S3 — Xưởng tò he (A)**: khi có tranh — avatar tò he, ảnh bìa, linh vật; token lấy lại từ màu nhuộm (đỏ gấc là
   màu thương hiệu, giữ test tương phản); chuyển động và âm thanh "bột".

Cái giá chấp nhận: S1 thay đổi gần như mọi màn một lần nữa (e2e và ảnh chụp manifest cập nhật theo); S3 phụ thuộc người vẽ.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Hướng nào? | A làm đích, đi qua S1 → S2 → S3 |
| Q2 | Ai vẽ cho S3? | Thuê một hoạ sĩ người Việt theo brief agent viết (16 avatar, 4 ảnh bìa, 1 linh vật; sáng + tối). Không dùng ảnh do AI tạo: trái mục tiêu, khó đồng nhất |
| Q3 | Màu thương hiệu | Đổi từ orange Tailwind sang đỏ gấc + bảng màu nhuộm ở S3; S1 giữ tông, chỉ bớt dùng cam |
| Q4 | Font | Be Vietnam Pro tự host (S1); font tiêu đề tròn chọn ở S3 sau khi kiểm dấu |
| Q5 | Icon | Phosphor (fill/duotone, MIT), luôn kèm nhãn |
| Q6 | Giọng văn | Agent viết hướng dẫn và áp dụng; owner duyệt giọng trên UAT |

## Decision

—

## Discussion

**agent** (2026-10-23): R-07 tổng hợp từ scout + ảnh chụp prod. Owner đã giao câu chữ UI cho agent, nên S1 có thể đi
ngay khi owner chọn hướng; S3 cần ngân sách và người vẽ.
