# R-01 — Rà soát việc dang dở sau ngày lên prod

- Date: 2026-10-19 · Feeds: E-01, E-04, E-05, D-01, D-03, E-02, E-03

## Question

Sau khi production chạy (2026-10-19), còn những việc gì dang dở — ở plan `public-launch`, trong spec, trong repo, ở
phía owner — và mỗi việc cần tới mức nào, xếp vào đâu?

## Cách xếp mức

| Mức | Nghĩa |
|---|---|
| **Ngay** | Rẻ (vài phút), giảm một rủi ro có thật hôm nay. Không chờ plan. |
| **P0** | Nền của plan này: luồng phát triển · kiểm thử · môi trường, và spec phải đúng ([E-01](../items/E-01-dev-test-env-flow.md), [E-04](../items/E-04-spec-truth.md)). |
| **P1** | Bề mặt sản phẩm: domain, trang công khai, người mới, PWA (D-01…D-04, E-02, E-03). |
| **Cổng** | Phải xong trước khi mời người ngoài vào prod — [E-05](../../launch-review/items/E-01-gate-before-outsiders.md). Không chặn P0/P1. |
| **Sau** | Phase 2 (hub) / Phase 3 (game), hoặc chờ một điều kiện. Ghi lại, không lên kế hoạch ở đây. |

## Findings

### A. Việc chỉ owner làm được (từ `public-launch` → *Waiting on the owner*)

| # | Việc | Sự thật hôm nay (kiểm 2026-10-19) | Mức | Ghi chú |
|---|---|---|---|---|
| A1 | **DMARC** — ✔ owner sửa xong (kiểm lại 2026-10-19 tối: `_dmarc.toheplay.io.vn` = `v=DMARC1; p=none;`) | lúc rà: `_dmarc.toheplay.io.vn` **không có** bản ghi; `v=DMARC1; p=none;` đang nằm ở TXT của **gốc** `toheplay.io.vn` — sai chỗ, không có tác dụng (dns.google DoH) | **Ngay** | Cloudflare → DNS: sửa *Name* của bản ghi đó từ `@` thành `_dmarc`. |
| A2 | Chế độ đăng ký + proof-of-work | `/api/config`: `registration: open`, `proofOfWork: false` | **Ngay** (bật proof-of-work) · chế độ đăng ký → **D-03** | Domain đã công khai; bot đăng ký được thì tốn quota Resend (100 thư/ngày gói Free) và uy tín gửi thư. Chuyển sang "theo lời mời" **chặn luôn link mời vào bàn** của người mới (xem E-03) — nên quyết ở D-03, còn proof-of-work bật được ngay. |
| A3 | Duyệt Điều khoản + Quyền riêng tư, cách liên hệ người vận hành | bản nháp trong `apps/hub/src/legal/documents.ts` | **Cổng** (+ P1: trang công khai cần link tới) | |
| A4 | Đồng ý cho agent làm phần F4 chạm vào prod | chưa | **Cổng** | thử khôi phục backup, load test phòng, security review, thư tới Gmail/Outlook/Yahoo |
| A5 | Alertmanager của prod (E-08 Q2) | tắt, 6 cảnh báo không báo ai | **Cổng** | cần địa chỉ nhận + credential SMTP ở `platform-infra` |
| A6 | UAT lên `d685547`; key Resend vào `uat.env` | UAT chạy `c49746c`; email UAT tắt → **người mới không đăng ký được trên UAT** | Ngay (rẻ, tuỳ owner) | nói "deploy" |
| A7 | E-07 Q7 — thời hạn xoá theo văn bản gốc | mở | **Cổng** | |
| A8 | OAuth Google/GitHub trên prod | owner 2026-10-18: "email + mật khẩu trước, providers sau" | **Sau** — nhưng xem D-03 | Đăng nhập bằng Google bỏ bước chờ mã email, là đòn bẩy lớn cho người mới. |
| A9 | Thử trên iPhone: âm thanh (#30), phòng chơi (spike S5), polish #41, PWA trên prod | chưa có kết quả | **P1** (vòng thử thiết bị của E-03) | iOS ≈ 40 % điện thoại ở Việt Nam ([R-03](R-03-pwa-install-newcomer.md)) |

### B. Việc của agent còn mở

| # | Việc | Sự thật | Mức |
|---|---|---|---|
| B1 | E-10 / F4 checklist ra mắt | `open` trong `public-launch` | **Cổng** — chuyển thành [E-05](../../launch-review/items/E-01-gate-before-outsiders.md) |
| B2 | Script kiểm môi trường nằm ngoài repo | `prod-check.sh`, `uat-step2.sh`, `check-hosts.sh`, `mail-dns.sh` chỉ có trong thư mục tạm của agent | **P0** (E-01) |
| B3 | Chart chưa có khối email riêng | prod truyền cấu hình email qua `api.extraEnvFrom` — chạy được | Sau |
| B4 | `plans/public-launch` | phase Graduate; mọi PR đã merge + deploy; chỉ còn E-10 | **P0** — đóng plan đó khi E-10 sang đây |
| B5 | Telemetry của prod | `/health-report` đọc UAT; prod cần operator token (Infisical, tuỳ chọn) — agent chưa kiểm báo cáo prod | Cổng |

### C. Spec đang nói sai với thực tế (agent đọc `docs/` như spec → nguy hiểm nhất)

| # | Chỗ | Đang nói | Thực tế | Mức |
|---|---|---|---|---|
| C1 | `docs/vision.md` | "A public community is explicitly **not** a goal"; non-goals: public leaderboards, anti-cheat ngoài replay, quy mô quá vài chục người | ADR 0029–0031 (bảng công khai, engine độ tin), ADR 0021/0040 (prod công khai) | **P0** |
| C2 | `docs/index.md` | "built for one family and its friends"; Site = landing + docs | hướng public; bố cục host mới (D-01) | **P0** |
| C3 | `docs/roadmap/walking-skeleton.md` | Production = "Later"; "Known gaps in M0" cũ; không có mốc nào cho public launch | prod chạy từ 2026-10-19 | **P0** |
| C4 | `docs/guides/uat.md` | "There is no production environment yet" | có prod | **P0** |
| C5 | `AGENTS.md` | có luật cho UAT, **không có luật cho production** | prod ở `platform-infra`, agent chỉ đọc từ ngoài | **P0** |
| C6 | Landing (`apps/site/src/pages/index.astro`) | "dự án gia đình", nút thứ hai là "Tài liệu kỹ thuật", hứa "chơi được cả khi mất mạng" | games origin chưa có service worker (spike S1) — game đã mở một lần chỉ nằm trong cache trình duyệt | **P1** (E-02) |

### D. Bề mặt production (kiểm từ ngoài, chỉ đọc, 2026-10-19)

| # | Sự thật | Mức |
|---|---|---|
| D1 | Landing nằm ở `docs.toheplay.io.vn/` cùng host với tài liệu kỹ thuật tiếng Anh (`/docs/`); gốc `toheplay.io.vn` là SPA | **P1** (D-01) |
| D2 | Hub trả `200 text/html` (index.html của SPA) cho `/robots.txt`, `/sitemap.xml` và mọi đường dẫn không tồn tại → soft-404, không robots/sitemap ở domain chính | **P1** (D-01, E-02) |
| D3 | HTML của hub chỉ có `<title>Tò He</title>`: không description, không Open Graph → link chia sẻ qua Zalo/Messenger không có ảnh xem trước; crawler AI (không chạy JS) thấy trang trống | **P1** (E-02) |
| D4 | Manifest PWA không có `id`; `start_url: "/"`, `scope: "/"` → danh tính app = `start_url`; đổi `start_url` sau khi người ta đã cài là thành app khác | **P1** — rẻ nhất là làm **trước khi** mời ai (D-01) |
| D5 | Người mới vào gốc → `/welcome`: form đăng nhập, câu "Bố mẹ đăng nhập một lần…", "Chơi thử" là nút mờ cuối trang; không có hướng dẫn cài app nào (không xử lý `beforeinstallprompt`, không hướng dẫn iOS) | **P1** (E-03) |
| D6 | Link bàn `/r/<code>`: người chưa có account bị chuyển sang `/register` (`JoinPage.tsx`) — phải đăng ký, chờ mã email rồi mới ngồi vào bàn | **P1** (E-03, D-03) |
| D7 | Scalar `/api/docs` và `/api/openapi/v1.json` mở công khai trên prod | Sau (repo đã công khai; ghi ở D-01) |
| D8 | `robots.txt` của `docs.` và `games.` là bản do Cloudflare chèn (chỉ có comment về content signals, không có chỉ thị) | P1 (E-02) |

### E. Roadmap / game / phụ thuộc — không thuộc plan này

| # | Việc | Mức |
|---|---|---|
| E1 | Lấp Ô — `games/fill-blocks/SPEC.md` chờ owner review | Sau (Phase 3) |
| E2 | Spike S1 (service worker cho games origin), S3 (fullscreen/safe-area iOS), S4 (Godot), S5 (SignalR trên iPhone) | Sau; S5 + iPhone gộp vào vòng thử thiết bị của E-03 |
| E3 | Telemetry phase 3 (crash trình duyệt, báo cáo CSP) | Sau (Phase 2) |
| E4 | D-15 UAT có HTTPS | Sau — trong lúc prod chỉ có owner, prod là chỗ thử PWA (E-01) |
| E5 | Dependabot #4, #5, #6 (giữ mở có chủ đích, `upgrade-watchlist.md`); Node 26 LTS dự kiến cuối 10/2026 → #5 và việc đồng bộ Node 26 thành làm được | Sau (một PR nhỏ khi Node 26 lên LTS) |
| E6 | Console admin ra host riêng (cô lập phiên admin khỏi hub) | Sau — giữ tên `admin.` (D-01) |
| E7 | Gửi thư từ subdomain | Sau — đi cùng D-02 |

## Assumptions

- "Người mới không đăng ký được trên UAT" suy từ `docs/guides/uat.md` (đăng ký cần mã qua email; UAT chưa có key) — chưa
  thử tay.
- Thứ tự và mức ở trên là ý kiến của agent; owner chốt từng mục ở item tương ứng.

## So what

- Hai việc **Ngay** (A1 DMARC, A2 proof-of-work) owner làm trong vài phút, không chờ gì.
- Spec sai (C1–C5) là việc đầu tiên của agent: agent và owner đọc `docs/` như spec, nên spec sai làm hỏng mọi việc sau.
- Bề mặt production (D1–D6) chính là đầu vào của Phase 1.
- `public-launch` đóng được: phần còn lại của nó (E-10 và các việc owner) chuyển thành **Cổng** (E-05).
