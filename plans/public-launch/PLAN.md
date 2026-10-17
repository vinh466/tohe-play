# Plan — Public launch

- Goal: Tò He sẵn sàng mở cho mọi người — user-first (một account, nhiều hồ sơ @handle), đăng nhập bằng email và
  Google/GitHub, admin console, bảng xếp hạng đáng tin, chạy trên cluster `platform-infra` bằng chart của chính nó.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)); nhiều item
  đã decided, track T1 graduate được ngay.
- Started: 2026-10-17 · Branch: `plan/public-launch` · PR: (draft — điền khi mở)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** · Log: [log.md](log.md)
- Research: [R-01 auth & liên kết](research/R-01-auth-linking.md) · [R-02 admin đầu tiên](research/R-02-first-admin.md) ·
  [R-03 bảng xếp hạng](research/R-03-leaderboards.md) · [R-04 hồ sơ & handle](research/R-04-profiles-handles.md) ·
  [R-05 platform-infra](research/R-05-platform-infra.md)

## Next — one item

**Owner trả lời [D-01](items/D-01-accounts-profiles-handles.md) Q1–Q5.** Nó mở khoá D-05, D-06, D-09 và E-01, tức
toàn bộ spec của T2. Song song, agent bắt đầu **T1** (đã decided ở [D-14](items/D-14-release-via-chart.md)): ADR
"production via the Tò He chart" → E-03 → E-04, trên nhánh feature riêng — trừ khi owner muốn chờ.

## Waiting on the owner

Câu nào chín trước thì trả lời trước.

1. **Brief** — xác nhận [brief.md](brief.md) (plan rời *Frame*).
2. **D-01** — Q1 giới hạn 5 hồ sơ · Q2 luật handle · Q3 mã quản lý · Q4 hai bố mẹ · Q5 mẫu hồ sơ trẻ em.
3. **D-05** — hai mức xác thực lại (mã quản lý cho hồ sơ, xác thực thật cho bảo mật account).
4. **D-06** — mốc tuổi N sau khi kiểm tra pháp luật.
5. **D-09** Q1–Q3 · **D-10** Q1 · **D-11** Q1–Q2 — bảng xếp hạng.
6. **E-02** — địa chỉ gửi email; dùng chung account Resend của `platform`?
7. **D-15** — để UAT HTTPS sang sau?
8. **Map** — thiếu item nào không ([map.md](map.md)).

## Board

| ID | Item | Track | Kind | Status | Blocked by |
|---|---|---|---|---|---|
| D-01 | [Account – hồ sơ – @handle](items/D-01-accounts-profiles-handles.md) | T2 | decision | proposed | — |
| D-02 | [Email là định danh + bộ luồng chuẩn](items/D-02-email-identity.md) | T2 | decision | **decided** | — |
| D-03 | [Liên kết cách đăng nhập](items/D-03-account-linking.md) | T4 | decision | **decided** | D-02 |
| D-04 | [Cách đăng nhập v1 · cấu hình 2 lớp · OAuth ở prod](items/D-04-sign-in-methods.md) | T4 | decision | **decided** | D-03 |
| D-05 | [Xác thực lại hai mức](items/D-05-step-up.md) | T2 | decision | proposed | D-01 |
| D-06 | [Cổng tuổi & đồng ý điều khoản](items/D-06-age-and-consent.md) | T2 | decision | proposed | D-01 |
| D-07 | [Admin console](items/D-07-admin-console.md) | T6 | decision | **decided** | — |
| D-08 | [Admin đầu tiên](items/D-08-first-owner.md) | T6 | decision | **decided** | D-07 |
| D-09 | [Bảng xếp hạng phân tầng theo độ tin](items/D-09-leaderboards.md) | T5 | decision | proposed | D-01, D-12 |
| D-10 | [Run đã xác minh (đổi contract)](items/D-10-verified-runs.md) | T5 | decision | proposed | D-09 |
| D-11 | [Bảng & hạng của phòng](items/D-11-room-boards.md) | T5 | decision | proposed | D-09 |
| D-12 | [Chế độ đăng ký & mã mời cộng đồng](items/D-12-registration-modes.md) | T7 | decision | **decided** | D-02 |
| D-13 | Games origin trên domain riêng | T7 | decision | open | — |
| D-14 | [Release bằng chart + GHCR + promote](items/D-14-release-via-chart.md) | T1 | decision | **decided** | — |
| D-15 | [UAT có HTTPS](items/D-15-uat-https.md) | T1 | decision | proposed (defer) | D-04 |
| E-01 | [Chuyển dữ liệu UAT](items/E-01-uat-migration.md) | T2 | enhancement | proposed | D-01 |
| E-02 | [Email giao dịch](items/E-02-transactional-email.md) | T3 | enhancement | proposed | — |
| E-03 | Image chạy mọi môi trường — [trong D-14](items/D-14-release-via-chart.md#e-03--image-chạy-được-ở-mọi-môi-trường-code) | T1 | enhancement | **decided** | — |
| E-04 | Chart `tohe` — [trong D-14](items/D-14-release-via-chart.md#e-04--chart-tohe-deployhelmtohe) | T1 | enhancement | **decided** | E-03 |
| E-05 | UAT kéo image GHCR — [trong D-14](items/D-14-release-via-chart.md#e-05--uat-chạy-đúng-image-sẽ-lên-prod) | T1 | enhancement | **decided** | E-04 |
| E-06 | `apps/tohe` ở `platform-infra` (draft PR) — [trong D-14](items/D-14-release-via-chart.md#e-06--component-appstohe-trong-platform-infra-draft-pr) | T1 | enhancement | **decided** | E-04 publish |
| E-07 | Quyền riêng tư, xoá account, kiểm duyệt tên | T7 | enhancement | open | D-01, D-06, D-09 |
| E-08 | Observability | T8 | enhancement | open | E-04 |
| E-09 | Chống bot đăng ký (Turnstile, tuỳ chọn) | T7 | enhancement | open | D-12 |
| E-10 | Checklist ra mắt | — | enhancement | open | E-07, E-08, E-09, D-13 |

Item chưa có link = chưa mở file; file được tạo khi item rời `open`.

## Graduation list (nháp — chốt ở phase Converge)

Số ADR gán lúc graduate (số trống kế tiếp hiện là 0021).

1. ADR *Production via the Tò He chart* (sửa phần production của ADR 0010) · `deploy/helm/tohe` · CI publish ·
   `docs/guides/production.md`, `docs/guides/self-hosting.md` — D-14 (E-03…E-05); E-06 ở `platform-infra`.
2. ADR *Transactional email* — E-02.
3. ADR *User-first identity: accounts, profiles, handles, step-up* (thay ADR 0004, 0011) · viết lại
   `docs/architecture/identity.md` với các sơ đồ của [design §3](design.md#3-các-luồng) — D-01, D-02, D-05, D-06, E-01.
4. ADR *Sign-in methods and account linking* — D-03, D-04.
5. ADR *Platform admin and the first owner* · `docs/architecture/admin.md` — D-07, D-08, D-12.
6. ADR *Leaderboards by trust* · `docs/architecture/leaderboards.md` — D-09, D-11; D-10 là ADR contract riêng.
