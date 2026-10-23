# D-15 — Agent đăng nhập vào Tò He bằng gì, để Studio hôm nay và việc vận hành sau này dùng chung?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-05, E-07 · Blocked by: D-11
- Decided: owner, chat 2026-10-23: "ổn đó"

## Why it matters

D-11 cho agent tạo bản nháp bằng một token hẹp. Owner muốn sau này agent "cùng quản lý trên đó luôn (monitoring, update
tự động, nhạy cảm thì k, ...)". Nếu token của Studio được làm riêng một kiểu, thì việc vận hành sau này sẽ làm thêm một
kiểu nữa, với hai bộ luật, hai chỗ thu hồi và hai nhật ký.

## What is true today

- Chỉ có người đăng nhập: session của hub và session của console (`docs/architecture/admin.md`). Không có danh tính máy
  hay API key nào.
- Console kiểm *permission* trên mỗi request, đọc lại role mỗi lần (thu hồi có hiệu lực ngay) và ghi audit log
  (`role.grant`, `role.revoke`…).
- ADR 0042 giữ chỗ `api.` "only for a public API with keys", không cookie.
- `AGENTS.md:42`: production chỉ đọc. D-11 đã mở ngoại lệ đầu tiên, cho quyền tạo bản nháp.

## Options

### A — Token riêng của Studio

Nhanh cho P0. Việc vận hành sau này phải làm lại từ đầu.

### B — Một cơ chế token cho agent của cả nền tảng, Studio là quyền đầu tiên

- **Danh tính agent:** mỗi agent (hay mỗi máy) là một principal có tên, do owner tạo trong console.
- **Token mang danh sách quyền (scope)** theo kiểu cho phép. P0 chỉ có `studio.draft`. Plan vận hành sau này thêm
  `ops.read` (monitoring), `ops.update` (cập nhật được cho phép)…
- **Không bao giờ có scope nhạy cảm**, đúng ý owner "nhạy cảm thì k": dữ liệu người chơi, đăng nhập, role, xoá, duyệt
  asset, cấu hình bí mật. Danh sách cấm nằm trong code, có test, không bật được bằng cấu hình.
- **Có hạn dùng, thu hồi ngay**, được kiểm trên mỗi request như role của console.
- **Mỗi lần dùng đều ghi audit** (agent nào, scope nào, làm gì).
- **Agent gọi vào đâu** (hỏi phụ, chốt khi graduate): endpoint của từng app (`studio.` cho `studio.draft`), hay một host
  máy chung (`api.`, đã giữ chỗ). Agent không dùng cookie, nên không gặp rủi ro CSRF. Nhưng host nào nằm sau Cloudflare
  Access thì cần service token của Access.

### C — Dùng tài khoản người cho agent

Agent đăng nhập như một người. Không giới hạn được quyền, không phân biệt được người với máy trong nhật ký. Loại.

## Recommendation

**B.** Chi phí P0 gần như A: một bảng token, một middleware kiểm scope, một trang trong console. Đổi lại, plan vận hành
sau này chỉ thêm scope, không phải làm lại.

Chi phí chấp nhận:

- Đặt tên scope phải cẩn thận ngay từ đầu.
- Danh sách cấm là luật của nền tảng, nên cần ADR, có thể gộp với ADR của D-01 hoặc tách riêng.

## Decision

**B**, owner: "ổn đó" (2026-10-23).

**Hệ quả:**

- Một cơ chế token cho agent của cả nền tảng; `studio.draft` là scope đầu tiên.
- Danh sách scope cấm nằm trong code, có test.
- Có hạn dùng, thu hồi ngay, có audit. Console là nơi cấp và thu hồi.
- Agent gọi vào host nào thì chốt khi graduate.
- Plan "agent cùng vận hành" về sau chỉ thêm scope.

## Discussion

**agent** (2026-10-22): plan "agent cùng vận hành" không nằm trong plan này (*Not this plan* của brief). D-15 chỉ đảm
bảo nó không phải làm lại phần danh tính.
