# D-04 — Các cách đăng nhập v1, cấu hình hai lớp, OAuth chỉ ở prod

- Status: **decided** (2026-10-17, chat)
- Kind: decision
- Blocks: T4 spec, E-04 (khoá cấu hình trong chart), D-07 (màn cài đặt đăng nhập) · Blocked by: D-02, D-03
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Nội dung đã chốt

**Cách đăng nhập v1:** email + mật khẩu; Google; GitHub; một provider OIDC chung (để sau này cắm Dex, Keycloak hay
identity của `platform` mà không phải viết code). Passkey làm sau — .NET 10 Identity đã có sẵn
([R-01](../research/R-01-auth-linking.md)).

**Cấu hình hai lớp:**

| Lớp | Ở đâu | Quyết định gì |
|---|---|---|
| Deploy | env / chart / Infisical (`Auth__Providers__Google__ClientId`…) | Cách nào *có sẵn*: chưa có secret thì không có |
| Runtime | admin console, lưu trong DB | Cách nào *đang bật*; chế độ đăng ký `open | invite | closed` (D-12) |

Runtime không bật được cách chưa cấu hình. Lúc khởi động có guard: email + mật khẩu cần hạ tầng email (E-02); phải
còn ít nhất một cách đăng nhập. Hub đọc danh sách cách đang bật từ `GET /api/config`.

**Theo môi trường:**

| Môi trường | Cách đăng nhập | Email |
|---|---|---|
| dev (localhost) | email + mật khẩu; OAuth chỉ khi dev tự cấu hình app OAuth trỏ `localhost` (Google và GitHub đều cho phép) | Mailpit |
| UAT | email + mật khẩu | email thật (Resend) — gia đình là người dùng thật |
| prod | email + mật khẩu, Google, GitHub | Resend |

**Test khi UAT không có OAuth:** logic liên kết được test ở API bằng một scheme giả trả về `(provider, subject,
email, email_verified)` tuỳ ý (WebApplicationFactory); thêm một test e2e với `navikt/mock-oauth2-server` cho handler
OIDC. Trước khi mở public, prod chạy với đăng ký `closed`/`invite` nên owner thử Google/GitHub trên prod thật trước.

Bẫy riêng của code mình (đã ghi lại để spec T4 không quên):
- `SameOriginGuard` chặn POST từ origin khác vào `/api` (`services/api/src/Tohe.Api/Infrastructure/Security/SameOriginGuard.cs`).
  Handler OpenID Connect mặc định dùng `response_mode=form_post`, nên callback sẽ bị chặn. Dùng `query`, hoặc miễn
  trừ đúng một path callback.
- Cookie correlation/nonce của OAuth là `SameSite=None; Secure`, chỉ chạy trên HTTPS hoặc localhost — đúng với lựa
  chọn "OAuth chỉ ở prod".
- `AllowedHosts` đang là `*` (`appsettings.json`) — phải cố định theo host của hub trước khi mở public (và trước khi
  có passkey).

## Decision

**owner** (2026-10-17, chat): "các cấu hình oauth đa số sẽ đc dùng ở prod (trên đó có https dễ chạy luôn), con uat
hay dev local ta cứ dùng thủ công"; danh sách provider theo đề xuất trước đó (Google + GitHub) — "còn lại các dề xuất
của bạn ổn nha".

Hệ quả: UAT không còn cần HTTPS cho OAuth → D-15. Câu hỏi Facebook/Zalo cho người dùng phổ thông không được trả lời
riêng; ghi nhận là *không thuộc v1*, mở lại khi một cộng đồng cần.
