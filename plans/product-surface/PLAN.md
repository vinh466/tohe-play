# Plan — Bề mặt sản phẩm (Phase 1)

- Goal: một người chưa biết Tò He tìm thấy nó, chơi ngay không cần tài khoản, được rủ vào đúng bàn hay đúng game bằng một
  link, rồi được dẫn cài app và giữ tiến độ vào account đúng lúc — trên một domain ổn định và một luồng phát triển · kiểm
  thử · môi trường đã viết thành spec.
- Phase: **Resolve → Converge** ([process](../README.md#phases)) — mọi item đã decided trừ **D-01** (Q2–Q6 chốt; Q1
  chờ owner xem phần mở rộng, Q7–Q8 mới) và E-02 Q2. Brief: owner "thấy cũng ổn r", "ổn nha, theo đề xuất" (2026-10-19).
- Started: 2026-10-19 · Branch: `plan/product-surface` (xếp trên `plan/public-launch`) · PR:
  [tohe-play#70](https://github.com/vinh466/tohe-play/pull/70) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (vòng đời một user ở §6) · Log: [log.md](log.md)
- Research: [R-01 việc dang dở](research/R-01-backlog-review.md) · [R-02 host, SEO, GEO](research/R-02-hosts-seo-geo.md) ·
  [R-03 người mới, PWA](research/R-03-pwa-install-newcomer.md) · [R-04 main + tag](research/R-04-delivery-model.md) ·
  [R-05 định danh, lối vào](research/R-05-identity-and-entry-prior-art.md)

## Next — one item

**Owner đọc [D-01 v3](items/D-01-host-and-path-layout.md) §3–§5** (một bản đồ namespace, luật path hay subdomain, giới
hạn thật) rồi chốt Q1, Q7, Q8. P0-1 không phụ thuộc D-01: agent bắt đầu P0-1 khi owner nói "làm".

## Waiting on the owner

1. [D-01](items/D-01-host-and-path-layout.md) Q1 (sau khi xem §3–§5) · Q7 gom route app vào `/play/…` + `/account/…` ·
   Q8 `apps/site` → `apps/docs`.
2. [E-02 Q2](items/E-02-public-pages-seo-geo.md) — cho AI *huấn luyện* trên nội dung không (`search`/`ai-input` đã bật).
3. **Cloudflare** — ~~DMARC~~ ✔. **Email Routing** (D-01 Q4): Email → Email Routing → bật cho `toheplay.io.vn` →
   *Destination addresses*: thêm hộp thư của owner, bấm link xác minh trong thư → *Routing rules → Create address*:
   `hello@` và `security@` → hộp thư đó → **Add records and onboard** (Cloudflare tự thêm 3 MX, SPF ở gốc, DKIM; không
   đụng `send.` của Resend). Báo agent để kiểm DNS và gửi thư thử. AI Crawl Control: Search cho phép. Xác nhận Bot Fight
   Mode / Under Attack / WAF challenge tắt. Sau P1-2: TXT Search Console + Bing.
4. **Console prod**: bật Chống bot đăng ký (proof-of-work vẫn tắt, kiểm 2026-10-19 tối).
5. **Google**: tạo OAuth client khi tới P1-3 (agent viết hướng dẫn từng bước).
6. Duyệt câu tuổi/đồng ý (D-06 Q6 = A) cùng văn bản pháp lý — tới P1-6 / E-05.

## Board

| ID | Item | Phase | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| E-01 | [Luồng dev · test · môi trường (main + tag)](items/E-01-dev-test-env-flow.md) | 0 | enhancement | **decided** (Q4 tới Cổng) | — |
| E-04 | [Spec nói đúng Tò He hôm nay](items/E-04-spec-truth.md) | 0 (a) · 1A (b) | enhancement | **decided** | — |
| D-02 | [Domain lâu dài](items/D-02-long-term-domain.md) | 1A | decision | **decided** — `toheplay.io.vn` duy nhất | — |
| D-03 | [Nói với ai](items/D-03-audience-and-message.md) | 1A | decision | **decided** — user-first, vòng đời một user | — |
| D-01 | [Host và đường dẫn](items/D-01-host-and-path-layout.md) | 1A | decision | proposed v3 — Q2–Q6 chốt; Q1, Q7, Q8 chờ | — |
| D-04 | [Đo luồng người mới](items/D-04-measuring-newcomers.md) | 1A | decision | **decided** — B | — |
| E-02 | [Trang công khai · SEO · GEO](items/E-02-public-pages-seo-geo.md) | 1A | enhancement | **decided** (Q2 mở) | D-01 |
| D-06 | [Định danh theo bậc (hồ sơ máy)](items/D-06-identity-ladder.md) | 1B | decision | **decided** — B, Q6 = A | — |
| D-07 | [Liên kết hồ sơ máy vào account](items/D-07-linking-device-profiles.md) | 1B | decision | **decided** — B | — |
| D-08 | [Lối vào: link mời, link chia sẻ](items/D-08-entry-links.md) | 1B | decision | **decided** — B | — |
| D-05 | [Google một chạm · ai tạo account](items/D-05-registration-and-fast-sign-up.md) | 1B | decision | **decided** | — |
| E-03 | [Người mới · cài PWA · xem trước link](items/E-03-newcomer-journey-and-pwa.md) | 1B | enhancement | **decided** | D-01 |
| E-05 | [Cổng trước khi mời người ngoài](items/E-05-gate-before-outsiders.md) | Cổng | enhancement | open | — |

## Graduation list (nháp — chốt ở Converge)

Mỗi PR một mục đích, mang ADR + docs của nó, `pnpm verify` trước khi mở; owner review và merge từng PR.

| PR | Nội dung | ADR | Items |
|---|---|---|---|
| P0-1 | `docs/guides/environments.md`, ADR môi trường + tag + promote (sửa 0010, 0021 §5), `AGENTS.md` dòng prod, sửa `uat.md`/`index.md`/roadmap | mới | E-01, E-04a |
| P0-2 | `tools/env-check`: `check:uat`, `check:prod`, `release:check <tag>` | — | E-01 §2, §6 |
| P0-3 | Mode C `pnpm stack:image` + dữ liệu mẫu cho dev | — | E-01 §4 |
| P1-1 | Bố cục D-01: gói `@tohe/routes` + codegen (Caddy, SW, robots, `HubPaths` cho API, test va chạm); `apps/web` vào image hub; route app gom vào `/play/…` + `/account/…` (Q7); 404 thật, robots/sitemap/`security.txt`; manifest `id`; `docs.` lên gốc (Q8 `apps/docs`); cờ Scalar | mới | D-01 |
| P1-2 | Nội dung công khai user-first, ảnh OG, JSON-LD, kiểm SEO trong build; `/new-game` + DoD | — | E-02 |
| P1-3 | Google trên prod: hướng dẫn tạo client, kiểm luồng (owner cấu hình) | — | D-05 |
| P1-4 | Hub, phần không cần server mới: vào là chơi, lời chào, cài app, manifest, `og:`, Góp ý | — | E-03 |
| P1-5 | Hồ sơ máy ở hub (thay khách) + màn tên + liên kết vào account giữ id (S1–S4, S13) | mới (sửa 0023, 0024) | D-06, D-07 |
| P1-6 | Hồ sơ máy trên server (+ câu tuổi/đồng ý), bàn mở cho `named`, độ tin, dọn dẹp, mã chuyển máy | mới (sửa 0016, 0025, 0029) | D-06 §4, D-07 S8 |
| P1-7 | Đường ống lối vào ở hub + module `Links` + `/s/` + thẻ xem trước + "Nhập mã" | mới | D-08 |
| P1-8 | Game Contract: `identity`, `entries`, `init.entry`, `identity.require`, `share`; SDK + kit + conformance; Ghép Khối "Thách bạn" | mới (Game Contract) | D-06 §5, D-08 §6 |
| P1-9 | Viết lại `vision.md` | — | E-04b |
| P1-10 | Vòng thử thiết bị của owner trên prod + sửa lỗi | — | E-03 §14 |
| sau | Workflow tự động khi push tag (owner nối khi luồng ổn định) | — | E-01 §2 |

Thứ tự: P0-1 → P0-2 ∥ P0-3 · P1-1 → P1-2 ∥ P1-4 · P1-3 lúc nào cũng được · P1-5 → P1-6 → P1-7 → P1-8 · P1-9 sau P0-1 ·
P1-10 cuối. Mỗi lần lên: owner nói "deploy" → tag `uat-…`; "lên prod" → tag `prod-…` (E-01).
