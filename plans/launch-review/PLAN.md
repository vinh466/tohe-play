# Plan — Review trước launch

- Goal: Tò He hoàn chỉnh về mọi mặt trước khi launch chính thức — mọi màn và luồng đã rà, câu chữ và Điều khoản + Quyền
  riêng tư đã chốt, những tính năng owner coi là thiếu đã có, và Cổng trước người ngoài đã qua.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)) — brief là bản
  nháp; owner đã trả lời Q1, Q4, Q5 (2026-10-22), còn Q2, Q3 và lời xác nhận.
- Started: 2026-10-21 · Branch: `plan/launch-review` · PR: [tohe-play#109](https://github.com/vinh466/tohe-play/pull/109) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)
- Research: [R-01 bản đồ trang và lối vào](research/R-01-pages-and-ways-in.md) · [R-02 bố cục hiện đại, SEO hai ngôn ngữ](research/R-02-layout-prior-art.md) · [R-03 quay lại, app đã cài](research/R-03-coming-back.md) · [R-04 review host và path](research/R-04-hosts-and-paths-review.md) · [R-05 học từ miniblox và nền tảng khác](research/R-05-learning-from-peers.md) · [R-06 SEO, GEO, mở rộng](research/R-06-seo-geo-scale.md)
- Trước đó: [`product-surface`](../product-surface/PLAN.md) (Phase 1, Close 2026-10-21)

## Next — one item

**Đợt 1 — thiết kế bề mặt** (owner 2026-10-23: "chốt được thiết kế này xong là có thể build tiếp chi tiết … sau đó … phát
triển thêm đc game"). Việc tiếp theo: **owner quyết [D-06 bề mặt giới thiệu](items/D-06-introduction-surface.md)** (đề xuất B; Q1–Q4). Sau D-06:
ADR "Hai vùng, một khung" (D-01 + D-02 + D-04 + D-05 + D-06) và trang spec `docs/architecture/surfaces.md` → đợt 1 xong.
Ý ngoài scope vào backlog sản phẩm (`docs/roadmap/product-backlog.md`).

## Waiting on the owner

1. **Brief**: Q2, Q3 và xác nhận ([brief.md](brief.md#câu-hỏi-cho-owner-trước-khi-chốt)).
2. Chuyển từ `product-surface`, đều thuộc Cổng ([E-01](items/E-01-gate-before-outsiders.md)):
   - **Alertmanager trên prod** (Telegram): tạo bot ở @BotFather, đưa token vào Infisical `platform/prod` `/monitoring`
     khoá `telegram-bot-token`, gửi chat id — agent mở PR `platform-infra` (cả cluster, owner merge).
   - Cloudflare: AI Crawl Control — Search cho phép; Bot Fight Mode / Under Attack / WAF challenge tắt; chọn dịch vụ
     `status.`.
   - Việc tay: thư thử tới `hello@`, `security@`; Resend `notify.` ([guide](../../docs/guides/mail-and-status.md)).
   - Khi chốt ngày launch: thử khôi phục bản sao lưu DB prod một lần (owner 2026-10-20: "để tôi thử sau").
   - *Tuỳ chọn:* Cloudflare Access cho `console.toheplay.io.vn` (owner 2026-10-20: MFA đủ cho lúc này).
3. Merge bằng `! gh pr merge <n> --repo vinh466/tohe-play --merge` khi agent báo "sẵn sàng" — PR draft là chưa sẵn sàng.

## Board

**Đợt 1 — thiết kế bề mặt (bây giờ)**

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-02 | [Bố cục các trang và app](items/D-02-layout.md) | decision | **decided** — B, hai vùng một khung (2026-10-22) | — |
| D-04 | [Mở lại app](items/D-04-coming-back.md) | decision | **decided** — B (2026-10-22); mục 4 (cập nhật êm) proposed | — |
| D-01 | [Hai ngôn ngữ: URL, SEO, chọn ngôn ngữ](items/D-01-languages.md) | decision | **decided** — tiếng Việt là mặt chính, `/en/`, `x-default` → `/en/` (2026-10-23, tạm chốt) | — |
| D-05 | [Host và path](items/D-05-hosts-and-paths.md) | decision | **decided** — A, game ở L1; luật leo thang thành chủ đề trong spec (2026-10-23) | — |
| D-06 | [Bề mặt giới thiệu: SEO, GEO, mở rộng](items/D-06-introduction-surface.md) | decision | **proposed** — B, một nguồn cho mỗi game, sinh ra hết | — |

**Đợt 2 — trước launch (sau thiết kế)**

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| E-02 | Rà từng màn (map) | enhancement | open | đợt 1 |
| E-03 | Luồng đầu–cuối, e2e (map) | enhancement | open | đợt 1 |
| E-04 | Câu chữ vi + en (map) | enhancement | open | đợt 1 |
| E-05 | Điều khoản + Quyền riêng tư, vi gốc + en (map) | enhancement | open | E-04 |
| E-01 | [Cổng trước khi mời người ngoài](items/E-01-gate-before-outsiders.md) (từ `product-surface` E-05) | enhancement | open | E-05 |

**Chuyển sang backlog sản phẩm** (owner 2026-10-23): [D-03](items/D-03-features-before-launch.md) (tính năng — deferred),
E-06 (console tiếng Anh).

## Graduation list

Điền ở phase 4 (Converge): mỗi ADR, thay đổi docs và PR, theo thứ tự, kèm item nó đến từ.
