# D-09 — Bảng xếp hạng khi người chơi là người lạ với nhau: phạm vi nào, chu kỳ nào, tin điểm tới đâu?

- Status: **decided** (2026-10-17, chat) — cách thực thi độ tin là engine ở [D-16](D-16-integrity-engine.md)
- Kind: decision
- Blocks: D-10, D-11, D-16, T5 spec, E-07 · Blocked by: D-01, D-12
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Vì sao cần chốt

Bảng hôm nay chỉ tính trong household. Sau D-01, đa số account chỉ có một hồ sơ, nên "bảng trong nhà" chỉ có một
người. Nhưng một bảng công khai nhận điểm do thiết bị tự báo sẽ bị gian lận ngay ngày đầu: ai có phiên đăng nhập là
gửi được điểm tuỳ ý bằng devtools hay curl.

## Hiện trạng (từ code)

- **Game một người — điểm do client báo.** `POST /api/progress/scores` nhận mọi giá trị hữu hạn của hồ sơ đang chơi;
  chỉ kiểm tra tên game, số hữu hạn, tối đa 200 điểm mỗi lần (`services/api/src/Tohe.Api/Modules/Progress/ProgressModule.cs:124-178`).
  Thời điểm lấy theo đồng hồ thiết bị. Run dài (ADR 0014): điểm chỉ tăng, hiện "đang chơi".
- **Seed do thiết bị kiểm soát.** Hub tính `dailySeed()` theo ngày địa phương (`apps/hub/src/launcher/manifest.ts:36-37`),
  gửi trong `init.seed`; Ghép Khối nối tiếp trạng thái RNG nằm trong save (`games/merge-block/src/stage.ts:44-45`).
- **Logic game thuần và có seed:** "a seed + list of moves replays exactly" (`games/merge-block/src/logic.ts:1-2`;
  ADR 0016 dòng 25).
- **Phòng nhiều người — kết quả do server quyết.** Luật chạy trong Jint trên API (ADR 0016); thống kê tính số ván,
  số lần nhất, tổng điểm; "tuần" là 7 ngày trượt; **có tính cả ván ngồi với bot** (`Modules/Rooms/RoomStats.cs:58-75`).

## Nghiên cứu ([R-03](../research/R-03-leaderboards.md))

- Không bao giờ tin điểm client báo cho bảng công khai. Server phải tính hoặc kiểm chứng từ những gì nó chứng kiến.
- Với game theo lượt/run, cách thực tế nhất là **seed do server cấp + chuỗi nước đi, server chạy lại** (Open Hexagon
  làm vậy). Kèm đồng hồ server, giới hạn hợp lý, rate limit, nhật ký để gỡ điểm gian lận.
- Không có cách bảo vệ phía client nào chặn được người quyết tâm, vì code client mở hoàn toàn.

## Ba chiều cần chọn

| Chiều | Lựa chọn |
|---|---|
| **Phạm vi** (ai lên bảng) | *Trong account* (hồ sơ của tôi — thay bảng household) · *Cộng đồng* (account vào bằng cùng mã cộng đồng — D-12) · *Toàn server* · *Bạn bè* (cần hệ thống bạn bè — sau) |
| **Chu kỳ** | *Tuần này* (tuần ISO, giờ Việt Nam, reset 00:00 thứ Hai) · *Mọi lúc*. Tuần cố định thay vì 7 ngày trượt: ai cũng hiểu "tuần này", người mới có cơ hội, dễ tính |
| **Độ tin** | *Đã xác minh* (kết quả phòng; run một người được server chạy lại — D-10) · *Tự báo* (điểm client như hôm nay) |

## Phương án

### A — Một loại bảng, nhận điểm tự báo, dựa vào kiểm duyệt
Rẻ. Bị gian lận ngay, và admin phải dọn mãi.

### B — Phân tầng theo độ tin (agent đề xuất)
- Bảng *toàn server* chỉ nhận kết quả **đã xác minh**. Bảng *cộng đồng* cũng vậy, trừ game chưa có replay: nhận kết quả
  `checked` kèm nhãn "chưa xác minh" (sửa 2026-10-18 theo D-16 Q4).
- Bảng *trong account* nhận mọi điểm (không ai có lý do gian lận với chính nhà mình).
- Game một người chưa hỗ trợ xác minh thì **chưa có bảng công khai**; vẫn có bảng trong account và kỷ lục cá nhân.

### C — Server chạy mọi nước đi trực tiếp, cho mọi game
Mạnh nhất nhưng đổi kiến trúc (độ trễ, tải server, mất chơi offline của ADR 0005). Không chọn.

## Đề xuất của agent: B, với các luật

- Hiển thị top 50 cộng "quanh tôi" (hạng của tôi ± 2).
- Hồ sơ có `on_public_boards = false` (mặc định với mẫu "Hồ sơ trẻ em" — D-01) không bao giờ lên bảng cộng đồng hay
  toàn server; vẫn lên bảng trong account.
- Hiện tên + avatar; bấm vào thì thẻ hồ sơ hiện ID (D-17); không bao giờ hiện email.
- Bằng điểm: ai đạt trước (theo giờ server) đứng trên.
- Admin gỡ được một dòng, ẩn một hồ sơ khỏi bảng, khoá account (D-07); báo cáo vi phạm làm sau (E-07).
- Lưu trong PostgreSQL: mỗi (bảng, chu kỳ, hồ sơ) một dòng giữ điểm tốt nhất; hạng = số dòng tốt hơn + 1 nhờ index.
  Không cần Redis ở quy mô này.
- **Thứ tự ra mắt:** (1) bảng trong account, đi cùng T2; (2) bảng tuần công khai cho phòng — đã đáng tin sẵn, theo luật
  D-11; (3) bảng cộng đồng khi có D-12; (4) bảng công khai cho từng game một người khi game đó có xác minh (D-10),
  Ghép Khối trước; (5) bạn bè làm sau.

Khi có D-10, "thử thách hôm nay" (mọi người chơi cùng một seed trong ngày, như `dailySeed()` đang làm) trở thành một
bảng công khai công bằng. Đó là khả năng mở ra, không phải yêu cầu của plan này.

## Câu hỏi cho owner (đã trả lời 2026-10-17)

- **Q1** Phạm vi v1: trong account + cộng đồng + toàn server (chỉ kết quả đã xác minh); bạn bè làm sau — *ổn*.
- **Q2** Game một người chưa có xác minh thì chưa có bảng công khai — *ổn* (D-16 Q4 hỏi thêm về bảng cộng đồng).
- **Q3** Chu kỳ "Tuần này" + "Mọi lúc" — *ổn*.

## Decision

**owner** (2026-10-17, chat): "còn lại ôn, nhất là phát hiện bảng xếp về uy tín rất tốt, chúng ta nên có 1 engine xịn
để giúp nó (cố hết sức th, chứ tinh thần mọi người cũng legit nha haha, tương lai enhance thêm từ đây)".

Đã chốt: phương án B với các luật và thứ tự ra mắt ở trên. Cách thực thi độ tin trở thành một engine dùng chung — D-16.

## Discussion

**owner** (2026-10-17, chat): "về hệ quả bảng xếp hạng đúng đau đầu ha, đầu tiên nhu cầu chính hiện tại là đa số sẽ
là user - user (1 user 1 account r) reseach giải pháp cho tôi".

**agent** (2026-10-17): chỗ đau thật không phải phạm vi mà là **niềm tin vào điểm**. Phòng chơi đã đáng tin sẵn (luật
chạy trên server). Game một người thì code đã thuần và có seed, nên có thể làm đáng tin bằng cách cho server chạy lại
— dùng chính hạ tầng Jint mà rooms đang dùng (D-10).
