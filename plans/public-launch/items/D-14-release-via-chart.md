# D-14 — Release: chart riêng của Tò He, image trên GHCR, promote UAT → prod qua `platform-infra`

- Status: **decided** (2026-10-17, chat) — gồm phạm vi của E-03, E-04, E-05, E-06
- Kind: decision
- Blocks: E-03 → E-04 → E-05, E-06; E-08 · Blocked by: —
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Ranh giới đã chốt

| Chart Tò He sở hữu | `platform-infra` sở hữu |
|---|---|
| Topology 4 workload (hub, api, games, site), Service, Caddy + CSP, probes | Namespace, hostnames, DNS |
| Hợp đồng config/secret (tên key), migration lúc khởi động | Nội dung secret (Infisical `/tohe`), role Postgres |
| Guard: API một replica, strategy `Recreate`, thiếu URL thì render lỗi | Version nào chạy, khi nào, rollback |
| `values.schema.json`, tài liệu, test các profile tích hợp | Backup, cảnh báo, ngân sách tài nguyên |

Khuôn mẫu: chart `platform` (`~/workspace/platform/deploy/helm/platform`) — mode `builtin | external | disabled` cho
từng phần hạ tầng, `existingSecret`, guard lúc render, chart và image có version độc lập ([R-05](../research/R-05-platform-infra.md)).

## Phần việc

### E-03 — Image chạy được ở mọi môi trường (code)
- Site đang gắn cứng `PUBLIC_HUB_URL` / `TOHE_SITE_URL` lúc build (`deploy/docker/web.Dockerfile`, target
  `build-site`) → đọc lúc chạy (ví dụ Caddy `templates`) để một image dùng được cho UAT, prod và người tự cài.
- Cookie `Secure` theo cấu hình URL công khai, không theo header: hôm nay là `SameAsRequest`
  (`services/api/src/Tohe.Api/Modules/Identity/IdentityModule.cs:56`), mà sau Cloudflare → Traefik → Caddy thì
  scheme đến API có thể là `http`.
- IP thật của người dùng cho rate limit: Caddy hub cần `trusted_proxies` + `client_ip_headers CF-Connecting-IP`
  cấu hình được (`deploy/docker/Caddyfile.hub`); API đang tin mọi proxy (`IdentityModule.cs:103-108`) — chỉ đúng khi
  API không bị lộ ra ngoài.
- `AllowedHosts` cố định theo host của hub (đang là `*`); HSTS ở cả ba Caddyfile.

### E-04 — Chart `tohe` (`deploy/helm/tohe/`)
- Values chính: `publicUrls.{hub,games,site}` (bắt buộc; nguồn duy nhất để suy ra CSP, `GAMES_ORIGIN`, `HUB_ORIGINS`,
  `Games__PublicOrigin`, cookie Secure); `infra.postgres.mode: builtin | external`; `secrets.existingSecret` hoặc
  `secrets.create` (chỉ cho `helm install` tay — **ArgoCD render bằng `helm template` nên không chạy `lookup`; sinh
  secret ngẫu nhiên dưới ArgoCD sẽ đổi mỗi lần sync**); `proxy.trustedProxies` / `proxy.clientIpHeader`; `ingress`
  (tắt được để platform tự mang IngressRoute); các điểm cắm chung: annotations trên **metadata của Deployment**
  (Reloader chỉ đọc ở đó), `podAnnotations`, `extraEnv`, `extraEnvFrom`, `extraVolumes`, `resources`,
  `nodeSelector`/`tolerations`/`affinity`, `securityContext`, `serviceAccount`, `imagePullSecrets`;
  `networkPolicy.enabled`, `metrics.serviceMonitor.enabled`.
- Hợp đồng chỉ được **thêm** key: SMTP (E-02), OAuth (D-04), `Admin__SetupToken` (D-08) sẽ vào sau, không phá values cũ.
- `values.schema.json`; profile CI `ci/standalone.yaml`, `ci/platform-infra.yaml`, `ci/byo-ingress.yaml`; CI render cả
  ba và cài `standalone` lên kind; semver + CHANGELOG, đổi tên key thì giữ alias ít nhất một minor.
- Publish: image `ghcr.io/vinh466/tohe-play/<api|hub|games|site>:sha-<sha>`, chart `oci://ghcr.io/vinh466/charts/tohe`
  với version `<Chart.yaml version>-g<sha7>` (cùng quy ước với `platform`). Repo public → không cần pull secret.

### E-05 — UAT chạy đúng image sẽ lên prod
`deploy/uat/deploy.sh` kéo image theo SHA từ GHCR thay vì build tại máy; vẫn backup trước và vẫn deploy một commit
chính xác. Thứ người thân đã thử chính là thứ lên prod.

### E-06 — Component `apps/tohe` trong `platform-infra` (draft PR)
Theo khuôn `apps/outline`: `values.yaml` (chỉ production), `base/static-secret.yaml` (Infisical `/tohe`),
ApplicationSet wave 3, thêm `ghcr.io/vinh466/charts` vào `sourceRepos` của `argocd/managed/project.yaml`, cặp
role/database `tohe` trong `infrastructure/postgres/base/databases.yaml` với `connectionLimit: 10` (tổng các role lên 83
trên `max_connections` 100 — dưới ngưỡng khoảng 90 mà repo đó khuyên), và connection string có `Maximum Pool Size`
nhỏ (mặc định của Npgsql là 100). Pre-step: `02-role-secret.sh tohe`, điền `/tohe` trong Infisical, DNS proxied.
**Mở từ một phiên chạy trong repo `platform-infra`** (phiên của repo này chỉ được chạy git ở đây), **sau lần publish
chart đầu tiên** (để có `targetRevision`). Draft — owner tự merge (hand-opened draft không tự merge).

Promote về sau: một workflow `workflow_dispatch(sha)` mở PR bump tag/`targetRevision` vào `platform-infra`; cổng deploy
prod là thao tác promote của owner.

## Decision

**owner** (2026-10-17, chat): "về chart, mảng này khá là clear r nên bạn hãy chuẩn bị nó luôn để khi updagrade nền
tảng có thể test hay enhance tiếp trên nó được luôn nha, trên platform-infra thì tạo 1 nhánh và PR sẳn cho tôi khi nào
cần thì merge và phóng thôi"; registry `ghcr.io/vinh466` public và cổng promote bằng tay — "còn lại các dề xuất của
bạn ổn nha".

Hệ quả: một ADR "production via the Tò He chart" sửa phần production của ADR 0010.
