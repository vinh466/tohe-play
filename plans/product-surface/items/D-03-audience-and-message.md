# D-03 — Tò He công khai nói với ai, và nói gì đầu tiên?

- Status: **decided** (2026-10-19, chat) — không chia đối tượng: ai cũng là **một người dùng**; sản phẩm xoay quanh **vòng
  đời của một người dùng**
- Kind: decision
- Blocks: E-02 (lời trên trang công khai), E-03 (lời chào), E-04b (vision), D-06…D-08 (vòng đời) · Blocked by: —
- Decided: owner, 2026-10-19, chat — xem *Decision*

## Vì sao

Lời trên landing, từ khoá, câu AI sẽ trả lời và màn đầu tiên của người mới phụ thuộc câu này. Agent không tự đặt đối tượng.

## Phương án (lúc hỏi)

A gia đình có con nhỏ · B người lớn chơi casual cùng bạn bè · C cả hai, hai lối vào.

## Decision

**owner** (2026-10-19, chat): "về cộng đồng, ý tôi là tôi sẽ giới thiệu sản phẩm đến các kênh của tôi th, về sản phẩm tất
cả trước tiên đều là user, chúng ta tập trung vòng đời 1 user th nhé".

Hệ quả:
- **Không có phương án A/B/C** — không phân khúc. Thông điệp đầu tiên nói với một người bất kỳ: mở là chơi, không quảng
  cáo, rủ người khác vào chơi bằng một link. Hồ sơ cho bé và bàn chơi online là **tính năng** trong vòng đời, không phải
  đối tượng riêng.
- "Cộng đồng" = các kênh của owner (nơi owner giới thiệu link) — không phải một cấu trúc trong sản phẩm. Mã mời cộng đồng
  (ADR 0028) vẫn là công cụ của chế độ đăng ký (D-05), không phải định vị.
- Vòng đời một người dùng thành trục của plan: [design.md §Vòng đời](../design.md#6-vòng-đời-một-người-dùng),
  [D-06](D-06-identity-ladder.md), [D-07](D-07-linking-device-profiles.md), [D-08](D-08-entry-links.md).
- E-02, E-03 bỏ "hai lối theo D-03"; E-04b viết vision theo hướng user-first.
