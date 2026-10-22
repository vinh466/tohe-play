# D-06 — Studio P0 lưu ở đâu, và đi tiếp lên P1 thế nào?

- Status: **proposed** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-11, E-02 · Blocked by: D-05
- Decided: —

## Why it matters

Agent phải tìm, thêm và duyệt được asset ngay. Build phải tái lập được: cùng lock thì ra cùng file. Repo public nên mọi
thứ trong đó đều công khai.

## What is true today

- Repo `vinh466/tohe-play` **public**, khoảng 4,5 MB, chưa có LICENSE (`gh repo view`, 2026-10-22).
- Git LFS trên GitHub Free có **10 GiB lưu trữ và 10 GiB băng thông mỗi tháng**. Mỗi lần CI checkout file LFS là trừ
  băng thông (R-01).
- Hạ tầng không có object storage cho Tò He. R2 chỉ dùng để sao lưu PostgreSQL (ADR 0021).
- API là modular monolith (`services/api/src/Tohe.Api/Modules/`). Module `Registry` đã có mẫu "index từ một catalog".

## Options

### A — Trong monorepo này, git thường, có giới hạn kích thước

`assets/<pack>/` gồm `pack.json`, art bible, file, script hậu xử lý và kiểm tra. Duyệt = PR, owner merge. Pixel art rất
nhẹ (một bộ 16×16 cỡ vài chục KB). Thêm giới hạn mỗi file (ví dụ ≤ 256 KB) và tổng dung lượng, máy kiểm chặn khi vượt.

- **Được:** agent làm ngay trong chỗ quen; `turbo` biết phụ thuộc; không thêm hạ tầng; build tái lập.
- **Mất:** nhạc và ảnh lớn không vừa; mọi asset đều công khai (chỉ license cho phép phân phối lại mới vào được, D-07).

### B — Monorepo + Git LFS

Như A nhưng chứa được file lớn. Đổi lại là hạn mức băng thông, CI phải cache LFS, và clone phức tạp hơn.

### C — Repo riêng `tohe-assets`

Tách lịch sử. Nhưng agent phải làm việc trên hai repo, và version phải nối qua package hoặc submodule.

### D — Object storage (MinIO trên homelab hoặc R2) + metadata trong PostgreSQL (module Studio)

Nền đúng cho P1/P2 (UI upload, MCP). Nhưng build phải có mạng và credential, hạ tầng thêm một phụ thuộc, và homelab
từng sập vì DiskPressure.

## Recommendation

**A cho P0, rồi D cho P1, với cùng một mô hình (D-05).**

- **P0:** git là nguồn sự thật, PR là cổng duyệt.
- **P1:** pack đã duyệt được publish lên object storage theo hash. Metadata nằm trong module Studio. Repo chỉ giữ lock,
  nên build tải theo hash vẫn tái lập được.
- **B** chỉ dùng như cầu nối nếu có file lớn trước khi P1 sẵn sàng.

Chi phí chấp nhận: P0 không chứa nhạc dài, nên pilot dùng sfx ngắn hoặc nhạc sinh bằng code. Chuyển từ P0 lên P1 cần
một lần migrate (nhẹ, vì hash không đổi).

## Decision

—

## Discussion

**agent** (2026-10-22): R2 nằm sau Cloudflare, nên đọc theo hash sẽ được cache tốt. Điều này cũng hợp với D-13, khi
`precache` và `on-demand` cần một nơi phục vụ ổn định hơn homelab.
