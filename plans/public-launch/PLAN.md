# Plan — Public launch

- Goal: Tò He sẵn sàng mở cho mọi người — user-first (một account, nhiều hồ sơ, mỗi hồ sơ một ID để mời đích danh),
  đăng nhập bằng email và Google/GitHub, admin console, bảng xếp hạng do một engine độ tin bảo đảm, chạy trên cluster
  `platform-infra` bằng chart của chính nó.
- Phase: **Map** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)); brief đã được
  xác nhận; track T1 graduate được ngay.
- Started: 2026-10-17 · Branch: `plan/public-launch` · PR: [tohe-play#42](https://github.com/vinh466/tohe-play/pull/42) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** · Log: [log.md](log.md)
- Research: [R-01 auth & liên kết](research/R-01-auth-linking.md) · [R-02 admin đầu tiên](research/R-02-first-admin.md) ·
  [R-03 bảng xếp hạng](research/R-03-leaderboards.md) · [R-04 hồ sơ, tên, ID](research/R-04-profiles-handles.md) ·
  [R-05 platform-infra](research/R-05-platform-infra.md) · [R-06 engine độ tin](research/R-06-integrity-engines.md) ·
  [R-07 tuổi & dữ liệu trẻ em](research/R-07-children-data-law.md)

## Next — one item

**Owner trả lời bốn câu cuối** (mỗi câu đã có đề xuất — "ok" là đủ). Trả lời xong thì T2, T3 và T5 đủ quyết định để
viết spec. Song song, agent bắt đầu **T1** ([D-14](items/D-14-release-via-chart.md)): ADR "production via the Tò He
chart" → E-03 → E-04, trên nhánh feature riêng.

## Waiting on the owner

1. **D-16 Q4** — bảng cộng đồng nhận `checked` cho game chưa có replay, kèm nhãn "chưa xác minh"? (đề xuất: có)
2. **D-06** — mốc tuổi tự đăng ký N = 16 (theo Luật Trẻ em, [R-07](research/R-07-children-data-law.md))? (đề xuất: 16)
3. **E-02 Q1** — gửi từ `Tò He <no-reply@…>`? (đề xuất: có)
4. **E-02 Q2** — account Resend của platform đang **Free** hay **Pro**? (Free → Tò He dùng account riêng)
5. **Map** — thiếu item nào không ([map.md](map.md)).

## Board

| ID | Item | Track | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| D-01 | [Một account nhiều hồ sơ](items/D-01-accounts-profiles-handles.md) | T2 | decision | **decided** | — |
| D-02 | [Email là định danh + bộ luồng chuẩn](items/D-02-email-identity.md) | T2 | decision | **decided** | — |
| D-03 | [Liên kết cách đăng nhập](items/D-03-account-linking.md) | T4 | decision | **decided** | D-02 |
| D-04 | [Cách đăng nhập v1 · cấu hình 2 lớp · OAuth ở prod](items/D-04-sign-in-methods.md) | T4 | decision | **decided** | D-03 |
| D-05 | [Xác thực lại hai mức](items/D-05-step-up.md) | T2 | decision | **decided** | D-01 |
| D-06 | [Cổng tuổi & đồng ý điều khoản](items/D-06-age-and-consent.md) | T2 | decision | proposed (chờ N) | D-01 |
| D-07 | [Admin console](items/D-07-admin-console.md) | T6 | decision | **decided** | — |
| D-08 | [Admin đầu tiên](items/D-08-first-owner.md) | T6 | decision | **decided** | D-07 |
| D-09 | [Bảng xếp hạng phân tầng theo độ tin](items/D-09-leaderboards.md) | T5 | decision | **decided** | D-01, D-12 |
| D-10 | [Verifier replay (đổi contract)](items/D-10-verified-runs.md) | T5 | decision | **decided** | D-16 |
| D-11 | [Bảng & hạng của phòng](items/D-11-room-boards.md) | T5 | decision | **decided** | D-09 |
| D-12 | [Chế độ đăng ký & mã mời cộng đồng](items/D-12-registration-modes.md) | T7 | decision | **decided** | D-02 |
| D-13 | Games origin trên domain riêng | T7 | decision | open | — |
| D-14 | [Release bằng chart + GHCR + promote](items/D-14-release-via-chart.md) | T1 | decision | **decided** | — |
| D-15 | [UAT có HTTPS](items/D-15-uat-https.md) | T1 | decision | deferred | — |
| D-16 | [Engine độ tin](items/D-16-integrity-engine.md) | T5 | decision | **decided** (Q4 mở) | D-09 |
| D-17 | [Tên đặt thoải mái + ID 12 số](items/D-17-profile-name-and-id.md) | T2 | decision | **decided** | D-01 |
| E-01 | [Chuyển dữ liệu UAT](items/E-01-uat-migration.md) | T2 | enhancement | proposed (owner xem cùng spec T2) | — |
| E-02 | [Email giao dịch](items/E-02-transactional-email.md) | T3 | enhancement | proposed (chờ Q1, Q2) | — |
| E-03 | Image chạy mọi môi trường — [trong D-14](items/D-14-release-via-chart.md#e-03--image-chạy-được-ở-mọi-môi-trường-code) | T1 | enhancement | **decided** | — |
| E-04 | Chart `tohe` — [trong D-14](items/D-14-release-via-chart.md#e-04--chart-tohe-deployhelmtohe) | T1 | enhancement | **decided** | E-03 |
| E-05 | UAT kéo image GHCR — [trong D-14](items/D-14-release-via-chart.md#e-05--uat-chạy-đúng-image-sẽ-lên-prod) | T1 | enhancement | **decided** | E-04 |
| E-06 | `apps/tohe` ở `platform-infra` (draft PR) — [trong D-14](items/D-14-release-via-chart.md#e-06--component-appstohe-trong-platform-infra-draft-pr) | T1 | enhancement | **decided** | E-04 publish |
| E-07 | Quyền riêng tư, xoá account, kiểm duyệt tên | T7 | enhancement | open | D-06, D-17 |
| E-08 | Observability | T8 | enhancement | open | E-04 |
| E-09 | Chống bot đăng ký (Turnstile, tuỳ chọn) | T7 | enhancement | open | D-12 |
| E-10 | Checklist ra mắt | — | enhancement | open | E-07, E-08, E-09, D-13 |

Item chưa có link = chưa mở file; file được tạo khi item rời `open`.

## Graduation list (nháp — chốt ở phase Converge)

Số ADR gán lúc graduate (số trống kế tiếp hiện là 0021).

1. ADR *Production via the Tò He chart* (sửa phần production của ADR 0010) · `deploy/helm/tohe` · CI publish ·
   `docs/guides/production.md`, `docs/guides/self-hosting.md` — D-14 (E-03…E-05); E-06 ở `platform-infra`.
2. ADR *Transactional email* — E-02.
3. ADR *User-first identity: accounts, profiles, profile IDs, step-up* (thay ADR 0004, 0011) · viết lại
   `docs/architecture/identity.md` với các sơ đồ của [design §3](design.md#3-các-luồng) — D-01, D-02, D-05, D-06, D-17, E-01.
4. ADR *Sign-in methods and account linking* — D-03, D-04.
5. ADR *Platform admin and the first owner* · `docs/architecture/admin.md` — D-07, D-08, D-12.
6. ADR *Integrity engine and leaderboards by trust* · `docs/architecture/integrity.md`, `leaderboards.md` — D-09, D-11,
   D-16; D-10 là ADR contract riêng (ranked runs + verify module + conformance).
