# R-05 — `platform-infra`: Tò He phải khớp với những gì

- Date: 2026-10-17 · Feeds: D-14 (E-03…E-06), E-02, E-08

## Câu hỏi

Cluster production do `platform-infra` (`~/workspace/platform-infra`) quản lý đặt ra quy ước gì cho chart Tò He?

## Phát hiện (đọc từ repo, 2026-10-17)

- **Giao hàng:** một ArgoCD trên `production` quản lý hai cluster (`production`, `homelab`). Mỗi component là một
  ApplicationSet với allow-list cluster theo nhãn `env`, sync wave, retry; chart pin bằng `targetRevision`, values nằm
  ở `apps/<component>/` (`README.md`, `docs/conventions.md` §1–§11).
- **Hai khuôn tích hợp:** `apps/outline` — chart cộng đồng, tắt subchart Postgres/Redis, trỏ `existingSecret` vào một
  `InfisicalStaticSecret`; `apps/platform` — chart OCI riêng trên GHCR, bump tag/chart tự động bằng PR từ repo app, mọi
  env để trong Infisical.
- **Ingress:** Traefik của k3s, HTTP trong cluster, **TLS kết thúc ở Cloudflare**. Một host chỉ một Ingress
  (`platform-app` dùng nginx tách `/api` — giống hub Caddy của Tò He). Traefik của production không tin header
  `X-Forwarded-*` từ Cloudflare; `CF-Connecting-IP` là cách ít bảo trì để có IP thật
  (`infrastructure/traefik/README.md`, *Gotchas*).
- **Postgres dùng chung:** CNPG, một instance, mỗi app một role + một database; `max_connections` 100 trên production;
  tổng giới hạn role hiện là 73 (infisical 15, platform 48, outline 10), khuyên giữ dưới khoảng 90, quá thì thêm
  PgBouncer. Backup: barman PITR 30 ngày lên R2 + `pg_dump` hằng đêm (`infrastructure/postgres/README.md`).
- **Secrets:** không bao giờ trong git; Infisical operator tạo Secret từ `InfisicalStaticSecret`; Reloader chỉ đọc
  annotation trên **metadata của Deployment** — Outline không tự restart được vì chart của nó hardcode annotation
  (`apps/outline/README.md`, *Rotating a secret*).
- **Storage:** `local-path`, gắn vào node có nhãn `platform-infra/data-node=true`.
- **Monitoring:** kube-prometheus-stack, selector mở toàn cluster (ServiceMonitor/PodMonitor của app sẽ được scrape);
  có alert rule nhưng chưa có ai nhận.
- **AppProject** chỉ cho deploy từ `sourceRepos` đã liệt kê (`argocd/managed/project.yaml`) — chart Tò He cần thêm
  `ghcr.io/vinh466/charts`.
- **Tự động merge:** chỉ PR bump do workflow mở mới tự merge; draft mở tay chờ owner.
- **Cluster `homelab`** đăng ký với `TLS_SAN=10.100.0.2` (`bootstrap/README.md`) — chính máy đang chạy UAT compose.

## Giả định

- Cloudflare → Traefik production là HTTP hay HTTPS chưa rõ, nên scheme đến hub là gì cũng chưa rõ — kiểm bằng
  `apps/whoami`. Thiết kế không phụ thuộc vào nó (E-03: Secure theo URL cấu hình).

## Ý nghĩa

- Chart Tò He đi theo khuôn `platform`, và `apps/tohe` theo khuôn `apps/outline` (D-14).
- Đặt annotation Reloader ở metadata Deployment; không sinh secret bằng `lookup` dưới ArgoCD.
- Tò He không cần PVC ở chế độ external (Data Protection keys nằm trong DB — `ToheDbContext.cs`).

## Nguồn

Repo của owner, đọc ngày 2026-10-17: `~/workspace/platform-infra` (`README.md`, `docs/conventions.md`,
`apps/outline/*`, `apps/platform/*`, `infrastructure/{postgres,redis,traefik}/README.md`, `argocd/managed/*`,
`bootstrap/README.md`) và `~/workspace/platform/deploy/helm/platform/README.md`.
