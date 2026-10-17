# R-03 — Bảng xếp hạng công khai: tin điểm thế nào, xếp hạng phòng nhiều người ra sao

- Date: 2026-10-17 · Feeds: D-09, D-10, D-11

## Câu hỏi

Khi người chơi là người lạ với nhau, làm sao để bảng xếp hạng công khai không bị gian lận, và xếp hạng thế nào cho
game bài 4 người?

## Phát hiện — chống gian lận

- Nguyên tắc chung của các bài viết: điểm client gửi lên chỉ là *lời khai*; server phải tính hoặc kiểm chứng điểm từ
  những gì nó chứng kiến.
- Với game theo run: gửi **seed + chuỗi input**, server mô phỏng lại; chỉ nhận điểm khi mô phỏng ra đúng điểm đó.
  Open Hexagon làm vậy: replay chứa chuỗi input, seed và thông tin màn; sửa phần ảnh hưởng tới game thì server từ
  chối; server bắt đầu đếm giờ theo đồng hồ của chính nó nên không giả được thời gian chơi. Chính tác giả nói cách này
  chưa hoàn hảo.
- Cách rẻ hơn: giới hạn giá trị hợp lý, rate limit, so điểm với thời lượng và sự kiện của run, nộp điểm gắn với phiên;
  giữ nhật ký để gỡ điểm gian lận và xử lý người chơi.
- Mọi bảo vệ phía client (làm rối code, mã hoá, kiểm toàn vẹn) đều thua người quyết tâm, vì code client mở hoàn toàn.
- Replay tốn CPU mỗi lần nộp, nên thường chỉ xác minh các điểm lọt top.
- Rủi ro: mô phỏng phải cho kết quả giống hệt nhau giữa các máy — số thực và khác biệt engine có thể phá điều này.

## Phát hiện — hạng cho phòng nhiều người

- **OpenSkill** (Weng-Lin): hệ rating nhiều đội, nhiều người, giấy phép mở, dùng thay TrueSkill. Có năm mô hình;
  bài báo khuyên **Plackett-Luce** cho đa số trường hợp. Bài JOSS đo nhanh khoảng 3 lần bản Python mã nguồn mở của
  TrueSkill. Trên dữ liệu Overwatch, độ chính xác dự đoán gần TrueSkill (TrueSkill nhỉnh hơn: 92,44% so với 87,56% ở
  tập người chơi có từ 2 trận). Gói Ruby là MIT, bản Java là Apache 2.0; giấy phép của bản Python chưa đọc tận nơi.

## Phát hiện — Tò He hôm nay (từ code)

- Điểm game một người do client báo, server không kiểm (`services/api/src/Tohe.Api/Modules/Progress/ProgressModule.cs:124-178`).
- Seed do hub tính theo ngày (`apps/hub/src/launcher/manifest.ts:36-37`); Ghép Khối nối tiếp RNG từ save.
- Logic game thuần, có seed, replay được (`games/merge-block/src/logic.ts:1-2`).
- API đã chạy module luật của game trong Jint, có giới hạn, khoảng 0,3 ms mỗi nước (ADR 0016); replay ván đã xong bằng
  chính module đó (ADR 0017).
- Thống kê phòng tính cả ván với bot (`Modules/Rooms/RoomStats.cs:58-75`).

## Giả định

- Logic các game hiện có là tất định khi chạy trong Jint — chưa kiểm cho game một người (rooms đã kiểm cho Tiến Lên).
  Conformance của D-10 sẽ là chỗ kiểm.
- Số liệu "bắt được 90% người gian lận" của một bài viết không có nguồn — không dùng.

## Ý nghĩa

- D-09: phân tầng theo độ tin; bảng công khai chỉ nhận kết quả đã xác minh.
- D-10: Tò He đã có sẵn hai thứ khó nhất của cách "seed + replay" (logic thuần có seed, và Jint trên server); phần còn
  thiếu là seed do server cấp và kênh gửi nước đi.
- D-11: kết quả phòng đã đáng tin; chỉ cần loại ván cày với bot; rating OpenSkill để sau.

## Nguồn

- [Gigazine: Open Hexagon chống gửi điểm gian](https://gigazine.net/gsc_news/en/20211110-open-hexagon-against-cheet)
- [Bugnet: leaderboard nhận mọi điểm client gửi](https://bugnet.io/blog/how-to-fix-leaderboard-accepting-any-score-the-client-posts) · [Bugnet: chặn điểm gian](https://bugnet.io/blog/how-to-stop-cheated-scores-on-your-leaderboards)
- [Supercraft: public leaderboard sẽ bị gian lận (2026)](https://crux.supercraft.host/blog/leaderboard-cheating-public-leaderboard-server-validation-2026/)
- [OpenSkill — JOSS](https://joss.theoj.org/papers/10.21105/joss.05901.pdf) · [arXiv 2401.05451](https://arxiv.org/html/2401.05451v1) · [PyPI openskill](https://pypi.org/project/openskill/)
