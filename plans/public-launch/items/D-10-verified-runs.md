# D-10 — Điểm đã xác minh cho game một người: server cấp seed và chạy lại nước đi?

- Status: **proposed**
- Kind: decision — **đổi Game Contract** (ADR + docs + conformance trong cùng PR)
- Blocks: bảng công khai cho game một người (D-09 bước 4) · Blocked by: D-09
- Decided: —

## Vì sao cần chốt

Theo D-09, game một người chỉ có bảng công khai khi điểm được xác minh. Đây là cách làm điều đó mà không đổi kiến trúc
"game chạy trên máy, server không chạy từng nước".

## Hiện trạng

- Logic game thuần, có seed, chạy lại được: `games/merge-block/src/logic.ts:1-2`; quy ước cho mọi game (ADR 0012,
  ADR 0016 dòng 25; skill `/new-game`: logic thuần + bot chơi ngẫu nhiên).
- API đã chạy module luật của game trong **Jint** từ build bất biến của game, có giới hạn thời gian và bộ nhớ, khoảng
  0,3 ms mỗi nước (ADR 0016 dòng 40-41 và 64). Replay một ván đã xong dùng chính module luật đó (ADR 0017).
- Seed hôm nay do hub tính (`dailySeed()`), và save giữ trạng thái RNG — thiết bị kiểm soát cả hai.

## Phương án

### A — Run tính hạng: server cấp seed, game ghi nước đi, server chạy lại (agent đề xuất)

1. Hub xin mở một run tính hạng: `POST /api/runs {game, version}` → server tạo run với **seed ngẫu nhiên của server**
   và giờ bắt đầu theo đồng hồ server. Game nhận `init.run = {id, seed}`.
2. Game chơi bằng seed đó (logic như hôm nay) và ghi lại nước đi (Ghép Khối: mỗi nước là một cột thả — vài byte).
3. Khi run kết thúc, hub gửi nước đi lên `POST /api/runs/{id}/moves`.
4. Server nạp **module xác minh** của game (JS thuần build từ chính logic của game, nằm trong build bất biến — cùng
   mô hình với `rules.js`), chạy `replay(seed, moves)` trong Jint có giới hạn → ra điểm. Khớp thì đánh dấu
   *đã xác minh* và đưa lên bảng công khai; không khớp thì từ chối và ghi cờ cho admin.
5. Luật hợp lý: thời gian giữa bắt đầu và kết thúc (giờ server) không ngắn hơn mức tối thiểu cho số nước đó; mỗi hồ sơ
   chỉ có một run tính hạng đang mở cho mỗi game; có rate limit.
6. Chi phí: run 2.000 nước ≈ 0,6 s CPU. Xác minh trong hàng đợi nền, và chỉ cho run đủ điểm vào top của một bảng công
   khai.

Thay đổi contract: game khai báo khả năng `ranked` trong `game.json`; `init.run`; một kênh gửi nước đi; conformance
cho một bot chơi một run rồi kiểm tra module xác minh ra đúng điểm đó. Mỗi game: thêm ghi nước đi + entry xác minh.

Ràng buộc:
- Run tính hạng **cần mạng lúc bắt đầu** (để lấy seed). Chơi offline vẫn chạy như nay nhưng không tính hạng —
  ADR 0005 giữ nguyên.
- Run dài nhiều ngày (ADR 0014) chỉ lên bảng công khai khi đã kết thúc và đã xác minh; lúc đang chơi vẫn hiện "đang
  chơi" ở bảng trong account như hôm nay.

### B — Chỉ kiểm tra hợp lý (giới hạn điểm, tốc độ tăng điểm)
Rẻ, không đổi contract, nhưng chỉ chặn được gian lận vụng; điểm "vừa đủ cao" vẫn lọt.

### C — Ký điểm ở client
Vô ích: code client mở, khoá ký nằm ngay trong client.

## Đề xuất của agent

**A**, nhưng **không chặn ngày ra mắt**: ra mắt với bảng phòng chơi (đã đáng tin) và bảng trong account/cộng đồng;
A đến từng game một sau đó, Ghép Khối trước. Chi phí thật nằm ở thay đổi contract và conformance, không ở server.

## Câu hỏi cho owner

- **Q1** Đồng ý hướng A, và để nó sau ngày ra mắt?

## Decision

—

## Discussion

**agent** (2026-10-17): tái dùng đúng hạ tầng Jint của rooms, nên rủi ro kỹ thuật thấp. Cần kiểm chứng: logic của
từng game có thật sự tất định khi chạy trong Jint (số thực, thứ tự duyệt) — conformance sẽ bắt được nếu không.
