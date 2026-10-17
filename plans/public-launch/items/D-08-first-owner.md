# D-08 — Admin đầu tiên khi cài mới

- Status: **decided** (2026-10-17, chat)
- Kind: decision
- Blocks: T6 spec, E-04 (secret `Admin__SetupToken` trong chart) · Blocked by: D-07
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Vì sao không để "ai vào trước thì thành chủ"

Owner muốn: "lần đầu vào platform admin chưa có admin thì cho đăng ký lần đầu". Trên một URL public, ai vào `/admin`
trước người cài đặt sẽ thành chủ. Cách "người đầu tiên thắng" của nhiều app chỉ an toàn trong mạng kín
([R-02](../research/R-02-first-admin.md)).

## Nội dung đã chốt — ghép ba cách đã được kiểm chứng

| Lấy từ | Cách |
|---|---|
| Jenkins | token cài đặt in ra log (hoặc lấy từ secret), phải nhập ở trang setup |
| Discourse | danh sách email được phép thành admin (`DISCOURSE_DEVELOPER_EMAILS`) |
| Mastodon | lệnh CLI cấp quyền Owner chạy trong container (`tootctl accounts modify … --role Owner`) |

1. API khởi động mà **chưa có Owner** → bật *setup mode*. Nếu không cấu hình `Admin__SetupToken`, API tự sinh token
   và ghi một dòng log cảnh báo: `No platform owner yet — open https://<hub>/admin/setup, token: XXXX-XXXX`.
2. `/admin/setup`: nhập token → đăng ký hoặc đăng nhập bằng luồng bình thường (email đã xác minh) → nhận Owner →
   setup mode tắt **vĩnh viễn** (ghi vào DB) → bắt bật 2FA trước khi vào admin → ghi audit log.
3. Tuỳ chọn `Admin__BootstrapEmails`: nếu có, chỉ những email này được nhận Owner.
4. Lối thoát khẩn cấp: `dotnet Tohe.Api.dll admin grant <email> --role owner` chạy qua `kubectl exec` / `docker
   compose exec` — dùng khi mất quyền Owner; cũng ghi audit log.

Sơ đồ: [design.md §3.13](../design.md#313-admin-đầu-tiên).

## Decision

**owner** (2026-10-17, chat): "còn lại các dề xuất của bạn ổn nha" — chấp nhận đề xuất setup token thay cho "ai vào
trước thì thành chủ" trong review cùng ngày.
