# Log — Review trước launch

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

## 2026-10-23 (sau) — agent

- Owner: Q3 hợp lý (bản vi gốc); **đổi lại mặt chính sang tiếng Việt**, en hỗ trợ người nước ngoài, tên riêng và thuật ngữ
  giữ tiếng Anh → D-01 cập nhật (`/` vi, `/en/` en, `x-default` → `/en/` chờ duyệt).
- Owner: subdomain không tách được ư, hai domain tốn → giải thích origin vs site (PSL); D-05 quay về đề xuất A.

## 2026-10-23 — agent

- Owner: **D-01 decided** — Q1 B; Q2 tên game tiếng Anh bắt buộc + tên theo ngôn ngữ tuỳ chọn (đổi Game Contract); Q4
  **tiếng Anh mặc định** (`/` en, `/vi/`), gợi ý vi khi trình duyệt đặt vi. Q3: agent gợi ý vi là bản gốc theo Luật BVQLNTD
  2023 Điều 23 (bản có lợi hơn cho người dùng được áp dụng khi lệch) — chờ owner.
- D-05: owner sẵn sàng tách ngay → agent đổi đề xuất sang B; trang giới thiệu hay game sang `vinetic.io.vn`: không nên.

## 2026-10-22 (khuya, sau) — agent

- Builder tái hiện rủi ro cập nhật bằng test hai bản build (Chromium) → **không có màn lỗi**: HTTP cache giữ file cũ; khi
  mất cache, TanStack Router tự nạp lại một lần. Agent đã đánh giá sai (chưa đọc code thư viện). D-04 §4 về *proposed*,
  không PR riêng; test giữ ở worktree `agent-a8048e1129181a666` (chưa commit). Safari/iOS chưa thử.

## 2026-10-22 (khuya) — agent

- Owner: "ok sửa rủi ro cập nhật trước đi, D-02 D-04 chọn B" → **D-02, D-04 decided** (B). Sửa cập nhật an toàn: PR riêng
  từ `main`, builder (Opus · high), tái hiện bằng test trước khi sửa.
- Owner: review lại chia host/subdomain/path đã tối ưu chưa → scout + kiểm code → R-04, **D-05 proposed** (A: giữ;
  game sang domain riêng khi có game không do repo viết; Access cho console trước launch).

## 2026-10-22 (tối) — agent

- Owner hỏi đã khảo sát việc quay lại / app đã cài chưa → chưa (chỉ lần mở đầu ở Phase 1). Hai scout → R-03, **D-04 proposed**.
- Phát hiện: `autoUpdate` + `skipWaiting` + xoá cache cũ, không bắt lỗi nạp lười → **rủi ro màn lỗi sau mỗi deploy**
  (chưa tái hiện); đề xuất PR riêng làm ngay. `rooms.mine()` có mà không màn nào dùng; lời mời chỉ cho account.

## 2026-10-22 (chiều) — agent

- Owner: nghiên cứu sâu bố cục, "1 giai phap hien dai … gia rat re" → hai scout (Opus): kiểm kê màn trong code, tiền lệ
  trên web → R-02; **D-02 proposed** (B: hai vùng Khám phá/Chơi, khung app ba mục, `/` danh mục trước, bỏ redirect).
- **D-01 proposed** (B: `/en/` + hreflang trong sitemap cho trang công khai; ngôn ngữ là cài đặt trong app; link không
  mang ngôn ngữ). Chờ owner: D-02 Q1–Q5, D-01 Q1–Q4.

## 2026-10-22 — agent

- Owner trả lời Q1 (rà toàn bộ cái đang có), Q4 (vi + en mọi chỗ của người chơi, trang giới thiệu có SEO, console chỉ
  tiếng Anh, Điều khoản + Quyền riêng tư hai ngôn ngữ), Q5 (không đặt ngày launch) → brief, map (9 item nháp).
- Owner hỏi "trang giới thiệu vào từ đâu" → R-01: chỉ người lần đầu tới `/`; app không có đường ra trang công khai.
- Chờ owner: Q2, Q3, xác nhận brief.

## 2026-10-21 — agent

- Owner: "ok mở plan launch-review và viết brief đi" → plan mở ở *Frame*; brief nháp với Q1–Q5; map nháp 7 item.
- `product-surface` E-05 (Cổng) chuyển sang đây thành E-01 (`git mv`, link đã sửa); *Waiting on the owner* chuyển theo.
- Chờ owner: chốt brief, Q1 (phạm vi so với Phase 2/3) trước tiên.
