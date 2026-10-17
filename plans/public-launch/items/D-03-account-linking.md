# D-03 — Liên kết các cách đăng nhập vào một account

- Status: **decided** (2026-10-17, chat)
- Kind: decision
- Blocks: T4 spec · Blocked by: D-02
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Nội dung đã chốt

- **Liên kết theo `(provider, subject)`, không theo email.** Email của provider chỉ dùng để *tìm* account ứng viên,
  và chỉ khi provider báo email đã xác minh (Google: claim `email_verified`; GitHub: địa chỉ `verified` + `primary`
  từ `GET /user/emails`, scope `user:email`).
- **Liên kết vào account đã có phải chứng minh quyền:** một mã gửi tới email của account (mặc định), hoặc mật khẩu,
  hoặc một provider đã liên kết. Nếu trong cùng luồng người dùng vừa xác minh chính email đó bằng mã, thì mã đó là
  bằng chứng — không hỏi lại.
- **Provider không có email, hoặc email chưa xác minh:** hỏi email, xác minh bằng mã, rồi đi tiếp như email đã xác
  minh. Đường này chừa sẵn cho provider không trả email (Zalo…) nếu sau này cần.
- **Một `(provider, subject)` chỉ thuộc một account;** liên kết thêm từ Cài đặt mà subject đã thuộc account khác thì
  từ chối.
- **Gỡ liên kết** chỉ khi account còn ít nhất một cách đăng nhập khác; phải xác thực lại mức 2 (D-05).
- Mọi liên kết và gỡ liên kết đều báo email.

Không chọn kiểu tự động liên kết khi provider báo verified (như Clerk): chỉ tiết kiệm được một mã, trong khi giữ được
an toàn trước các provider OIDC tự cấu hình mà không xác minh email thật ([R-01](../research/R-01-auth-linking.md)).

Luồng: [design.md §3.6–3.8](../design.md#36-đăng-nhập-bằng-oauth).

## Decision

**owner** (2026-10-17, chat): "còn lại các dề xuất của bạn ổn nha" — chấp nhận khuyến nghị "Liên kết OAuth vào tài
khoản đã có: luôn chứng minh (một mã email, an toàn và đơn giản)" trong review cùng ngày; và với luồng auth nói
chung: "bạn cứ theo đề xuát mà nó hợp lý với chuẩn là đc".
