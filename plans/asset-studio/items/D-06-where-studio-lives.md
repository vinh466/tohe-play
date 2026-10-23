# D-06 — Studio lưu asset và state ở đâu?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-11, E-02 · Blocked by: D-05
- Decided: owner, chat 2026-10-22: D ngay từ đầu, kèm cơ chế cache cho build

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

**D ngay từ đầu**, không qua bước git. Owner:

> "D-06 cho nhẹ đầu thì dùng object storage và quản lý state trong db nhé, build sẽ chịu là có mạng và phụ thuộc vào
> store (nếu có dùng) (nên xây dựng cơ chế cache nha), bạn thấy sao"

Agent đồng ý (Discussion bên dưới). Đề xuất A → D của agent được thay bằng D. Không có bước migrate, repo không phình,
và nhạc dùng được ngay. Đổi lại, P0 nặng hơn: phải có module Studio, bucket và một màn duyệt (D-11) trước pilot.

**Hệ quả:**

1. **Hai nơi, hai vai trò.**
   - PostgreSQL (module `Studio`) giữ *state*: pack, version, trạng thái `draft` → `approved` → `deprecated`, nguồn gốc,
     ai duyệt.
   - Object storage giữ *file*, theo sha256.
   - Khi duyệt, Studio ghi một **manifest bất biến** `packs/<id>/<version>.json` (danh sách file và hash) lên bucket.
2. **Build chỉ cần bucket, không cần API.** Resolve `pack@version` bằng manifest, tải file theo hash, rồi **kiểm hash**.
   File đã duyệt là đọc công khai (đằng nào chúng cũng được ship trong game), nên CI không cần credential để đọc. Bản
   nháp thì riêng tư.
3. **Cache (E-02):**
   - Thư mục cache theo hash dùng chung cho mọi worktree trên máy (vd. `~/.cache/tohe/assets/sha256/…`). Đọc từ cache
     thì kiểm hash lại.
   - CI cache theo hash của mọi lock, chỉ tải phần còn thiếu.
   - Lock được commit cùng game, nên có cache là build không cần mạng.
   - Cờ `--offline`: thiếu file thì báo rõ thiếu gì, không im lặng.
4. **Một registry cho mọi môi trường, giống npm.** Build được đẩy từ UAT lên prod theo tag (ADR 0041) và asset đã nằm
   trong build, nên thư viện không tách theo môi trường. Dev stack có MinIO trong compose (cổng 47xx) để phát triển
   chính Studio.
5. **Nơi lưu (agent đề xuất):** R2 cho registry, vì nằm ngoài homelab, egress miễn phí, đi sau Cloudflare, và owner đã
   dùng nó cho bản sao lưu. Bậc miễn phí khoảng 10 GB-tháng, 1 triệu thao tác ghi và 10 triệu thao tác đọc, theo nguồn
   thứ ba [1], cần kiểm lại trên trang của Cloudflare. Credential nằm trong Infisical (owner). Bucket và DNS là việc
   của `platform-infra`.
6. **Câu hỏi mới chuyển sang D-11:** Studio chạy ở đâu, và agent ghi bản nháp vào đó bằng gì. Nếu Studio là module của
   API prod, thì cho agent ghi vào nó là một ngoại lệ của luật "production chỉ đọc từ ngoài" (`AGENTS.md:42`), và chỉ
   owner mở được ngoại lệ đó.

[1] [Filebase: Cloudflare R2 pricing 2026](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/)

## Discussion

**agent** (2026-10-22): R2 nằm sau Cloudflare, nên đọc theo hash sẽ được cache tốt. Điều này cũng hợp với D-13, khi
`precache` và `on-demand` cần một nơi phục vụ ổn định hơn homelab.

**owner** (2026-10-22): chọn D ngay từ đầu (trích ở *Decision*).

**agent** (2026-10-22): đồng ý. Ba điều làm cho lựa chọn này chắc:

1. Hash nằm trong lock, nên store chỉ là nơi *lấy* file, không phải nơi *quyết* file nào. Build vẫn tái lập được.
2. Manifest của mỗi version là bất biến trên bucket, nên build không phụ thuộc API hay DB.
3. Cache theo hash dùng chung giữa các worktree. Agent chạy nhiều worktree song song thì chỉ tải mỗi file một lần.

Rủi ro còn lại là CI chạy khi cache còn lạnh mà store sập. Owner đã chấp nhận: build fail và báo rõ.
