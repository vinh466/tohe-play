# D-11 — Bảng và hạng cho phòng nhiều người: tính ván nào, xếp theo gì?

- Status: **decided** (2026-10-17, chat) — luật "ít nhất 2 người thật" chạy như tín hiệu `Farming` của engine (D-16)
- Kind: decision
- Blocks: bảng công khai của phòng (D-09 bước 2) · Blocked by: D-09
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Hiện trạng

- Kết quả ván do server quyết (luật chạy trong Jint — ADR 0016); lịch sử ván lưu trong `RoomHistory`.
- Thống kê theo hồ sơ: số ván, số lần nhất, tổng điểm; bảng tuần = 7 ngày trượt trong household; **ván ngồi với bot
  cũng được tính** (`services/api/src/Tohe.Api/Modules/Rooms/RoomStats.cs:58-75`).

## Vấn đề khi công khai

- Thắng bot dễ (nhất là bot dễ) thì cày bảng được bằng cách chơi một mình với bot.
- Xếp theo tổng điểm thì ai chơi nhiều thắng — hợp với bảng tuần (khuyến khích chơi), không đo kỹ năng.

## Đề xuất của agent

1. **Bảng công khai chỉ tính ván có ít nhất 2 người thật.** Ván với bot vẫn vào thống kê cá nhân và bảng trong
   account.
2. **Bảng tuần xếp theo tổng điểm** của game (Tiến Lên: điểm theo thứ hạng mỗi ván) — đúng thứ đang tính hôm nay,
   chỉ đổi phạm vi và tuần cố định (D-09).
3. **Hạng kỹ năng để sau:** rating OpenSkill (mô hình Plackett-Luce, giấy phép mở, nhanh hơn TrueSkill với độ chính
   xác tương đương — [R-03](../research/R-03-leaderboards.md)), cần ít nhất 20 ván mới hiện. Không thuộc v1.
4. Bạn bè "nhường" nhau trong cùng bàn: chấp nhận rủi ro ở quy mô vài cộng đồng; admin gỡ được kết quả.

## Câu hỏi cho owner (đã trả lời 2026-10-17)

- **Q1** Luật "ít nhất 2 người thật" cho bảng công khai — *ổn*.
- **Q2** Hạng kỹ năng (rating) để sau ra mắt — *ổn*.

## Decision

**owner** (2026-10-17, chat): "còn lại ôn" — chấp nhận cả bốn điểm của đề xuất trong report cùng ngày.
