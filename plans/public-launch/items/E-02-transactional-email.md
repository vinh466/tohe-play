# E-02 — Hạ tầng email giao dịch

- Status: **decided** (2026-10-18, chat) — cách làm và Q1 (`Tò He <no-reply@…>`) theo đề xuất; **Q2 (Resend Free hay Pro) vẫn chờ owner**, không chặn code: hai nhánh chỉ khác cấu hình lúc deploy
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

## Resend: hạn mức quyết định có dùng chung được không

Sự thật (2026-10-17):
- Gói **Free**: **100 email mỗi ngày** (chặn cứng, không tính thêm tiền), 3.000 email mỗi tháng; số domain theo trang giá
  chính thức là 3 (nguồn cũ ghi 1). Gói **Pro**: 20 USD/tháng, 50.000 email/tháng, **không giới hạn theo ngày**, 10 domain.
- `platform` và Outline đã gửi qua cùng một account Resend (`~/workspace/platform-infra/apps/outline/README.md`).
- Chưa biết account đó đang ở gói nào.

Vì sao quan trọng: ở gói Free, **100 email/ngày là của chung cả account**. Ước tính của agent: một cộng đồng 50 người
đăng ký trong một tối tốn khoảng 60–70 email (mã đăng ký, gửi lại mã, thư "bạn đã có tài khoản"); cộng thêm thư của
platform là chạm trần.
Khi đó **mọi thư của platform cũng ngừng** tới ngày hôm sau — một lần ra mắt của Tò He làm hỏng đăng nhập của platform.

## Đề xuất của agent cho Q1, Q2

- **Nếu account đang ở Pro:** dùng chung; tạo API key riêng cho Tò He chỉ có quyền gửi; gửi từ
  `Tò He <no-reply@vinetic.io.vn>` (domain đã xác minh sẵn, không phải đụng DNS).
- **Nếu account đang ở Free:** tạo **account Resend riêng** cho Tò He (100 email/ngày của riêng nó) với một domain gửi
  riêng, ví dụ `tohe.vinetic.io.vn` — thêm vài bản ghi DNS (SPF, DKIM) trong Cloudflare; gửi từ
  `Tò He <no-reply@tohe.vinetic.io.vn>`. Domain riêng còn tách uy tín gửi thư của Tò He khỏi platform. (Chưa kiểm: một
  domain có thuộc được hai account Resend không — dùng subdomain riêng thì khỏi phải lo.)
- **Địa chỉ `no-reply`:** thư chỉ chứa mã và thông báo, cuối thư ghi "Thư tự động, vui lòng không trả lời". Nếu owner
  muốn người dùng trả lời được, đặt Reply-To một địa chỉ hỗ trợ chuyển về Gmail bằng Cloudflare Email Routing — làm sau
  cũng được.

## Câu hỏi cho owner

- **Q1** Gửi từ `Tò He <no-reply@…>` như đề xuất — được không?
- **Q2** Account Resend của platform đang ở gói **Free** hay **Pro**? (Câu trả lời chọn giúp nhánh dùng chung hay tách riêng ở trên.)

Nguồn: [Resend: What is Resend pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing) ·
[Nuntly: Resend pricing 2026](https://nuntly.com/resend-pricing) · [AgentDeals: Resend free tier 2026](https://agentdeals.dev/vendor/resend)
