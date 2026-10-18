# E-08 — Observability: `/metrics`, ServiceMonitor, cảnh báo tối thiểu

- Status: **proposed** (2026-10-18) — chờ owner quyết Q1–Q3
- Kind: enhancement — một thư viện NuGet mới, một cổng mới của API, hai template mới trong chart (ADR khi xây)
- Blocks: E-10 (checklist ra mắt) · Blocked by: E-04 (chart, #44)
- Decided: —

## Vì sao

Prod chạy trên cluster `platform-infra`. Khi có người chơi thật, owner cần biết trước người chơi: API còn sống không,
lỗi 5xx có tăng không, email có kẹt không, worker nền có hỏng liên tục không. Trang Hệ thống của admin chỉ cho biết khi
có người mở nó.

## Hiện trạng

Sự thật (2026-10-18):
- API có `/api/health`, gồm kiểm tra database (`services/api/src/Tohe.Api/Program.cs:72`,
  `Infrastructure/Database/DatabaseExtensions.cs:12`). Không có metrics, `Meter` hay OpenTelemetry nào.
- `BackgroundWork` giữ trạng thái từng worker trong bộ nhớ — `catalog-sync`, `email-delivery`,
  `telemetry-maintenance`, `ranked-replays` (trang Hệ thống của admin). Tổng quan của admin đếm outbox email: đang chờ,
  gửi và bỏ cuộc trong 24 giờ, thư cũ nhất.
- Hợp đồng chart (D-14) đã chừa khoá `metrics.serviceMonitor.enabled`, nhưng chart ở #44 chưa có template nào cho nó.
- Cluster: kube-prometheus-stack, selector mở toàn cluster — ServiceMonitor/PodMonitor của app nào cũng được scrape; đã
  có alert rule nhưng **chưa có ai nhận** cảnh báo (R-05).
- NuGet (2026-10-18): `OpenTelemetry.Exporter.Prometheus.AspNetCore` vẫn là beta (1.20.0-beta.1);
  `prometheus-net.AspNetCore` 8.2.1 là bản ổn định.
- Telemetry thiết bị (ADR 0015) là chuyện khác: số liệu từ máy người chơi, đọc trong admin — không trộn vào Prometheus.

## Phương án

| | Cách | Giá |
|---|---|---|
| **A** | **prometheus-net**: `/metrics` trên một cổng riêng của API (ví dụ 9464), không đi qua Caddy của hub nên không lộ ra internet; ServiceMonitor trỏ vào cổng đó; NetworkPolicy chỉ mở cho namespace monitoring. Metrics có sẵn của ASP.NET Core (thời gian request theo route và status), runtime (GC, thread pool), Npgsql (pool kết nối), cộng các metric của Tò He viết bằng `System.Diagnostics.Metrics` — prometheus-net xuất luôn `Meter` của .NET. | Một package ổn định; khoảng 1–2 ngày công. Đổi sang OpenTelemetry sau này chỉ thay phần xuất, code metric giữ nguyên. |
| **B** | **OpenTelemetry + Prometheus exporter**: như A nhưng theo chuẩn OpenTelemetry. | Package exporter vẫn beta khi chạy prod. |
| **C** | **OpenTelemetry OTLP** đẩy tới Prometheus (bật OTLP receiver) hoặc một collector. | Package ổn định, nhưng phải đổi ở `platform-infra` (cờ của Prometheus hoặc thêm collector) — ngoài repo này. |
| **D** | Không metrics: trang admin và log. | Rẻ nhất; không có cảnh báo nào. |

## Metrics của Tò He (nếu chọn A, B hoặc C)

Nhãn luôn có giới hạn — không bao giờ có id hồ sơ, email, mã phòng hay đường dẫn thô:

- `tohe_rooms_open`, `tohe_rooms_playing`, `tohe_rooms_connected` — số phòng mở, đang chơi, người đang kết nối.
- `tohe_email_outbox_waiting`, `tohe_email_outbox_oldest_seconds`; `tohe_email_sent_total`, `tohe_email_failed_total`.
- `tohe_worker_failures_in_row{worker}`, `tohe_worker_last_success_age_seconds{worker}`.
- `tohe_integrity_held`, `tohe_ranked_replays_waiting` — kết quả chờ người xem, run chờ chạy lại.
- `tohe_sign_ins_total{method, outcome}` — `method`: password, google, github, oidc; `outcome`: ok, refused, locked.

## Cảnh báo tối thiểu

Một `PrometheusRule` trong chart, tắt được (`metrics.prometheusRule.enabled`):

| Alert | Khi | Mức |
|---|---|---|
| `ToheApiDown` | Prometheus không scrape được API trong 5 phút | critical |
| `ToheDatabaseUnhealthy` | Kiểm tra database hỏng trong 5 phút | critical |
| `ToheApiErrors` | Hơn 5% request trả 5xx trong 10 phút, khi có trên 20 request | warning |
| `ToheApiSlow` | p95 thời gian request trên 1 giây trong 15 phút | warning |
| `ToheEmailStuck` | Thư cũ nhất đã chờ quá 15 phút, hoặc có thư bỏ cuộc trong 1 giờ | warning |
| `ToheWorkerFailing` | Một worker nền hỏng từ 3 lần liên tiếp | warning |

Ai nhận cảnh báo là cấu hình Alertmanager của cluster — việc của `platform-infra` (một PR draft ở repo đó).

## Đề xuất của agent

**A**, cùng bảng cảnh báo trên. Dashboard Grafana (ConfigMap có label cho sidecar của Grafana) để tuỳ chọn trong chart,
làm sau nếu owner muốn. Không đụng tới telemetry thiết bị.

## Câu hỏi cho owner

- **Q1** — A (prometheus-net, ổn định) hay B (OpenTelemetry, exporter còn beta)?
- **Q2** — Cảnh báo gửi tới đâu: email của owner (qua Resend), Telegram hay Discord? Cấu hình nằm ở `platform-infra`.
- **Q3** — Các ngưỡng ở bảng trên có hợp với quy mô "vài cộng đồng nhỏ" không?

## Quyết định

—

## Thảo luận

—
