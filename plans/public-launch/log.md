# Log — Public launch

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, đang chờ ai. Tối đa 5 dòng mỗi mục.

## 2026-10-18 — owner + agent (chat)

- Owner: "ok rồi đó, theo đề xuất bạn có thể impl toàn bộ giúp tôi k, planning và làm những việc song song" → D-16 Q4,
  D-06 (N = 16), E-02 (Q1), E-01 decided; E-02 Q2 (Resend Free/Pro) và D-13 còn chờ nhưng không chặn code.
- Plan sang *Graduate*: [delivery.md](delivery.md) — 19 PR trong sáu lane, ADR 0021…0027, quy tắc merge migration
  từng cái một. Agent bắt đầu A1.

## 2026-10-17 (khuya) — owner + agent (chat)

- Owner: "ok ngu de xuat cua ban on nba" → D-17 decided (bỏ @handle, tên thoải mái có emoji, ID 12 số, tên vui ngẫu
  nhiên, ba mức mời); D-16 decided Q1–Q3 (module, replay Ghép Khối trong v1, minh bạch); D-10 decided.
- Owner hỏi giải thích bốn câu còn chờ → agent viết đề xuất cho từng câu: D-16 Q4 (bảng cộng đồng nhận `checked` cho
  game chưa có replay), D-06 (N = 16, theo R-07 mới về luật trẻ em), E-02 Q1 (`no-reply@…`), E-02 Q2 (Resend Free hay Pro
  — gói Free dùng chung 100 email/ngày với platform).
- Chờ owner: bốn câu trên. Agent kế tiếp: T1.

## 2026-10-17 (tối) — owner + agent (chat)

- Owner: "ok on … còn lại ôn" → brief xác nhận (plan sang *Map*); D-01, D-05, D-09, D-11 decided; D-15 deferred.
- Owner đổi tên hồ sơ thành "đặt thoải mái cho vui" + ID `xxxx xxxx xxxx` để mời đích danh, hồ sơ mặc định có sẵn → D-17
  proposed (bỏ @handle, ID 12 số có chữ số Damm); research bổ sung friend code Nintendo, Damm (R-04).
- Owner muốn "1 engine xịn" cho độ tin → D-16 proposed (mức tin theo bằng chứng, máy chỉ ẩn người mới phạt, verifier và
  tín hiệu cắm thêm); D-10 thành verifier đầu tiên; R-06 (Steam, Google Play, Lichess, Trackmania).
- Chờ owner: D-17 Q1–Q4, D-16 Q1–Q4, D-06, E-02. Agent kế tiếp: T1.

## 2026-10-17 — owner + agent (chat, ba lượt)

- Owner đặt hướng: release là kim chỉ nam, sửa nền trước; user-first; auth bằng email + Google/GitHub; admin console;
  chart riêng cho `platform-infra`. Agent review và tách thành các track; owner chấp nhận các đề xuất còn lại.
- Owner đổi family thành "một account nhiều hồ sơ, @handle duy nhất" → D-01 proposed (agent rút lại phương án Family);
  OAuth chỉ ở prod → D-04 decided, D-15 proposed defer; luồng auth chuẩn, vẽ mermaid → D-02/D-03 decided, design §3.
- Mở plan space (`plans/`, ngoài `docs/` vì site publish mọi thứ dưới `docs/`); research R-01…R-05; bảng xếp hạng
  phân tầng theo độ tin (D-09…D-11).
- Chờ owner: brief, D-01 Q1–Q5, D-05, D-06, D-09…D-11, E-02, D-15. Agent kế tiếp: T1 (ADR production via chart → E-03 → E-04).
