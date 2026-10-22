# Log — Review trước launch

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

## 2026-10-22 (sửa ngày) — agent

- Các mục ghi "2026-10-23" là ngày agent tự ghi sai — hệ thống chỉ báo đổi ngày một lần, sang 2026-10-22. Đã sửa
  mọi ngày đó về 2026-10-22 trong plan; nhãn trong ngoặc của các mục log giữ thứ tự.

## 2026-10-22 (gom gọn) — agent

- Owner: "rất hợp lý, theo đề xuât tôi chốt nha" → **D-06 decided** (B); brief **confirmed**; plan gom gọn: mỗi item có
  *Kết luận* ở đầu, D-01 viết lại theo quyết định cuối, `design.md` v1 ghép mọi quyết định, `map.md` và `PLAN.md` viết lại.
- Phase **Graduate — đợt 1**: G0 (ADR 0046, 0047 + `surfaces.md`) → G1 → G2a ∥ G3 → G2b ∥ G4 → G5 ∥ G6 → G7. Tiếp: G0.

## 2026-10-22 (đêm) — agent

- Backlog sản phẩm: `docs/roadmap/product-backlog.md`, PB-01…PB-19, PR #110.
- R-06 + **D-06 proposed** (B: nội dung game trong `games/<id>/page/{vi,en}.md`, sự thật từ `game.json`, build sinh trang,
  `hreflang`, JSON-LD, ảnh OG từng game; bộ sưu tập từ ~8 game; cho phép rõ bot tìm kiếm của AI). Chờ owner Q1–Q4.

## 2026-10-22 (khuya, sau) — agent

- Owner: ý hay vào backlog có tracking; ưu tiên chốt thiết kế bề mặt (bố cục, UX, giới thiệu, SEO, GEO, mở rộng), rồi build,
  rồi game → plan chia **đợt 1 / đợt 2**; D-03 **deferred** → `docs/roadmap/product-backlog.md` (PR riêng); **D-06** mở,
  scout đang nghiên cứu SEO, GEO, mở rộng.

## 2026-10-22 (khuya) — agent

- Owner: D-05 ở **L1** (game do owner thêm; luật leo thang thành chủ đề trong spec) → **D-05 decided**.
- Owner: học từ miniblox.io và sản phẩm tương tự, đề xuất mạnh → hai scout → R-05, **D-03 proposed** (bậc 1: 7 mục trước
  launch, gồm thử thách hôm nay và bàn của gia đình; bậc 2: màn hình chung, bàn theo lượt, mùa Tết, thẻ kết quả).

## 2026-10-22 (tối) — agent

- Owner: D-01 tạm chốt (`x-default` → `/en/`). D-05: vì sao cách ly game, đổi góc nhìn → giải thích thang cách ly L0–L3,
  mô hình mặt phẳng (ADR 0042 đã là nó); đề xuất viết rõ mặt phẳng + luật leo thang vào ADR của D-02.

## 2026-10-22 (sau) — agent

- Owner: Q3 hợp lý (bản vi gốc); **đổi lại mặt chính sang tiếng Việt**, en hỗ trợ người nước ngoài, tên riêng và thuật ngữ
  giữ tiếng Anh → D-01 cập nhật (`/` vi, `/en/` en, `x-default` → `/en/` chờ duyệt).
- Owner: subdomain không tách được ư, hai domain tốn → giải thích origin vs site (PSL); D-05 quay về đề xuất A.

## 2026-10-22 — agent

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
