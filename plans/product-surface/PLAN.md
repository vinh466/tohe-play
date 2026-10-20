# Plan — Bề mặt sản phẩm (Phase 1)

- Goal: một người chưa biết Tò He tìm thấy nó, chơi ngay không cần tài khoản, được rủ vào đúng bàn hay đúng game bằng một
  link, rồi được dẫn cài app và giữ tiến độ vào account đúng lúc — trên một domain ổn định và một luồng phát triển · kiểm
  thử · môi trường đã viết thành spec.
- Phase: **Graduate** ([process](../README.md#phases)) — mọi item quyết định đã decided (2026-10-19); thứ tự xây theo pull
  request ở **[delivery.md](delivery.md)**; N1–N3, B1–B5, S2, S3, K1 đã merge và **chạy trên prod** từ
  `prod-2026-10-20.1` (2026-10-20). Còn lại: S1, S4, I1–I4, K2. Còn mở: E-02 Q2 (cần trước S1), E-05 (Cổng).
- Started: 2026-10-19 · Trên `main` từ [#72](https://github.com/vinh466/tohe-play/pull/72) (2026-10-19); mỗi lần cập nhật
  là một pull request nhỏ
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (vòng đời một user ở §6) ·
  **Delivery: [delivery.md](delivery.md)** · Log: [log.md](log.md)
- Research: [R-01 việc dang dở](research/R-01-backlog-review.md) · [R-02 host, SEO, GEO](research/R-02-hosts-seo-geo.md) ·
  [R-03 người mới, PWA](research/R-03-pwa-install-newcomer.md) · [R-04 main + tag](research/R-04-delivery-model.md) ·
  [R-05 định danh, lối vào](research/R-05-identity-and-entry-prior-art.md) · [R-06 chuẩn bố cục](research/R-06-layout-standard.md)

## Next — one item

**Làm nốt Phase 1, rồi phase review** (owner 2026-10-20: "làm nốt những cái bạn đề xuất cho xong đi, sau đó tôi để đến
phase review … làm 1 nền tảng hoàn chỉnh về các mặt trước khi launch chính thức"): S4 và S1 đang làm (hai builder), I1 có
ADR 0043 ([#91](https://github.com/vinh466/tohe-play/pull/91), chờ reviewer), rồi I2 → I3 → I4. Sau đó: một plan space mới
để review toàn diện nền tảng (UI/UX, luồng, tính năng còn thiếu) trước khi launch chính thức.

## Waiting on the owner

1. **Alertmanager trên prod**: chọn kênh nhận (đề xuất: Telegram) và đưa token vào Infisical — agent mở PR
   `platform-infra` (cả cluster, owner merge).
2. Cloudflare: AI Crawl Control — Search cho phép; Bot Fight Mode / Under Attack / WAF challenge tắt; chọn dịch vụ `status.`.
3. Việc tay: thư thử tới `hello@`, `security@`; Resend `notify.` ([guide](../../docs/guides/mail-and-status.md)).
4. Khi chốt ngày launch chính thức: thử khôi phục bản sao lưu DB prod một lần (owner 2026-10-20: "để tôi thử sau").
5. *Tuỳ chọn:* Cloudflare Access cho `console.toheplay.io.vn` (owner 2026-10-20: MFA đủ cho lúc này).
6. Merge bằng `! gh pr merge <n> --repo vinh466/tohe-play --merge` khi agent báo "sẵn sàng" — PR draft là chưa sẵn sàng.

## Board

| ID | Item | Phase | Kind | Status | PR |
|---|---|---|---|---|---|
| E-01 | [Luồng dev · test · môi trường (main + tag)](items/E-01-dev-test-env-flow.md) | 0 | enhancement | **decided** (Q4 tới Cổng) | N1, N2, N3 |
| E-04 | [Spec nói đúng Tò He hôm nay](items/E-04-spec-truth.md) | 0 · 1 | enhancement | **decided** | N1, K1 |
| D-02 | [Domain lâu dài](items/D-02-long-term-domain.md) | 1 | decision | **decided** — `toheplay.io.vn` duy nhất | — |
| D-03 | [Nói với ai](items/D-03-audience-and-message.md) | 1 | decision | **decided** — user-first, vòng đời một user | — |
| D-01 | [Chuẩn bố cục: host, đường dẫn](items/D-01-host-and-path-layout.md) | 1 | decision | **decided** — L1, `console.`, key chart `docs` | B1–B5 |
| D-04 | [Đo luồng người mới](items/D-04-measuring-newcomers.md) | 1 | decision | **decided** — B | S4 |
| E-02 | [Trang công khai · SEO · GEO](items/E-02-public-pages-seo-geo.md) | 1 | enhancement | **decided** (Q2 mở) | S1 |
| D-05 | [Google một chạm · ai tạo account](items/D-05-registration-and-fast-sign-up.md) | 1 | decision | **decided** | S3 |
| E-03 | [Người mới · cài PWA · xem trước link](items/E-03-newcomer-journey-and-pwa.md) | 1 | enhancement | **decided** | S2, K2 |
| D-06 | [Định danh theo bậc (hồ sơ máy)](items/D-06-identity-ladder.md) | 1 | decision | **decided** — B, Q6 = A | I1, I2, I4 |
| D-07 | [Liên kết hồ sơ máy vào account](items/D-07-linking-device-profiles.md) | 1 | decision | **decided** — B | I1, I2 |
| D-08 | [Lối vào: link mời, link chia sẻ](items/D-08-entry-links.md) | 1 | decision | **decided** — B | I3, I4 |
| E-05 | [Cổng trước khi mời người ngoài](items/E-05-gate-before-outsiders.md) | Cổng | enhancement | open | sau K2 |

## Graduation list

**[delivery.md](delivery.md)** — 18 PR trong năm lane: **N** nền (N1–N3) · **B** bố cục (B1–B5) · **S** bề mặt (S1–S4) ·
**I** định danh và lối vào (I1–I4) · **K** kết (K1–K2); năm ADR mới (môi trường + tag · chuẩn bố cục · hồ sơ máy · lối
vào · Game Contract), mỗi cái trong PR của nó.
