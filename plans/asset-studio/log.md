# Log — Asset Studio

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, cái gì đang chờ ai. Tối đa 5 dòng mỗi mục.

## 2026-10-24 (5) — agent

- Owner xong S2; agent đặt `TOHE_ASSETS_REGISTRY`, viết ADR 0054 (#162), phát hành `uat-2026-10-24.4` (20/20) và
  `prod-2026-10-24.3` (23/23, platform-infra #253). Owner merge platform-infra #252: Studio chạy ở `studio.toheplay.io.vn`.
- Spec `games/vuon-rau` (#164): owner "spec ổn, chốt theo đề xuất". Token agent đã lưu và đã thử được.
- Bàn giao: phiên mới bắt đầu ở PLAN.md → Next (pilot V1 → V2).

## 2026-10-24 (4) — agent

- Merged #147–#160 (T2, B4, K1, K3b, W1a, B2, T1, B3, T1b, W1b, S1a, S1b). `uat-2026-10-24.3` (20/20) rồi
  `prod-2026-10-24.2` trên `ee69605` (23/23; platform-infra #251 — CI treo ~7 tiếng vì runner, rerun xong thì qua).
- Studio trên prod trả lời qua host hub (config 200, session 204, packs 401); thư viện trả 503 tới khi có R2.
- Chờ owner: S2 (R2, DNS `studio.`, `TOHE_ASSETS_REGISTRY`) để mở pilot V1–V2. S1b lên ở đợt sau.

## 2026-10-24 (3) — agent

- Merged: #140 (B1), #141 (K3a), #143 (C1), #144 (K2). B1 và K3a lên prod trong `prod-2026-10-24.1` (phiên
  `launch-review` tag, `check:prod` 23/23).
- Builder chạy bằng `isolation: worktree` và tự mở claim; không resume builder đã dừng; fetch trước khi giao.
- Test `RoomsTests…time_limit` (Jint) vấp khi máy tải nặng, luôn qua trên CI: ghi lại, không nới.
- Đang xây: B4, T2.

## 2026-10-24 (2) — agent

- #113 (plan) và #134 (ADR 0050–0052, `asset-studio.md`, `agent-tokens.md`) merged. Phiên surface giữ 0049, dùng 0054+.
- Điều chỉnh khi graduate ghi ở [delivery.md](delivery.md): N1–N3 một PR; B1 → B4 → B2 → B3; SeaweedFS thay MinIO; P0
  chưa đóng atlas; studio role trong schema `studio`.
- Các lane code chờ worker của phiên `launch-review` nhả claim (API, file sinh, kit, conformance, lockfile).
- Chờ owner: S2 (R2, Infisical, DNS `studio.`).

## 2026-10-24 — agent

- Owner: "ok chốt theo đề xuất, hướng review đã ổn, bạn hãy theo đề xuất làm việc đi, bạn đc merge PRs và deploy prod
  giúp tôi nhé" → D-09, D-10 (kỹ thuật), D-12 decided; delivery được duyệt; plan sang **Graduate**.
- Merge `origin/main` vào nhánh plan (có `tools/claims`, `/packet`). ADR 0046 ghi `studio.` là "public, no session":
  N2 sẽ sửa hàng đó. Phiên `launch-review` gọi hướng hình ảnh là "Xưởng tò he", nên app này giữ tên "Studio".
- Chờ owner: S2 (R2, Infisical, DNS `studio.`).

## 2026-10-23 (2) — agent

- Owner: "ok chốt theo đề xuất ổn, sau khi ra luồng thì tôi tối ưu chi tiết sau" → D-13 deferred; ngân sách của D-10 và
  license asset Tò He của D-07 để sau (tạm ghi `LicenseRef-Tohe-Internal`).
- Đưa D-12 (lock + `assets.gen.ts`, `dist/studio/`, conformance theo folder), D-09 (máy kiểm phía server + checklist +
  `withdrawn`) và D-10 (CLI `tohe-studio` cho P0) lên `proposed`.
- Viết bản nháp [delivery.md](delivery.md): 17 PR, 8 lane, 4 ADR, cùng S2 hạ tầng của owner.
- Chờ owner: chốt D-12, D-09, D-10 và delivery, rồi Graduate từ N1.

## 2026-10-23 — agent

- Owner: "ổn đó" → D-14 (Studio là app độc lập ở `studio.`) và D-15 (token cho agent dùng chung) decided; map được xác
  nhận đủ. Plan chuyển sang **Resolve**, 11 trên 15 quyết định đã chốt.
- Agent đề xuất để sau: D-13 (sau S1 và khi có game cần), ngân sách của D-10 (tới P2), license asset Tò He của D-07 (cùng
  LICENSE code). Chờ owner nói.
- Tiếp theo: agent đưa D-12, D-09 và phần kỹ thuật của D-10 lên `proposed`, rồi sang Converge.

## 2026-10-22 (3) — agent

- Owner: "D-11 ổn nha" → decided (A; ngoại lệ prod-chỉ-đọc mở cho đúng quyền tạo bản nháp).
- Owner hỏi Studio chung console hay tách, và có ý về sau cho agent cùng vận hành (monitoring, cập nhật, "nhạy cảm thì
  k"). Thêm D-14 (app độc lập ở `studio.`, chung API và DB) và D-15 (một cơ chế token có scope), cả hai `proposed`.
- Việc agent cùng vận hành được ghi vào *Not this plan* và *Considered and left off*: plan riêng, dùng lại D-15.
- Chờ owner: D-14, D-15, map.

## 2026-10-22 (2) — agent

- Owner: brief "đúng ý r" → confirmed; D-07 "chốt B nhé"; D-05 "on"; D-06 chọn object storage + state trong DB ngay từ
  đầu, build cần mạng và có cache; D-08 style do game chọn, style Tò He chỉ là mặc định.
- Re-align: design v2 (bỏ bước P0 trên git; P0 = module Studio + bucket + duyệt trong console); E-02 thêm cache theo hash;
  D-09 và D-11 tách nhau (tiêu chí ↔ chỗ chạy và quyền).
- D-11 mở lại ở mức `proposed`, vì D-06 làm phát sinh câu hỏi agent ghi vào Studio prod (`AGENTS.md:42`).
- Chờ owner: ngoại lệ ở D-11; map có thiếu gì không; license cho asset Tò He tự làm.

## 2026-10-22 — agent

- Mở plan từ brainstorm trong chat (2026-10-19 → 22). Owner chốt D-01 và D-02 ("ok chốt"), D-03 và D-04 ("tạm chốt").
- Đưa D-05 (pack), D-06 (P0 git → P1 object storage) và D-07 (danh sách license) lên `proposed`. Ghi R-01 và R-02.
- Phát hiện ngoài goal: repo public **chưa có LICENSE** cho code. Không đưa vào plan; báo owner.
- Phát hiện: luật "no network outside their folder" (`AGENTS.md:31`) chưa có máy kiểm; conformance chỉ kiểm origin. Sửa
  trong E-01.
- Chờ owner: xác nhận brief; D-07; D-05.
