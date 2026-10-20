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

**I1 — hồ sơ máy ở hub** (D-06, D-07; ADR mới + reviewer) khi owner nói "làm". S1 (nội dung công khai, `og:image`) chờ
[E-02 Q2](items/E-02-public-pages-seo-geo.md); S4 (bộ đếm phễu) làm song song được.

## Waiting on the owner

1. **S3 — Google** (owner làm 2026-10-20): chọn chế độ Đăng ký ở console (đề xuất: Theo lời mời) → tạo Google client theo
   [guide](../../docs/guides/sign-in-with-google.md) → `google-client-secret` vào Infisical `/tohe` → gửi agent **Client ID**
   → agent mở PR values `platform-infra`, owner merge → agent kiểm. Xong thì S3 done.
2. **Console prod**: bật Chống bot đăng ký (đề xuất).
3. [E-02 Q2](items/E-02-public-pages-seo-geo.md) — cho AI *huấn luyện* (đề xuất: không) — cần trước S1.
4. Cloudflare: AI Crawl Control — Search cho phép; Bot Fight Mode / Under Attack / WAF challenge tắt; chọn dịch vụ `status.`.
5. Việc tay: thư thử tới `hello@`, `security@`; Resend `notify.` ([guide](../../docs/guides/mail-and-status.md)).
6. *Tuỳ chọn:* Cloudflare Access cho `console.toheplay.io.vn` — owner 2026-10-20: "hiện rảnh tôi sẽ bật sau, giờ có MFA
   cũng uy tín rồi" (console đã đòi mật khẩu + mã 6 số).
7. Merge bằng `! gh pr merge <n> --repo vinh466/tohe-play --merge` khi agent báo "sẵn sàng" — PR draft là chưa sẵn sàng.

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
