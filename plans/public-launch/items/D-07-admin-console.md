# D-07 — Admin console: làm gì, đặt ở đâu, ai được vào

- Status: **decided** (2026-10-17, chat)
- Kind: decision
- Blocks: D-08, T6 spec · Blocked by: —
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Nội dung đã chốt

**Phạm vi:** console của chủ sản phẩm — người dùng, cách đăng nhập, chế độ đăng ký, game, sức khoẻ thiết bị, hệ
thống. **Không dựng lại Grafana:** số liệu hạ tầng nằm ở Prometheus/Grafana của `platform-infra`; admin chỉ link sang.

**Vị trí:** app riêng `apps/admin` (React + design tokens, ưu tiên desktop), phục vụ ở `/admin/` trên cùng origin với
hub — cùng cookie, không CORS. Không có service worker, CSP chặt, `noindex`. API ở `/api/admin/*`, với tài liệu
OpenAPI riêng để type sinh ra cho hub không lẫn endpoint admin. Sau này dời được sang host riêng (Cloudflare Access)
mà không sửa code.

**Vai trò → quyền:** Owner, Admin, Moderator, Viewer, ánh xạ sang permission (`admin.users.write`…) để đổi vai trò
mà không đổi code kiểm tra.

**Bảo vệ:** admin bắt buộc 2FA (TOTP có sẵn trong ASP.NET Core Identity); thao tác nhạy cảm cần xác thực lại mức 2
(D-05); mọi thao tác ghi vào **audit log** chỉ được thêm, không sửa.

**Module:**

| v1 — cần trước khi public | Sau |
|---|---|
| Tổng quan: account mới, DAU, kết nối live, phòng đang mở, lỗi 24h, version, lần sync catalog | Theo dõi phòng live (đóng phòng, mời ra) |
| Người dùng: tìm theo email hoặc ID hồ sơ, chi tiết account + hồ sơ + cách đăng nhập, khoá/mở, đăng xuất mọi nơi, gửi lại mã, xoá; đổi tên/ẩn một hồ sơ, xem lịch sử tên (D-01, D-17) | Hàng đợi báo cáo vi phạm |
| Đăng nhập & đăng ký: bật/tắt từng cách (D-04), chế độ đăng ký, **mã mời theo cộng đồng** (D-12) | Feature flags tổng quát |
| Game: ẩn/hiện, "chỉ admin" (thử game mới ngay trên prod), thứ tự nổi bật | Biểu đồ theo thời gian |
| Bảng xếp hạng: gỡ một dòng, ẩn hồ sơ khỏi bảng (D-09); **Chờ xem xét** — hàng đợi của engine độ tin, xem lại run bằng chính game, duyệt/từ chối/mở lại (D-16, proposed) | Xuất dữ liệu |
| Sức khoẻ: giao diện cho telemetry (ADR 0015) · Hệ thống: background workers, gửi email thử, banner bảo trì · Audit log | |

## Decision

**owner** (2026-10-17, chat): "còn lại các dề xuất của bạn ổn nha" — chấp nhận phần admin trong review cùng ngày.
Mục tiêu gốc: "1 platform admin place UI để tôi có thể quản lý nền tảng, monitor, làm những việc ở cấp app owner".

Bổ sung sau D-01 và D-17 (chờ owner xem): module Người dùng quản lý cả **hồ sơ**, tìm theo **ID hồ sơ**, và xem lịch
sử tên; module Bảng xếp hạng có hàng đợi **Chờ xem xét** của engine (D-16).
