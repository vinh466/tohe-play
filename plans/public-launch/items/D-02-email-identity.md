# D-02 — Email là định danh của account, với bộ luồng chuẩn

- Status: **decided** (2026-10-17, chat)
- Kind: decision
- Blocks: D-03, D-04, E-01, E-02, T2 spec · Blocked by: —
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Vì sao cần chốt

ADR 0011 đăng nhập bằng username + mật khẩu, không thu email; đăng ký mở trong VPN và *"Revisit before any public"*
(`docs/decisions/0011-password-sign-in-first.md:34`). Không có email thì không quên mật khẩu được
(`0011…:41`), và không liên kết OAuth an toàn được.

## Nội dung đã chốt

Mỗi account có đúng một email đã xác minh. Đó là định danh để đăng nhập, khôi phục và liên kết. Nguyên tắc, dựa trên
nghiên cứu pre-hijacking của Microsoft Research (USENIX Security 2022) — xem [R-01](../research/R-01-auth-linking.md):

1. **Xác minh trước, tạo account sau.** Đăng ký bằng email chỉ tạo một *attempt* chờ mã. Account chỉ được tạo khi
   mã đúng — nên không tồn tại account "chưa xác minh" để kẻ xấu đặt trước.
2. **Mã một lần gắn với attempt** đang mở ở phiên đó: chỉ có mã thì không dùng được (design §3.3).
3. **Không lộ email nào đã có account:** đăng ký, quên mật khẩu, đổi email luôn trả cùng một câu; người thật nhận
   email giải thích.
4. **Reset mật khẩu thì** đổi security stamp (đăng xuất mọi nơi), huỷ đổi email đang chờ, và gửi thông báo kèm danh
   sách các cách đăng nhập của account.
5. **Mọi thay đổi bảo mật đều báo qua email:** mật khẩu, email, liên kết, gỡ liên kết, xoá account.
6. **Email không bao giờ hiện cho người khác;** người chơi thấy nhau qua hồ sơ (D-01).

Các luồng đầy đủ, mỗi luồng một sơ đồ mermaid: [design.md §3](../design.md#3-các-luồng). Khi graduate chúng chuyển
sang `docs/architecture/identity.md` làm tài liệu maintain (owner: "nhớ spec mermaid rõ về các luồng").

## Decision

**owner** (2026-10-17, chat): "hợp lý, tôi nghĩa luồng này đã quá phổ biến trên thế giới r, bạn cứ theo đề xuát mà
nó hợp lý với chuẩn là đc (luồng đầy đủ và kín nhé, nhớ spec mermain rõ về các luồng để làm tài liệu maintain nhé)".

Hệ quả: thay ADR 0004/0011 bằng một ADR identity mới khi graduate; tài khoản username trên UAT chuyển theo E-01.
