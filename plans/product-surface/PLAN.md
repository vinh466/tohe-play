# Plan — Bề mặt sản phẩm (Phase 1)

- Goal: một người chưa biết Tò He tìm thấy nó, chơi ngay không cần tài khoản, được rủ vào đúng bàn hay đúng game bằng một
  link, rồi được dẫn cài app và giữ tiến độ vào account đúng lúc — trên một domain ổn định và một luồng phát triển · kiểm
  thử · môi trường đã viết thành spec.
- Phase: **Frame → Resolve** (chồng nhau — [process](../README.md#phases)); D-02, D-03 decided; brief cập nhật, chờ owner
  xác nhận.
- Started: 2026-10-19 · Branch: `plan/product-surface` (xếp trên `plan/public-launch`) · PR:
  [tohe-play#70](https://github.com/vinh466/tohe-play/pull/70) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (vòng đời một user ở §6) · Log: [log.md](log.md)
- Research: [R-01 việc dang dở](research/R-01-backlog-review.md) · [R-02 host, SEO, GEO](research/R-02-hosts-seo-geo.md) ·
  [R-03 người mới, PWA](research/R-03-pwa-install-newcomer.md) · [R-04 main + tag](research/R-04-delivery-model.md) ·
  [R-05 định danh, lối vào](research/R-05-identity-and-entry-prior-art.md)

## Next — one item

**Owner trả lời E-01 Q2 + Q5** (PR `platform-infra` do workflow mở bằng token, owner merge? · gắn tag `uat-…` mỗi lần
deploy UAT?) — xong là agent viết P0-1. Song song, owner đọc nền định danh + lối vào theo thứ tự **D-06 → D-07 → D-08**.

## Waiting on the owner

1. **Cloudflare** (owner: "cứ list ra tôi sẽ align trên CF"):
   a. DNS: bản ghi `v=DMARC1; p=none;` đổi *Name* `@` → `_dmarc` (có thể thêm `rua` bằng DMARC Management của Cloudflare).
   b. Email Routing: bật cho zone, `hello@` và `security@toheplay.io.vn` → hộp thư của owner (Cloudflare tự thêm MX + SPF ở
      gốc; không đụng `send.` của Resend).
   c. AI Crawl Control: crawler **Search** cho phép; "Block AI bots" không bật cho mọi trang; Training theo E-02 Q2.
   d. Xác nhận Bot Fight Mode / Under Attack / WAF challenge vẫn tắt (ADR 0040). Managed robots.txt: để nguyên tới P1-1.
   e. Sau P1-2: TXT xác minh Google Search Console + Bing Webmaster.
2. **Console prod**: bật Chống bot đăng ký (proof-of-work).
3. [E-01](items/E-01-dev-test-env-flow.md) Q2, Q5, Q6 · [D-01](items/D-01-host-and-path-layout.md) Q1–Q5.
4. [D-06](items/D-06-identity-ladder.md) Q1–Q5 · [D-07](items/D-07-linking-device-profiles.md) Q1–Q3 ·
   [D-08](items/D-08-entry-links.md) Q1–Q4 · [D-05](items/D-05-registration-and-fast-sign-up.md) Q1–Q3 (Google: owner
   tạo OAuth client).
5. [D-04](items/D-04-measuring-newcomers.md) Q1–Q2 · [E-02](items/E-02-public-pages-seo-geo.md) Q1–Q3 ·
   [E-03](items/E-03-newcomer-journey-and-pwa.md) Q1–Q3 · xác nhận [brief.md](brief.md).

## Board

| ID | Item | Phase | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| E-01 | [Luồng dev · test · môi trường (main + tag)](items/E-01-dev-test-env-flow.md) | 0 | enhancement | **decided một phần**; Q2, Q5, Q6 proposed | — |
| E-04 | [Spec nói đúng Tò He hôm nay](items/E-04-spec-truth.md) | 0 (a) · 1A (b) | enhancement | proposed | — |
| D-02 | [Domain lâu dài](items/D-02-long-term-domain.md) | 1A | decision | **decided** — `toheplay.io.vn` duy nhất | — |
| D-03 | [Nói với ai](items/D-03-audience-and-message.md) | 1A | decision | **decided** — user-first, vòng đời một user | — |
| D-01 | [Host và đường dẫn](items/D-01-host-and-path-layout.md) | 1A | decision | proposed | E-01 |
| D-04 | [Đo luồng người mới](items/D-04-measuring-newcomers.md) | 1A | decision | proposed | — |
| E-02 | [Trang công khai · SEO · GEO](items/E-02-public-pages-seo-geo.md) | 1A | enhancement | proposed | D-01 |
| D-06 | [Định danh theo bậc (hồ sơ máy)](items/D-06-identity-ladder.md) | 1B | decision | proposed | — |
| D-07 | [Liên kết hồ sơ máy vào account](items/D-07-linking-device-profiles.md) | 1B | decision | proposed | D-06 |
| D-08 | [Lối vào: link mời, link chia sẻ](items/D-08-entry-links.md) | 1B | decision | proposed | D-06, D-07 |
| D-05 | [Google một chạm · ai tạo account](items/D-05-registration-and-fast-sign-up.md) | 1B | decision | proposed v2 | D-06 |
| E-03 | [Người mới · cài PWA · xem trước link](items/E-03-newcomer-journey-and-pwa.md) | 1B | enhancement | proposed v2 | D-01, D-05…D-08 |
| E-05 | [Cổng trước khi mời người ngoài](items/E-05-gate-before-outsiders.md) | Cổng | enhancement | open | D-05 |

## Graduation list (nháp — chốt ở Converge)

Mỗi PR một mục đích, mang ADR + docs của nó, `pnpm verify` trước khi mở; owner review và merge từng PR.

| PR | Nội dung | ADR | Items |
|---|---|---|---|
| P0-1 | `docs/guides/environments.md`, ADR môi trường + tag + promote, `AGENTS.md` dòng prod, sửa `uat.md`/`index.md`/roadmap | mới | E-01, E-04a |
| P0-2 | Workflow kiểm tag `uat-*`/`prod-*` + `release.yml` (GitHub Release, PR `platform-infra`) | (P0-1) | E-01 §2 |
| P0-3 | `tools/env-check`: `pnpm check:uat`, `pnpm check:prod` | — | E-01 §6 |
| P0-4 | Mode C `pnpm stack:image` + dữ liệu mẫu cho dev | — | E-01 §4 |
| P1-1 | Bố cục D-01: `apps/web` vào image hub, Caddy (công khai → app → 404), robots/sitemap/`security.txt`, `/play`, manifest `id` | mới | D-01 |
| P1-2 | Nội dung công khai user-first, ảnh OG, JSON-LD, kiểm SEO trong build; `/new-game` + DoD | — | E-02 |
| P1-3 | Google trên prod: hướng dẫn tạo client, kiểm luồng (owner cấu hình) | — | D-05 |
| P1-4 | Hub, phần không cần server mới: vào là chơi, lời chào, component cài app, manifest, `og:` | — | E-03 |
| P1-5 | Hồ sơ máy ở hub (thay khách) + màn tên + liên kết vào account giữ id (S1–S4) | mới (sửa 0023, 0024) | D-06, D-07 |
| P1-6 | Hồ sơ máy trên server, bàn mở cho `named`, độ tin, dọn dẹp, mã chuyển máy | mới (sửa 0016, 0029) | D-06 §4, D-07 S8 |
| P1-7 | Đường ống lối vào ở hub + module `Links` + `/s/` + thẻ xem trước + "Nhập mã" | mới | D-08 |
| P1-8 | Game Contract: `identity`, `entries`, `init.entry`, `identity.require`, `share`; SDK + kit + conformance; Ghép Khối "Thách bạn" | mới (Game Contract) | D-06 §5, D-08 §6 |
| P1-9 | Viết lại `vision.md` | — | E-04b |
| P1-10 | Vòng thử thiết bị của owner trên prod + sửa lỗi | — | E-03 §12 |

Thứ tự: P0-1 → P0-2 ∥ P0-3 ∥ P0-4 · P1-1 → P1-2 ∥ P1-4 · P1-3 lúc nào cũng được · P1-5 → P1-6 → P1-7 → P1-8 · P1-9 sau
P0-1 · P1-10 cuối.
