# E-02 — Hạ tầng email giao dịch

- Status: **proposed**
- Kind: enhancement — dịch vụ ngoài mới → ADR (ADR 0008: "A new framework, database, or service requires a new ADR")
- Blocks: D-02 (mọi luồng gửi mã), D-12, E-04 (khối SMTP trong chart) · Blocked by: —
- Decided: —

## Vì sao

Email làm định danh (D-02) nghĩa là đăng ký, quên mật khẩu, đổi email, liên kết, xác thực lại đều cần gửi mã. Hôm nay
API không gửi email nào.

## Đề xuất

- **Gửi qua outbox:** request chỉ ghi một dòng vào bảng outbox (người nhận, mẫu, dữ liệu, số lần thử, lần thử kế,
  thời điểm gửi, lỗi); một `BackgroundService` gửi và thử lại có giãn cách. Request không chờ SMTP, và một instance API
  là đủ (ADR 0016).
- **Cấu hình:** `Email__Mode: smtp | disabled`, `Email__From`, `Email__Smtp__{Host,Port,Username,Password,Security}`.
  Chart có `infra.smtp.mode: builtin | external | disabled` như chart `platform` (builtin = Mailpit để người tự cài thử).
  Guard (D-04): `disabled` thì không có đăng ký bằng email + mật khẩu.
- **Theo môi trường:** dev dùng Mailpit trong `compose.yaml` (cổng 47xx); UAT và prod dùng **Resend** — relay mà
  `platform` và Outline đang dùng, domain `vinetic.io.vn` đã được xác minh ở Resend
  (`~/workspace/platform-infra/apps/outline/README.md`, mục Mail). Resend cổng 587 là STARTTLS.
- **Thư viện:** MailKit thay vì `System.Net.Mail.SmtpClient` (Microsoft không khuyên dùng nó cho code mới) — cần
  kiểm chứng lại lúc spec.
- **Mẫu thư tiếng Việt** (chữ thường + HTML đơn giản): mã đăng ký · "bạn đã có tài khoản" · mã đặt lại mật khẩu ·
  mật khẩu đã đổi · mã xác nhận email mới · email đăng nhập đã đổi (gửi email cũ) · đã liên kết / đã gỡ một cách đăng
  nhập · mã xác thực lại · account sắp bị xoá / đã huỷ xoá.
- Giới hạn gửi theo người nhận đi cùng luật mã một lần (design §3.3). Bounce/khiếu nại để sau.

## Câu hỏi cho owner

- **Q1** Địa chỉ gửi: `tohe@vinetic.io.vn`, `no-reply@vinetic.io.vn`, hay khác?
- **Q2** Dùng chung account Resend của `platform` (chỉ tạo API key riêng cho Tò He) được không?
