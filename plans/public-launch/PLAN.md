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

**A4 — `apps/tohe` trong `platform-infra`** (draft PR, phiên mở trong repo đó — E-06): #43–#65 đã merge (2026-10-18),
`main` là `ad83c45` và CI của nó publish image + chart lên GHCR. Song song: owner review F1c
([#66](https://github.com/vinh466/tohe-play/pull/66), ADR 0038) và chọn D-13 ([đề xuất](items/D-13-games-origin-domain.md)).
Sau đó: F4 (ra mắt, E-10).

## Waiting on the owner

1. **F1c** — review [#66](https://github.com/vinh466/tohe-play/pull/66): hết 7 ngày, account chờ admin xoá trong console
   (E-07 Q7 theo lời owner). Merge, rồi nói "deploy" nếu muốn nó lên UAT.
2. **D-13** — agent đề xuất **B**: một registrable domain riêng chỉ cho game, xong trước F4
   ([item](items/D-13-games-origin-domain.md)). Q1: B hay A; Q2: nếu B, owner chọn và mua tên.
3. **GHCR** — sau lần publish đầu của `main`: đặt 5 package thành Public (hoặc `docker login ghcr.io` trên máy UAT).
   Từ #47, `deploy/uat/deploy.sh` kéo image theo SHA từ GHCR thay vì build tại máy.
4. **E-02** — gói Free đã chốt; email trên UAT bật khi API key nằm trong `~/.config/tohe-uat/uat.env`.
5. **E-08 Q2** — receiver email của Alertmanager ở `platform-infra` (namespace `monitoring` đã xác nhận).
6. Mở console trên UAT: tự chạy lệnh cấp quyền chủ cho account của mình — agent không chọn account thay owner
   (`docs/guides/uat.md`, mục Inspect).
7. Duyệt bản nháp Điều khoản + Quyền riêng tư (`apps/hub/src/legal/documents.ts`, bản `2026-10-18.4` ở #66), điền cách
   liên hệ người vận hành.
8. Trước khi C4 lên prod: OAuth app Google + GitHub và secret ([delivery.md](delivery.md#việc-chỉ-owner-làm-được)).
9. E-07 **Q7** — thời hạn xoá theo văn bản gốc; khi biết, nó thành cảnh báo trên `tohe_account_deletions_due` hoặc lại
   một job (ADR 0038).

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
| D-13 | [Games origin trên domain riêng](items/D-13-games-origin-domain.md) | T7 | decision | **proposed** (agent: B, trước F4) | — |
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
