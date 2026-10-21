# Log — Bề mặt sản phẩm

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, đang chờ ai. Tối đa 5 dòng mỗi mục.

## 2026-10-21 — agent

- I3a #102, I3b #103 merged; I2 + I3 → `uat-`/`prod-2026-10-21.1` (95fdf6d), owner: prod ok.
- Owner: I4 một PR; câu chữ agent tự chọn và áp dụng ("cứ yolo"), phase review soát sau; Điều khoản + Quyền riêng tư
  chốt ở phase review, trước khi mở hẳn — không cập nhật theo từng tính năng.
- Owner: master xhigh; **mọi worker Opus, effort tối đa high** → `.claude/agents/`, `working-with-agents.md`, delivery.
- I4 `feat/i4-game-entries`: builder (Opus · high) đang làm; master review → reviewer → PR.

## 2026-10-20 (tối) — agent

- S4 #93, S1 #94 → `prod-2026-10-20.2`; I1 #96 → `prod-2026-10-20.3`, `check:prod` 23/23.
- I2 chia hai, I2a #97 + I2b #99 merged (reviewer mỗi phần); **chưa deploy** — chờ owner, đề xuất Điều khoản trước.
- Owner "chốt" ADR 0044 #98 và 0045 #100 (mọi điểm agent thêm) và merge. I3 chia hai: I3a (server) đang review, I3b
  (hub) sau; code I4 sau I3. Owner vẫn tự chạy `gh pr merge` (auto mode chặn agent).

## 2026-10-20 (chiều) — agent

- Google lên prod 13:29 (S3 xong): Infisical `/tohe/api` → `tohe-api-env`; API khởi động trước khi Secret có nên owner
  restart một lần. Owner giữ đăng ký **mở**, bật chống bot — **người dùng thật đã vào**.
- Owner: làm nốt Phase 1 rồi phase review toàn diện trước launch chính thức. S4 + S1 (hai builder); ADR 0043 cho I1 (#91).
- Alertmanager prod chờ owner chọn kênh; thử khôi phục DB để khi chốt ngày launch.

## 2026-10-20 — agent

- B3 #84, S2 #85 merged; CI bắt lỗi thật: service worker trả vỏ app ở `/` (Workbox `directoryIndex`) → sửa trước merge.
- Owner "chờ CI xanh bạn deploy lên uat lẫn prod" → `uat-2026-10-20.1` (20/20) → `prod-2026-10-20.1`, platform-infra#240
  (owner merge 08:38) → **prod chạy 78b7a60**, `check:prod` 23/23. GitHub Release: owner tạo (auto mode chặn agent).
- Owner: Cloudflare Access cho console là tuỳ chọn (MFA đủ). Owner làm Google (S3) ngay — agent đưa giá trị, chờ Client ID.

## 2026-10-19 (khuya) — agent

- Owner "deploy và làm" → `uat-2026-10-19.1` (d23baab) lên UAT, `check:uat` 11/11. B2 #80, B5 #79 merged. B4 #81 merged lúc CI
  còn đỏ (draft); #82 sửa: `helm test`, 401 do `Root` của console chọn theo `location`, cùng 6 điểm của reviewer — CI xanh,
  merged (b787005). Owner merge #72 (plan lên `main`) và #74 (vision).
- Owner "deploy đi, và làm công việc tiếp" (23:02) → B3 + S2 (hai builder); deploy một tag `uat-` mới khi CI của b787005 xanh.

## 2026-10-19 (tối, merge) — agent

- Owner "merge PR giúp tôi" → chế độ auto chặn `gh pr merge` của agent; owner tự merge #77, #78, #76. Agent thử trước
  thứ tự trên máy: #75 xung đột (`package.json`, `compose.yaml`, giữ cả hai) → merge `main` vào, `pnpm verify` xanh.
- Đã gửi owner danh sách quyết định: #74, deploy B1, B2 + B4, chế độ Đăng ký (đề xuất invite), proof-of-work (bật),
  E-02 Q2 (đề xuất `ai-train=no`), Cloudflare AI Crawl Control.

## 2026-10-19 (tối, đợt đầu) — agent

- Owner "enhance CI" → [#73](https://github.com/vinh466/tohe-play/pull/73) merged (PR docs ~50 s, PR code ~8,6 phút). Owner
  "làm việc tiếp" → K1 #74 (draft), N3 #75, N2 #76, B1 #77 — worker không commit, master review rồi commit; reviewer cho B1.
- N2 chạy thật lần đầu bắt sự cố prod ~18:30: DNS `games` mất (NXDOMAIN) → owner thêm lại; 19:00 `check:prod` 17 đạt / 0 lỗi
  (cảnh báo duy nhất: chưa có tag `prod-`). `_dmarc` đã đúng chỗ.
- B1 CI xanh. S3 = #78 (hướng dẫn Google, master viết): Google có khoá là bật ngay → chọn chế độ Đăng ký trước.
- Chờ owner: review #74–#78; `hub.securityContact` ở platform-infra khi B1 lên prod. Sau B1: B2 + B4; B5 sau B1.

## 2026-10-19 (N1) — agent

- Lần chạy đầu của rule: master viết ADR 0041; builder (Sonnet · high) viết `environments.md`, sửa docs, 4 agent
  `.claude/agents/`; reviewer (Opus · high) tìm 0 blocker / 5 major / 9 minor — master sửa hết, `pnpm verify` xanh →
  [#71](https://github.com/vinh466/tohe-play/pull/71). Worker không commit (master commit sau review) — rule ghi lại.
- Owner đã merge #42 (plan public-launch) vào `main` và #70 vào `plan/public-launch`; plan này mở PR mới về `main`.

## 2026-10-19 (tiếp) — agent

- Owner đặt trần chi phí: tối đa Opus 5.5 · xhigh (chỉ master), không Fable/max/fast → rule điều phối chỉnh theo; owner
  "ok triển đi" → **rule chốt**, **Graduate** bắt đầu: N1 trên nhánh `docs/n1-environments`.

## 2026-10-19 — agent

- Owner: "ok r đó, chốt nha … Q8 dổi luôn key của chart cho đồng bộ, Q9 dùng console. lun" → **D-01 decided**: L1, console
  ở `console.toheplay.io.vn` (`apps/console`, key chart `console`, cookie `__Host-tohe.console`; vai trò và `/api/admin/…`
  giữ tên), key chart `site` → `docs`. Brief confirmed.
- **Converge**: [delivery.md](delivery.md) — 18 PR (N1–N3, B1–B5, S1–S4, I1–I4, K1–K2), năm ADR mới. Chờ owner: "làm" cho N1.

## 2026-10-19 (khuya) — agent

- Owner bật Email Routing → agent kiểm DNS: 3 MX, SPF gốc, DKIM `cf2024-1`, DMARC; `send.` nguyên vẹn. Chờ thư thử.
- Owner: chọn tự do một chuẩn hiệu quả, không ngại sửa cũ hay thêm subdomain → R-06 (RFC 10017 BFF, HSTS, status, Kahoot…)
  + **D-01 v4**: chuẩn bốn tầng, chấm L1/L2/L3 theo N1–N10 → L1; thêm `admin.` (+ Cloudflare Access), `notify.`, `status.`,
  HSTS `includeSubDomains`, tên UAT `*.uat.`; P1-1 tách a/b/c. Chờ owner: Q1, Q7–Q12.

## 2026-10-19 (nửa đêm) — agent

- Owner trả lời D-01: Q2 `/play` + route tiếng Anh, Q3 route công khai tiếng Anh, Q4 Email Routing, Q5 tắt Scalar có cờ,
  Q6 tài liệu lên gốc `docs.` → decided. Q1: hợp lý về hình thức, hỏi kỹ thuật/mở rộng của tiền tố path.
- D-01 v3: một bản đồ namespace `@tohe/routes` sinh Caddy/SW/robots/`HubPaths` + test va chạm (hôm nay đường dẫn hub viết
  tay ở 5 nơi); luật path hay subdomain + ví dụ; giới hạn thật; Q7 gom route app vào `/play/` + `/account/`; Q8 `apps/docs`.

## 2026-10-19 (gần nửa đêm) — agent

- Owner: "ổn nha, theo đề xuất" → decided: E-01 Q6, E-04, D-04, D-05, D-06 (Q6 = A), D-07, D-08, E-02 (trừ Q2), E-03.
- Owner muốn review bố cục host → **D-01 v2**: bảng trước → sau, sơ đồ hub quyết định trả gì (danh sách route của app sinh
  từ router), từng môi trường, cái không đổi (DNS, `platform-infra`, ba host), Q6 tiền tố `/docs/`. Chờ owner: D-01, E-02 Q2.

## 2026-10-19 (khuya) — agent

- Owner: tag là deploy; agent tự chạy deploy UAT và tự mở + merge PR `targetRevision` ở `platform-infra` — cầu nối tạm,
  workflow sau; "đồng ý" tag `uat-…` → **E-01 decided** (Q6 còn proposed). Owner hỏi "còn gì nữa k … review toàn cảnh".
- Rà toàn cảnh, thêm vào item: tuổi/đồng ý khi hồ sơ máy lên server (D-06 Q6, NĐ 13/2023 Đ20); xoá hồ sơ máy (D-07 S13);
  SDK tự trả `unsupported` nên game cũ không phải sửa (D-08); Góp ý + mục tiêu ≤ 10 s tới khung hình đầu (E-03); văn bản pháp
  lý phủ hồ sơ máy/link/Google (E-05). DMARC ✔; MX và proof-of-work chưa. PLAN: một lượt "đồng ý theo đề xuất"; Next P0-1.

## 2026-10-19 (tối) — agent

- Owner chốt: migration tạo ra là chốt; prod chỉ chạy commit đã lên UAT, tag `prod-…`, `main` là nhánh chính (E-01 một
  phần); `toheplay.io.vn` duy nhất (D-02 decided); không chia đối tượng — vòng đời một user (D-03 decided); muốn OAuth.
- R-04: `main` + build một lần + tag `uat-*`/`prod-*` làm môi trường, dev local Mode C + dữ liệu mẫu → E-01 Q2, Q5, Q6.
- Owner nêu case 1/case 2 định danh và lời mời → R-05 + **D-06** (hồ sơ máy, ba bậc), **D-07** (liên kết, ma trận S1–S12),
  **D-08** (lối vào, đường ống, contract); D-05 v2 (Google); E-03 v2; design §6 vòng đời; 17 sơ đồ mermaid parse sạch.

## 2026-10-19 — agent

- Owner đặt hướng sau ngày lên prod: rà việc dang dở, chốt luồng dev/test/môi trường trước, subdomain, SEO/GEO, người mới
  + PWA; Phase 1 = bề mặt, hub và game để sau. Mở plan này (Frame), brief chờ owner xác nhận.
- Rà soát: [R-01](research/R-01-backlog-review.md) — `_dmarc` đang nằm sai chỗ (TXT ở gốc), prod `registration: open` +
  proof-of-work tắt, hub soft-404, không `og:`, manifest không `id`, người mới gặp form đăng nhập, link bàn bắt đăng ký.
- Research R-02 (host, SEO, GEO), R-03 (PWA, iOS 26, Zalo). Đề xuất: E-01, D-01, D-02, D-04, D-05, E-02, E-03, E-04; D-03
  và E-05 mở. Chờ owner: brief, hai việc Ngay, E-01 Q1–Q3 trước tiên.
