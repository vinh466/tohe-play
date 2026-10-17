# D-12 — Chế độ đăng ký và mã mời theo cộng đồng

- Status: **decided** (2026-10-17, chat)
- Kind: decision
- Blocks: D-09 (bảng cộng đồng), T6 spec · Blocked by: D-02
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Nội dung đã chốt

- Ba chế độ, admin đổi lúc runtime: **open** (ai cũng đăng ký) · **invite** (cần mã mời) · **closed** (không ai đăng
  ký mới; người đã có account vẫn đăng nhập).
- Áp dụng cho **mọi** đường tạo account, kể cả lần đầu đăng nhập bằng Google/GitHub (design §3.6) — nếu không,
  chế độ invite sẽ có một cửa sau.
- **Mã mời theo cộng đồng:** tên cộng đồng, mã, hạn dùng, số lượt tối đa, đếm số account đã dùng. Account nhớ cộng
  đồng mình vào bằng mã nào, để có bảng cộng đồng (D-09) và số liệu theo cộng đồng trong admin.
- Mã ADR 0011 cũ (mời adult thứ hai vào household) bỏ cùng household (D-01).

Câu hỏi mở cho sau, không chặn v1: một account có thuộc được nhiều cộng đồng không (ví dụ nhập thêm mã sau khi đã
có account)?

## Decision

**owner** (2026-10-17, chat): "còn lại các dề xuất của bạn ổn nha" — chấp nhận đề xuất chế độ đăng ký
`open | invite | closed` và mã mời theo cộng đồng trong review cùng ngày.
