# Plan — Public launch

- Goal: Tò He sẵn sàng mở cho mọi người — user-first (một account, nhiều hồ sơ, mỗi hồ sơ một ID để mời đích danh),
  đăng nhập bằng email và Google/GitHub, admin console, bảng xếp hạng do một engine độ tin bảo đảm, chạy trên cluster
  `platform-infra` bằng chart của chính nó.
- Phase: **Graduate** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)); mọi
  item cần cho việc xây đã decided; thứ tự xây theo pull request ở **[delivery.md](delivery.md)**.
- Started: 2026-10-17 · Branch: `plan/public-launch` · PR: [tohe-play#42](https://github.com/vinh466/tohe-play/pull/42) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** ·
  **Delivery: [delivery.md](delivery.md)** · Log: [log.md](log.md)
- Research: [R-01 auth & liên kết](research/R-01-auth-linking.md) · [R-02 admin đầu tiên](research/R-02-first-admin.md) ·
  [R-03 bảng xếp hạng](research/R-03-leaderboards.md) · [R-04 hồ sơ, tên, ID](research/R-04-profiles-handles.md) ·
  [R-05 platform-infra](research/R-05-platform-infra.md) · [R-06 engine độ tin](research/R-06-integrity-engines.md) ·
  [R-07 tuổi & dữ liệu trẻ em](research/R-07-children-data-law.md)

## Next — one item

**Production chạy** ([platform-infra#239](https://github.com/vinetic-spaces/platform-infra/pull/239) merged 2026-10-19, chart `0.1.0-gd685547`): owner nhận quyền chủ, chuyển đăng ký sang mã
mời (đang `open`), rồi F4 (E-10) — agent mở item E-10 và làm phần của mình khi owner đồng ý chạm vào prod.

## Waiting on the owner

1. **Nhận quyền chủ trên prod**: đăng ký tài khoản của mình ở `https://toheplay.io.vn` (cũng là phép thử email thật),
   rồi setup token (`kubectl -n tohe logs deploy/tohe-api | grep -i "setup token"`) ở `/admin/`, bật 2FA.
2. **Chế độ đăng ký → Theo lời mời** (console → Đăng nhập & đăng ký): prod đang `open`, proof-of-work tắt; E-09 Q1
   chốt ra mắt bằng mã mời.
3. **`_dmarc`** TXT `v=DMARC1; p=none;` — chưa có trên DNS (kiểm 2026-10-19, Google và Cloudflare DoH).
4. Trước khi mời người ngoài: duyệt Điều khoản + Quyền riêng tư và cách liên hệ người vận hành; tạo cộng đồng + mã
   mời; thử iPhone trên prod (PWA, âm thanh, offline).
5. Đồng ý cho agent làm phần F4 chạm vào prod: thử khôi phục backup, load test phòng, security review, thư tới
   Gmail/Outlook/Yahoo.
6. **E-08 Q2**: Alertmanager của production đang tắt — cần địa chỉ nhận và credential SMTP nếu muốn cảnh báo email.
7. UAT: nói "deploy" để UAT lên `d685547` (CSP game mới); email UAT bật khi key nằm trong `uat.env`.
8. E-07 **Q7** — thời hạn xoá theo văn bản gốc (ADR 0038).

## Board

| ID | Item | Track | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| D-01 | [Một account nhiều hồ sơ](items/D-01-accounts-profiles-handles.md) | T2 | decision | **decided** | — |
| D-02 | [Email là định danh + bộ luồng chuẩn](items/D-02-email-identity.md) | T2 | decision | **decided** | — |
| D-03 | [Liên kết cách đăng nhập](items/D-03-account-linking.md) | T4 | decision | **decided** | D-02 |
| D-04 | [Cách đăng nhập v1 · cấu hình 2 lớp · OAuth ở prod](items/D-04-sign-in-methods.md) | T4 | decision | **decided** | D-03 |
| D-05 | [Xác thực lại hai mức](items/D-05-step-up.md) | T2 | decision | **decided** | D-01 |
| D-06 | [Cổng tuổi & đồng ý điều khoản](items/D-06-age-and-consent.md) | T2 | decision | **decided** (N = 16) | D-01 |
| D-07 | [Admin console](items/D-07-admin-console.md) | T6 | decision | **decided** | — |
| D-08 | [Admin đầu tiên](items/D-08-first-owner.md) | T6 | decision | **decided** | D-07 |
| D-09 | [Bảng xếp hạng phân tầng theo độ tin](items/D-09-leaderboards.md) | T5 | decision | **decided** | D-01, D-12 |
| D-10 | [Verifier replay (đổi contract)](items/D-10-verified-runs.md) | T5 | decision | **decided** | D-16 |
| D-11 | [Bảng & hạng của phòng](items/D-11-room-boards.md) | T5 | decision | **decided** | D-09 |
| D-12 | [Chế độ đăng ký & mã mời cộng đồng](items/D-12-registration-modes.md) | T7 | decision | **decided** | D-02 |
| D-13 | [Games origin trên domain riêng](items/D-13-games-origin-domain.md) | T7 | decision | **decided** — mọi host dưới `toheplay.io.vn` (#67 ADR 0039, #69 ADR 0040) | — |
| D-14 | [Release bằng chart + GHCR + promote](items/D-14-release-via-chart.md) | T1 | decision | **decided** | — |
| D-15 | [UAT có HTTPS](items/D-15-uat-https.md) | T1 | decision | deferred | — |
| D-16 | [Engine độ tin](items/D-16-integrity-engine.md) | T5 | decision | **decided** | D-09 |
| D-17 | [Tên đặt thoải mái + ID 12 số](items/D-17-profile-name-and-id.md) | T2 | decision | **decided** | D-01 |
| E-01 | [Chuyển dữ liệu UAT](items/E-01-uat-migration.md) | T2 | enhancement | **decided** | — |
| E-02 | [Email giao dịch](items/E-02-transactional-email.md) | T3 | enhancement | **decided** (Q2 Free) | — |
| E-03 | Image chạy mọi môi trường — [trong D-14](items/D-14-release-via-chart.md#e-03--image-chạy-được-ở-mọi-môi-trường-code) | T1 | enhancement | **decided** | — |
| E-04 | Chart `tohe` — [trong D-14](items/D-14-release-via-chart.md#e-04--chart-tohe-deployhelmtohe) | T1 | enhancement | **decided** | E-03 |
| E-05 | UAT kéo image GHCR — [trong D-14](items/D-14-release-via-chart.md#e-05--uat-chạy-đúng-image-sẽ-lên-prod) | T1 | enhancement | **decided** | E-04 |
| E-06 | `apps/tohe` ở `platform-infra` (draft PR) — [trong D-14](items/D-14-release-via-chart.md#e-06--component-appstohe-trong-platform-infra-draft-pr) | T1 | enhancement | **decided** | E-04 publish |
| E-07 | [Quyền riêng tư, xoá account, kiểm duyệt tên](items/E-07-privacy-deletion-moderation.md) | T7 | enhancement | **decided** (Q7 → F1c #66: chờ admin; thời hạn chờ owner) | D-06, D-17 |
| E-08 | [Observability](items/E-08-observability.md) | T8 | enhancement | **decided** (Q2 email, cấu hình ở `platform-infra`) | E-04 |
| E-09 | [Chống bot đăng ký](items/E-09-bot-protection.md) | T7 | enhancement | **decided** | D-12 |
| E-10 | Checklist ra mắt | — | enhancement | open | E-07, E-08, E-09, D-13 |

Item chưa có link = chưa mở file; file được tạo khi item rời `open`.

## Graduation list

Chốt ở [delivery.md](delivery.md): 21 pull request trong sáu lane (A release · B email · C identity · D admin · E độ tin ·
F public; D3 và E1 mỗi cái tách đôi), mỗi PR mang ADR và docs của nó — ADR 0021…0030; số được cấp khi PR mở (C2 0024,
C3 0025, D3b 0028, E1a 0029).
