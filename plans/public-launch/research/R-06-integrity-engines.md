# R-06 — Engine độ tin: các nền tảng giữ bảng xếp hạng và kết quả đáng tin thế nào

- Date: 2026-10-17 · Feeds: D-16, D-10, D-11, D-07 (hàng đợi xem xét)

## Câu hỏi

Owner muốn "1 engine xịn" cho độ tin của bảng xếp hạng — "cố hết sức thôi, chứ tinh thần mọi người cũng legit". Các
nền tảng đã làm gì, và rút ra được những nguyên tắc nào cho một engine vừa mạnh vừa không làm oan người chơi thật?

## Phát hiện

| Nền tảng | Cơ chế | Bài học |
|---|---|---|
| **Steam** (Steamworks) | Bảng có thể đặt *Writes: Trusted*: client không ghi được điểm, chỉ server có publisher token gọi Web API `SetLeaderboardScore`. Bảng không trusted thì ai cũng ghi được mọi điểm; cách giữ điểm (KeepBest, ForceUpdate) chỉ chọn điểm nào được giữ, không kiểm điểm có hợp lệ không | Tách hẳn "nguồn tin được" (server) khỏi "nguồn tự khai" (client) |
| **Google Play Games** (2014) | *Leaderboard tamper protection*: tự **ẩn** điểm bị nghi sửa khỏi bảng; bật mặc định cho bảng mới; điểm cũ dọn bằng Management API | Nghi ngờ thì ẩn, không xoá; bật sẵn mặc định |
| **Lichess** | Hai hệ thống máy học: *Irwin* tìm lối chơi giống engine cờ, *Kaladin* tìm lối chơi không khớp hồ sơ của chính người đó. Thường xử lý **âm thầm** (đưa vào nhóm chơi riêng) để kẻ gian không biết mình bị bắt; có kháng nghị. US Chess đánh giá tham số của họ **bảo thủ, giúp tránh bắt nhầm** | Hai loại tín hiệu: "không giống người" và "không giống chính bạn"; ưu tiên tránh bắt nhầm |
| **Trackmania** | Server có kiểm tra "coherence" replay mặc định. Cộng đồng chỉ ra replay không bắt được kiểu **làm chậm thời gian**; điều tra năm 2022 phải dùng phân tích input (đánh lái giật bất thường). Một công cụ quét mới từng **xoá nhầm kỷ lục thật** | Replay chứng minh nước đi hợp lệ, không chứng minh người thật chơi; xử lý tự động phải đảo ngược được |
| **Open Hexagon** ([R-03](R-03-leaderboards.md)) | Replay = chuỗi input + seed + thông tin màn; server mô phỏng lại; server tự đếm giờ | Seed và đồng hồ phải thuộc server |

## Giả định

- Chi tiết tamper protection của Google lấy từ thông báo năm 2014; không rõ hôm nay còn như vậy và họ phát hiện bằng
  gì. Chỉ mượn nguyên tắc "ẩn khi nghi".
- Nguồn về Trackmania là cộng đồng, không phải tài liệu chính thức của Nadeo.
- Con số "1–2% bắt nhầm" ở Lichess đến từ một bài forum và bị moderator phản bác — không dùng.

## Ý nghĩa — nguyên tắc cho engine của Tò He (D-16)

1. **Mức tin đi theo bằng chứng, không theo người:** kết quả server tự quyết (phòng) hoặc tự chạy lại được (run có
   seed của server) là *đã xác minh*; điểm client tự khai mãi mãi chỉ là *tự báo*, dù người chơi uy tín đến đâu.
2. **Tự động chỉ được ẩn, không được phạt:** chỉ có bằng chứng cứng (replay ra điểm khác, vượt giới hạn không thể) mới
   bị *từ chối* tự động; mọi nghi ngờ khác là *chờ xem xét* — ẩn khỏi bảng công khai, chờ admin (Google Play, Lichess).
3. **Mọi quyết định đều đảo ngược được và có nhật ký**, ghi phiên bản luật đã dùng (bài học xoá nhầm của Trackmania).
4. **Hai loại tín hiệu:** "không giống người" (tốc độ, thời lượng theo giờ server) và "không giống chính bạn" (nhảy vọt
   so với lịch sử của hồ sơ) — kiểu Irwin/Kaladin, nhưng bằng luật đơn giản trước, máy học là chuyện xa.
5. **Bảo thủ, vì người chơi phần lớn là thật** — đúng tinh thần owner: thà để lọt một điểm lạ chờ xem xét còn hơn
   chặn oan người thật.

## Nguồn

- [Steamworks: Leaderboards](https://partner.steamgames.com/doc/features/leaderboards) · [Steamworks: Leaderboards guide](https://partner.steamgames.com/doc/features/leaderboards/guide) · [Heathen KB: Steam leaderboards](https://kb.heathen.group/steam/features/leaderboards)
- [Android Developers Blog (2014-12): Play Games Services — leaderboard tamper protection](https://android-developers.googleblog.com/2014/12/google-play-game-services-ends-year.html?m=0)
- [Wikipedia: Cheating in online chess](https://en.wikipedia.org/wiki/Cheating_in_online_chess) · [Lichess: Fair play](https://lichess.org/page/fair-play) · [US Chess endorses Lichess fair play methodology](https://new.uschess.org/news/us-chess-endorses-lichess-fair-play-methodology)
- [Docker Hub: evoesports/trackmania (TM_SYSTEM_DISABLE_COHERENCE_CHECKS)](https://hub.docker.com/r/evoesports/trackmania) · [Tildes: biggest cheating scandal in Trackmania history](https://tildes.net/~games/x1x/the_biggest_cheating_scandal_in_trackmania_history) · [Devtracker: false positive runs wiped out](https://devtrackers.gg/trackmania/p/b1c5ba74-false-positive-runs-wiped-out)
