# D-10 — Vào hub khi chưa đăng nhập: hỏi đăng nhập, hay chơi ngay bằng hồ sơ máy?

- Status: **researching** ([R-10](../research/R-10-surface-round-2-plan.md) Q-C)
- Kind: decision
- Blocks: E-08 · Blocked by: — · Có thể mở lại: ADR 0043 (hồ sơ máy), brief của `product-surface` ("chơi ngay không cần
  tài khoản")
- Decided: —

## Why it matters

Owner, 2026-10-24: "luồng khi vào hub thì cũng nên hỏi user cần đăng nhập nếu chưa đăng nhập đi, tôi test thấy vào thẳng
với profile tạm nó hơi làm user k biết chuyện gì đang xảy ra".

## What is true today

Máy mới mở `/play` là vào danh mục với một hồ sơ máy tự đặt tên và avatar ở góc; đăng nhập nằm trong Tôi. Hồ sơ máy
không lên server cho tới khi ngồi bàn, chuyển máy hay gộp vào account ([identity.md](../../../docs/architecture/identity.md),
ADR 0043); câu tuổi và đồng ý hỏi lúc đó (ADR 0025). Link mời `/s/`, `/r/` vào thẳng (ADR 0044).

## Options

Sơ bộ, chưa đánh giá:

- **A — Màn chào một lần**: hai lựa chọn lớn, "Đăng nhập · Tạo tài khoản gia đình" (tiến độ theo bạn sang máy khác) và
  "Chơi thử trên máy này" (tiến độ ở máy này, đăng nhập sau vẫn giữ). Người mở link mời vào bàn ngay, chỉ hỏi tên.
- **B — Bắt đăng nhập trước khi chơi**: trái brief `product-surface` và ADR 0043; cần ADR mới; trẻ không có email.
- **C — Giữ vào thẳng, nói rõ hơn**: hồ sơ hiện là "Khách trên máy này", một dải giải thích, nhắc đăng nhập đúng lúc
  (sau ván đầu, khi có điểm).

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | "Hỏi đăng nhập" là bắt buộc (B) hay hỏi và cho chọn (A)? | Chờ research; nghiêng về A |

## Recommendation

None yet: chờ tiền lệ (trẻ em và gia đình: Khan Academy Kids, PBS Kids, YouTube Kids; game web: Poki, Lichess).

## Decision

—
