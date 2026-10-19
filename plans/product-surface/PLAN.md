# Plan — Bề mặt sản phẩm (Phase 1)

- Goal: một người chưa biết Tò He tìm thấy nó (tìm kiếm, AI, link bạn gửi), hiểu nó trong vài giây, chơi ngay không cần tài
  khoản, rồi được dẫn cài app và tạo tài khoản đúng lúc — trên một bố cục domain ổn định lâu dài và một luồng phát triển ·
  kiểm thử · môi trường đã viết thành spec.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)); map và các đề
  xuất đã có sẵn để owner đọc cùng brief.
- Started: 2026-10-19 · Branch: `plan/product-surface` (xếp trên `plan/public-launch`) · PR:
  [tohe-play#70](https://github.com/vinh466/tohe-play/pull/70) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)
- Research: [R-01 rà việc dang dở](research/R-01-backlog-review.md) · [R-02 host, SEO, GEO](research/R-02-hosts-seo-geo.md) ·
  [R-03 người mới, PWA](research/R-03-pwa-install-newcomer.md)

## Lộ trình

| Giai đoạn | Gồm | Xong khi |
|---|---|---|
| **Ngay** (owner, vài phút) | sửa DMARC · bật proof-of-work | R-01 A1, A2 |
| **Phase 0 — nền** | E-01, E-04a | luồng môi trường + luật prod trong spec; `check:uat`/`check:prod` trong repo |
| **Phase 1 — bề mặt** | D-01…D-05, E-02, E-03, E-04b | brief "Xong khi" 3–5, owner đã thử trên thiết bị thật |
| **Cổng** | E-05 | owner quyết ngày mời người ngoài |
| Phase 2 — hub · Phase 3 — game | plan riêng, sau | — |

## Next — one item

**Owner đọc [E-01](items/E-01-dev-test-env-flow.md) và trả lời Q1–Q3** (prod chỉ chạy commit đã lên UAT · "lên prod" = agent
mở PR `platform-infra` · tag `prod-…`). Chốt xong thì agent viết PR P0-1 ngay; trong lúc đó owner đọc D-01/D-02/D-03.

## Waiting on the owner

1. **Ngay**: Cloudflare → DNS: bản ghi `v=DMARC1; p=none;` đang ở *Name* `@` → đổi thành `_dmarc`
   ([R-01](research/R-01-backlog-review.md) A1). Console → Đăng nhập & đăng ký → bật **Chống bot đăng ký** (A2).
2. Xác nhận [brief.md](brief.md) (đúng ý chưa, thiếu gì).
3. [E-01](items/E-01-dev-test-env-flow.md) Q1–Q3 (Q4 để tới Cổng).
4. [D-02](items/D-02-long-term-domain.md) Q1–Q2 — "domain riêng sau này" là domain khác `toheplay.io.vn`? khi nào?
5. [D-01](items/D-01-host-and-path-layout.md) Q1–Q5 — bố cục B, `/play`, slug tiếng Việt, Email Routing, Scalar.
6. [D-03](items/D-03-audience-and-message.md) Q1–Q3 — cộng đồng đầu tiên là ai; A/B/C.
7. [D-05](items/D-05-registration-and-fast-sign-up.md) Q1–Q2 — chế độ đăng ký khi mời; bật Google?
8. [D-04](items/D-04-measuring-newcomers.md) Q1 · [E-02](items/E-02-public-pages-seo-geo.md) Q2 (`ai-train`) ·
   [E-03](items/E-03-newcomer-journey-and-pwa.md) Q1–Q3.

## Board

| ID | Item | Phase | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| E-01 | [Luồng dev · test · môi trường thành spec](items/E-01-dev-test-env-flow.md) | 0 | enhancement | proposed | — |
| E-04 | [Spec nói đúng Tò He hôm nay](items/E-04-spec-truth.md) | 0 (a) · 1 (b) | enhancement | proposed | (b) D-03 |
| D-02 | [Domain lâu dài, đổi lúc nào](items/D-02-long-term-domain.md) | 1 | decision | proposed | — |
| D-01 | [Host và đường dẫn của mỗi thành phần](items/D-01-host-and-path-layout.md) | 1 | decision | proposed | E-01, D-02 (tên) |
| D-03 | [Nói với ai, nói gì](items/D-03-audience-and-message.md) | 1 | decision | open | — |
| D-05 | [Đăng ký khi công khai + đường vào nhanh](items/D-05-registration-and-fast-sign-up.md) | 1 | decision | proposed | D-03 |
| D-04 | [Đo luồng người mới không theo dõi](items/D-04-measuring-newcomers.md) | 1 | decision | proposed | — |
| E-02 | [Trang công khai · SEO · GEO](items/E-02-public-pages-seo-geo.md) | 1 | enhancement | proposed | D-01, D-03 |
| E-03 | [Người mới · cài PWA · xem trước link](items/E-03-newcomer-journey-and-pwa.md) | 1 | enhancement | proposed | D-01, D-03, D-05 |
| E-05 | [Cổng trước khi mời người ngoài](items/E-05-gate-before-outsiders.md) | Cổng | enhancement | open | D-02, D-05 |

## Graduation list (nháp — chốt ở Converge)

Mỗi PR một mục đích, mang ADR + docs của nó, `pnpm verify` trước khi mở; owner review và merge từng PR.

| PR | Nội dung | ADR | Items | Cần trước |
|---|---|---|---|---|
| P0-1 | `docs/guides/environments.md`, ADR môi trường + promote (sửa 0010), `AGENTS.md` dòng prod, sửa `uat.md`/`index.md`/roadmap | mới | E-01, E-04a | E-01 Q1–Q3 |
| P0-2 | `tools/env-check`: `pnpm check:uat`, `pnpm check:prod` | — | E-01 §7 | P0-1 |
| P1-1 | Bố cục D-01: `apps/web` vào image hub, Caddy (công khai → app → 404), robots/sitemap/`security.txt`, danh mục `/play`, manifest `id`, `docs.` chỉ tài liệu | mới (sửa 0040, 0021) | D-01 | D-01, D-02 |
| P1-2 | Nội dung công khai: landing, trang game, hướng dẫn, hỏi đáp, pháp lý tĩnh, ảnh OG, JSON-LD, kiểm SEO trong build; `/new-game` + DoD | — | E-02 | P1-1, D-03 |
| P1-3 | Hub cho người mới: khách tự động ở `/play`, lời chào, nhắc đúng lúc, component cài app, manifest `screenshots`/`shortcuts`, `og:` của hub, e2e hành trình | — | E-03 | P1-1, D-03 |
| P1-4 | Đăng ký qua link bàn (nếu D-05 = C) | sửa 0028 | D-05 | D-05 |
| P1-5 | Viết lại `vision.md` | — | E-04b | D-03 |
| P1-6 | Vòng thử thiết bị của owner trên prod + sửa lỗi | — | E-03 §10 | P1-2, P1-3 |

Thứ tự: P0-1 → P0-2 ∥ P1-1 → P1-2 ∥ P1-3 → P1-4 → P1-6; P1-5 khi D-03 xong.
