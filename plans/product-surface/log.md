# Log — Bề mặt sản phẩm

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, đang chờ ai. Tối đa 5 dòng mỗi mục.

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
