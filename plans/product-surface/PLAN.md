# Plan — Bề mặt sản phẩm (Phase 1)

- Goal: một người chưa biết Tò He tìm thấy nó, chơi ngay không cần tài khoản, được rủ vào đúng bàn hay đúng game bằng một
  link, rồi được dẫn cài app và giữ tiến độ vào account đúng lúc — trên một domain ổn định và một luồng phát triển · kiểm
  thử · môi trường đã viết thành spec.
- Phase: **Resolve** ([process](../README.md#phases)) — E-01, D-02, D-03 decided; phần còn lại có đề xuất + mặc định, chờ
  một lượt trả lời (dưới). Brief: owner "thấy cũng ổn r" (2026-10-19), chưa xác nhận chữ.
- Started: 2026-10-19 · Branch: `plan/product-surface` (xếp trên `plan/public-launch`) · PR:
  [tohe-play#70](https://github.com/vinh466/tohe-play/pull/70) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (vòng đời một user ở §6) · Log: [log.md](log.md)
- Research: [R-01 việc dang dở](research/R-01-backlog-review.md) · [R-02 host, SEO, GEO](research/R-02-hosts-seo-geo.md) ·
  [R-03 người mới, PWA](research/R-03-pwa-install-newcomer.md) · [R-04 main + tag](research/R-04-delivery-model.md) ·
  [R-05 định danh, lối vào](research/R-05-identity-and-entry-prior-art.md)

## Next — one item

**P0-1** — `docs/guides/environments.md` + ADR môi trường/tag/promote + dòng prod trong `AGENTS.md` + sửa sự thật ở
`uat.md`/`index.md`/roadmap. E-01 đã chốt nên làm được ngay; agent bắt đầu khi owner nói "làm".

## Waiting on the owner

1. **Một lượt trả lời** — "đồng ý theo đề xuất", hoặc chỉ nêu câu muốn khác:

   | Item | Mặc định đề xuất |
   |---|---|
   | E-01 Q6 | Mode C `stack:image` + dữ liệu mẫu cho dev |
   | D-01 Q1–Q5 | bố cục B · danh mục `/play` · slug tiếng Việt · Email Routing · tắt Scalar ở prod |
   | D-04 Q1 | Search Console + Bing + bộ đếm tổng hợp, không theo dõi |
   | D-06 Q1–Q5 | hồ sơ máy + ba bậc · tên "Hồ sơ trên máy này" · 5 hồ sơ/máy · dọn sau 90 ngày · bàn mặc định "ai có link" |
   | D-07 Q1–Q3 | ma trận S1–S13 · có mã chuyển máy · chuyển = di chuyển |
   | D-08 Q1–Q4 | một mô hình lối vào · link hết hạn 30 ngày · Ghép Khối "Thách bạn" đầu tiên · 30 link/ngày |
   | D-05 Q1–Q3 | Google trong Phase 1 · Zalo Phase 2 · mở + proof-of-work + Google khi qua Cổng |
   | E-02 Q1, Q3 | trang công khai tiếng Việt · ảnh tĩnh trước |
   | E-03 Q1–Q3 | không màn đăng nhập trước khi chơi · nhắc cài sau ván đầu · giữ màn hình dọc |

2. **Cần chính owner nghĩ**: [D-06 Q6](items/D-06-identity-ladder.md) — câu tuổi/đồng ý khi hồ sơ máy lên server (đề xuất
   A) · [E-02 Q2](items/E-02-public-pages-seo-geo.md) — cho AI *huấn luyện* trên nội dung không (`search`/`ai-input` nên
   bật).
3. **Cloudflare**: ~~DMARC~~ ✔ (kiểm 2026-10-19 tối) · Email Routing `hello@`/`security@` (chưa có MX) · AI Crawl Control:
   Search cho phép · xác nhận Bot Fight Mode / Under Attack / WAF challenge tắt · sau P1-2: TXT Search Console + Bing.
4. **Console prod**: bật Chống bot đăng ký (proof-of-work vẫn tắt, kiểm 2026-10-19 tối).
5. **Google**: tạo OAuth client khi tới P1-3 (agent viết hướng dẫn từng bước).

## Board

| ID | Item | Phase | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| E-01 | [Luồng dev · test · môi trường (main + tag)](items/E-01-dev-test-env-flow.md) | 0 | enhancement | **decided** (Q6 proposed, Q4 tới Cổng) | — |
| E-04 | [Spec nói đúng Tò He hôm nay](items/E-04-spec-truth.md) | 0 (a) · 1A (b) | enhancement | proposed | — |
| D-02 | [Domain lâu dài](items/D-02-long-term-domain.md) | 1A | decision | **decided** — `toheplay.io.vn` duy nhất | — |
| D-03 | [Nói với ai](items/D-03-audience-and-message.md) | 1A | decision | **decided** — user-first, vòng đời một user | — |
| D-01 | [Host và đường dẫn](items/D-01-host-and-path-layout.md) | 1A | decision | proposed | — |
| D-04 | [Đo luồng người mới](items/D-04-measuring-newcomers.md) | 1A | decision | proposed | — |
| E-02 | [Trang công khai · SEO · GEO](items/E-02-public-pages-seo-geo.md) | 1A | enhancement | proposed | D-01 |
| D-06 | [Định danh theo bậc (hồ sơ máy)](items/D-06-identity-ladder.md) | 1B | decision | proposed (+ Q6 tuổi/đồng ý) | — |
| D-07 | [Liên kết hồ sơ máy vào account](items/D-07-linking-device-profiles.md) | 1B | decision | proposed | D-06 |
| D-08 | [Lối vào: link mời, link chia sẻ](items/D-08-entry-links.md) | 1B | decision | proposed | D-06, D-07 |
| D-05 | [Google một chạm · ai tạo account](items/D-05-registration-and-fast-sign-up.md) | 1B | decision | proposed v2 | D-06 |
| E-03 | [Người mới · cài PWA · xem trước link](items/E-03-newcomer-journey-and-pwa.md) | 1B | enhancement | proposed v2 | D-01, D-05…D-08 |
| E-05 | [Cổng trước khi mời người ngoài](items/E-05-gate-before-outsiders.md) | Cổng | enhancement | open | D-05 |

## Graduation list (nháp — chốt ở Converge)

Mỗi PR một mục đích, mang ADR + docs của nó, `pnpm verify` trước khi mở; owner review và merge từng PR.

| PR | Nội dung | ADR | Items |
|---|---|---|---|
| P0-1 | `docs/guides/environments.md`, ADR môi trường + tag + promote (sửa 0010, 0021 §5), `AGENTS.md` dòng prod, sửa `uat.md`/`index.md`/roadmap | mới | E-01, E-04a |
| P0-2 | `tools/env-check`: `check:uat`, `check:prod`, `release:check <tag>` | — | E-01 §2, §6 |
| P0-3 | Mode C `pnpm stack:image` + dữ liệu mẫu cho dev | — | E-01 §4 |
| P1-1 | Bố cục D-01: `apps/web` vào image hub, Caddy (công khai → app → 404), robots/sitemap/`security.txt`, `/play`, manifest `id` | mới | D-01 |
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
