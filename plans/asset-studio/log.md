# Log — Asset Studio

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, cái gì đang chờ ai. Tối đa 5 dòng mỗi mục.

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
