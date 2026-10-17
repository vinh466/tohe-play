# R-01 — Đăng ký bằng email, liên kết OAuth, và những ràng buộc của Google / passkey

- Date: 2026-10-17 · Feeds: D-02, D-03, D-04, D-05, D-15

## Câu hỏi

Làm sao để email là định danh, có cả đăng ký thủ công lẫn Google/GitHub, mà không để ai chiếm được account của người
khác qua chỗ nối giữa các cách đăng nhập?

## Phát hiện

**Năm kiểu "pre-hijacking"** (Sudhodanan & Paverd, Microsoft Research, USENIX Security 2022 — khảo sát 75 dịch vụ
phổ biến, ít nhất 35 bị ít nhất một kiểu):

| Kiểu | Kẻ xấu làm gì trước khi nạn nhân đăng ký |
|---|---|
| Classic–Federated Merge | Tạo account email + mật khẩu bằng email nạn nhân; nạn nhân sau đó vào bằng OAuth cùng email → bị gộp, cả hai cùng vào được |
| Unexpired Session | Giữ một phiên sống lâu; nạn nhân reset mật khẩu nhưng phiên cũ không bị huỷ |
| Trojan Identifier | Gắn thêm một định danh của mình (OAuth, email) vào account đặt trước, để quay lại sau khi nạn nhân reset |
| Unexpired Email Change | Bắt đầu đổi email sang của mình nhưng chưa xác nhận; reset mật khẩu không huỷ yêu cầu đó |
| Non-Verifying IdP | Dùng một IdP không xác minh email để tạo account federated, rồi được gộp với account thật |

**Biện pháp được khuyên** (MSRC blog, cùng nhóm tác giả):
- Xác minh định danh xong mới cho làm bất cứ việc gì khác với account.
- Với IdP: kiểm tra IdP có xác minh email không, hoặc tự xác minh.
- Reset mật khẩu: đăng xuất mọi phiên khác và huỷ mọi token; huỷ mọi yêu cầu đổi email đang chờ; cho người dùng thấy
  các định danh đang gắn với account.
- Gộp account: phải chắc người dùng đang kiểm soát *cả hai* account.
- Quyền xác nhận (mã, link) sống càng ngắn càng tốt; giới hạn số lần xin mã mới cho một định danh chưa xác minh.
- Định kỳ xoá account chưa xác minh; dùng chống bot để hạn chế tạo account tự động.

**Cách các nhà cung cấp làm:** Supabase tự liên kết các identity cùng email nhưng **không bao giờ liên kết vào account
chưa xác minh**. Clerk tự liên kết khi provider báo email đã xác minh, kể cả với account mật khẩu. Ví dụ của Lucia chỉ
liên kết khi provider báo verified. Bài của WorkOS nhắc rằng OpenID Connect nói email không được dùng làm định danh
duy nhất: email trong token chỉ là lời khai của IdP.

**Google OAuth:** redirect URI phải là HTTPS và host không được là IP thô; localhost (kể cả IP loopback) được miễn cả
hai. Host phải thuộc public suffix list. Suy luận: `http://10.100.0.2` của UAT không dùng được.

**GitHub:** `GET /user/emails` (scope `user:email`) trả từng địa chỉ kèm cờ `verified` và `primary`.

**Passkey trong ASP.NET Core 10 Identity:** có sẵn, gồm tạo account không mật khẩu và đăng nhập không mật khẩu; được
thiết kế chỉ cho xác thực, không phải thư viện WebAuthn đầy đủ; mặc định không kiểm attestation. Relying Party ID lấy
từ header Host nếu không đặt `ServerDomain` — nên phải đặt `ServerDomain` hoặc kiểm host (và `AllowedHosts` khi dùng
forwarded headers). Microsoft cảnh báo **không phục vụ nội dung không tin cậy trên subdomain nằm trong phạm vi
`ServerDomain`**. Template Blazor bắt người dùng có một cách dự phòng (mật khẩu hoặc provider) để khôi phục.

**Test OAuth khi môi trường không có OAuth:** `navikt/mock-oauth2-server` là OAuth2/OIDC server giả lập dạng
container (`ghcr.io/navikt/mock-oauth2-server`), cấu hình claims qua `JSON_CONFIG`.

## Giả định

- `email_verified` của Google đáng tin với địa chỉ Gmail; với email domain riêng, nó phản ánh xác minh trong quá khứ —
  lý do D-03 vẫn đòi chứng minh khi liên kết vào account có sẵn.
- Có đặt được claim `email_verified` trong `mock-oauth2-server` không: chưa thấy nguồn xác nhận; kiểm khi viết test.
- Cookie correlation của OAuth trên `http://localhost` trong trình duyệt dev: chưa kiểm.

## Ý nghĩa

- D-02: tạo account chỉ *sau* khi xác minh mã (không có trạng thái "chưa xác minh") — chặn gốc kiểu 1, 3, 5.
- D-02: reset mật khẩu đổi security stamp, huỷ đổi email đang chờ, gửi danh sách cách đăng nhập — chặn kiểu 2, 4.
- D-03: liên kết theo `(provider, subject)`, chứng minh quyền trước khi gộp, không tin email chưa xác minh.
- D-04: OAuth chỉ ở prod là hợp lý; test bằng scheme giả và mock server.
- D-13: games origin đang là subdomain anh em của hub dưới `vinetic.io.vn` — cần nhớ khi đặt `ServerDomain` cho passkey.

## Nguồn

- [Pre-hijacked accounts — USENIX Security 2022](https://www.usenix.org/conference/usenixsecurity22/presentation/sudhodanan) · [arXiv 2205.10174](https://arxiv.org/abs/2205.10174v1)
- [MSRC: Pre-hijacking attacks](https://www.microsoft.com/en-us/msrc/blog/2022/05/pre-hijacking-attacks)
- [Supabase: identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) · [Clerk: account linking](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/account-linking) · [Lucia: account linking](https://v3.lucia-auth.com/guides/oauth/account-linking) · [WorkOS: OAuth auto-link và chiếm account](https://workos.com/blog/oauth-auto-link-email-account-takeover)
- [Google Cloud: Manage OAuth Clients](https://support.google.com/cloud/answer/15549257)
- [GitHub REST: emails](https://docs.github.com/en/enterprise-server@3.4/rest/users/emails)
- [ASP.NET Core: passkeys](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/passkeys)
- [navikt/mock-oauth2-server](https://gittrend.io/repo/navikt/mock-oauth2-server)
