# R-02 — Tiền lệ: bề mặt game cho người 16+

- Date: 2026-10-31 · Feeds: D-02…D-05, R-03
- Cách xem: Playwright 1.64, 1440×900 và 390×844, `en-US`, chưa đăng nhập, chỉ đọc trang công khai; ảnh lưu ngoài repo.
- Tiếp nối [R-12](../../launch-review/research/R-12-peers-front-door-and-first-run.md) (trang chủ và lần đầu, 2026-10-24);
  lần này xem **bên trong**: catalog, thẻ game, trang game, shell chơi.

## Câu hỏi

Những sản phẩm mà người 16+ đã quen đang làm bề mặt **chọn game** và **trang game** thế nào, và cái nào đáng học cho một
sạp chỉ có 5–10 game?

## Những gì đã xem

| Sản phẩm | Trang | Điều đáng chú ý |
|---|---|---|
| Poki | `/`, `/en/g/subway-surfers` | Lưới mosaic ảnh bìa; game page mở game ngay trên trang, không có bài giới thiệu |
| CrazyGames | `/`, `/g/1v1-lol` | Lần đầu hỏi thể loại (có nút bỏ qua); home chia shelf; game page có "Play next" bên phải |
| Coolmath Games | `/`, `/0-run-3` | Home editorial: "New This Week", "What We're Playing", Top 10; game page mở game + thanh thông tin |
| itch.io | `/games/free`, một game page | Bộ lọc/tag/sort rất dày; game page là trang store: ảnh lớn, mô tả, ảnh chụp |
| Miniblox | `/` | Card chế độ chơi có ảnh bìa + số người chơi; sidebar tài khoản + top người chơi; bottom nav 5 mục |
| Y8 | `/` | Hàng thể loại: một ảnh bìa lớn + 5 ảnh nhỏ; category là đơn vị chính |
| Duolingo, Chess.com | `/` | Đã ghi ở R-12: hero có hai nút, section giá trị, không phải lưới game |

## Mẫu chung của bề mặt "chơi được"

### 1. Ảnh bìa là đơn vị thông tin, không phải icon

- Poki, CrazyGames, Coolmath, Miniblox, Y8: mỗi game là một **ảnh 16:9 hoặc 1:1 có nội dung game**, thường có chữ tên game
  ở trong ảnh hoặc ngay dưới.
- Ảnh bìa làm ba việc: cho biết game là gì, tạo cảm giác chất lượng, và làm lưới trông dày mà không cần chữ.
- Poki có hướng dẫn riêng cho ảnh bìa: "một vật rõ ở tiền cảnh, bỏ chữ" (R-07 đã dẫn). Ảnh bìa của Tò He hiện là **icon
  vuông**, không phải ảnh bìa.

### 2. Mật độ vừa phải, nhưng phải có nhịp

- Poki: mosaic không đều, ô lớn ô nhỏ, cuộn là thấy game mới.
- CrazyGames: shelf ngang + lưới; home có "Top games in … today", "Featured", "Halloween Games".
- Coolmath: **danh sách editorial** (ảnh nhỏ + tên + một dòng mô tả) bên cạnh lưới Top 10 — rất hợp với ít game.
- Miniblox: card chế độ chơi lớn, có số người chơi; shelf "Game cộng đồng", "Đang thịnh hành".
- **Bài học cho Tò He:** với 5 game, đừng làm lưới 5 ô to. Làm **một game chủ đạo + shelf 3–5 game + danh sách editorial**
  để mắt có nhịp và trang không trống.

### 3. Tìm kiếm và thể loại xuất hiện ngay

- Poki: icon tìm kiếm + icon người dùng ở góc; không có menu thể loại lớn trên mobile.
- CrazyGames: ô search ở giữa top bar; rail thể loại bên trái trên desktop, rail icon trên mobile.
- Coolmath: menu thể loại trên top bar (Strategy, Skill, Numbers, Logic, Classic, Trivia, Categories, All Games) + search.
- itch.io: filter panel bên trái (platform, price, genre, input, multiplayer…), sort, tag.
- Miniblox: bottom nav 5 mục; không có search rõ trên mobile.
- **Bài học:** người 16+ không muốn cuộn hết để tìm; search và 3–5 tag đủ dùng. Với 5 game, search có thể là
  "lọc nhanh" thay vì full-text.

### 4. Trang game mở game, không mở bài giới thiệu

- Poki: game page = game chạy ngay trên trang, top bar mỏng, thanh thông tin game ở dưới, shelf game khác bên dưới.
- CrazyGames: game page = khung game lớn, thanh tiêu đề + "Invite friends" + like + comment + fullscreen, "Play next" bên
  phải; phần mô tả ở dưới.
- Coolmath: game page = khung game, breadcrumb, thanh "Skip ads", XP; mô tả/ảnh ở dưới.
- itch.io: game page = **trang store** (ảnh bìa lớn, mô tả, ảnh chụp, tag, tác giả) vì game tải về; với game web vẫn có
  nút "Play in browser".
- **Bài học:** Tò He có lợi thế vì `/play/<id>` đã mở game ngay; nhưng `/games/<id>/` (trang công khai) lại là bài viết.
  Nên biến `/games/<id>/` thành **trang store có ảnh + nút Chơi + ảnh chụp**, và giữ `/play/<id>` là nơi chơi.

### 5. Cá nhân hoá là tuỳ chọn, không phải cửa

- CrazyGames lần đầu hỏi "What do you love playing?" với 5 thể loại, có nút "Don't personalize anything"; sau đó home
  chia shelf theo lựa chọn.
- Poki không hỏi; home là mosaic chung; cá nhân hoá đến từ lịch sử.
- **Bài học:** có thể hỏi 3–5 tag **sau khi chơi game đầu** hoặc trong lần quay lại, không chặn lần đầu. Với 5 game, không
  cần onboarding thể loại; chỉ cần "Chơi tiếp" và "Gần đây".

### 6. Số liệu xã hội tạo cảm giác sống

- Miniblox: số người chơi trên mỗi card ("1.3M", "670k"), top người chơi, "Đang thịnh hành".
- CrazyGames: số like, bình luận, "573K"; "Invite friends".
- Poki: số like/share, "18.3M".
- **Bài học:** Tò He không cần số ảo; có thể dùng số thật nhỏ ("12 người đang chơi", "3 bàn đang mở") hoặc bỏ hẳn. Đừng
  bịa số.

### 7. Shell chơi tối giản

- Poki: top bar mỏng, game full-width, ít chrome; trên mobile, logo + search + icon, game ở dưới.
- CrazyGames: top bar + rail icon; game page gần full-screen.
- Miniblox: bottom nav vẫn hiện khi ở ngoài game; trong game chắc chắn ẩn.
- **Bài học:** shell chơi của Tò He (game tự vẽ menu, "Về Tò He") đã tốt; chỉ cần **ẩn thanh tab** và **giữ một nút thoát
  rõ**; không thêm chrome.

## Cái không nên copy

| Cái | Vì sao |
|---|---|
| Quảng cáo dày, "Skip ads", "Go Premium" | Tò He bán điểm "không quảng cáo"; đừng phá |
| Lưới mosaic cực dày của Poki | Cần hàng trăm game; với 5 game sẽ loãng và trông nghèo |
| Onboarding thể loại chặn lần đầu | Người 16+ muốn chơi ngay; chỉ hỏi sau |
| Màu neon/tím, gradient, dark cyber | Đối lập với chất "tò he"; dễ thành generic game portal |
| Số liệu giả, badge "HOT", "NEW" nhấp nháy | Mất tin; Tò He có thể dùng "Mới" thật, có ngày |
| Chat công khai, kết bạn không kiểm duyệt | Ngoài phạm vi; rủi ro an toàn |

## So what cho Tò He

1. **Ảnh bìa + ảnh chụp là điều kiện tiên quyết**, không phải trang trí. Nếu chưa có, làm một bộ cover tạm từ ảnh gameplay
   (chụp màn hình game, crop 16:9, thêm tên game) trước khi thuê vẽ.
2. **Home nên là "sạp" chứ không phải lưới phẳng**: 1 game chủ đạo (hero), 1 shelf "Chơi tiếp", 1 shelf "Mới", 1 shelf
   "Chơi cùng bạn", 1 danh sách "Tất cả" có tag. Với 5 game, shelf có thể chỉ 2–3 ô, nhưng phải có nhịp.
3. **Search/filter tối giản**: một ô "Tìm game" + 4 tag (Giải đố, Bài, Phản xạ, Chơi cùng). Không cần full-text index.
4. **Trang game công khai = store page**: ảnh bìa lớn, nút Chơi, 3 ảnh chụp/clip, facts dạng chip, cách chơi, game khác.
5. **Chơi cùng là điểm khác biệt**: đặt "Tạo bàn" / "Nhập mã" ngang hàng với "Chơi", không giấu trong tab thứ hai.
6. **Không hỏi đăng nhập trước**: "Chơi ngay" là nút chính; đăng nhập là lựa chọn sau khi chơi hoặc khi vào bàn.

## Giả định

- Các trang có thể đổi sau 2026-10-31; chỉ dùng làm mẫu, không phải spec.
- Chưa đo được tỉ lệ chuyển đổi của từng mẫu; không có A/B test.
- Một số trang chặn đăng nhập/geo (CrazyGames game 1v1.LOL hiện "not available"); chỉ đọc được khung.

## Nguồn

- [poki.com](https://poki.com/) · [poki.com/en/g/subway-surfers](https://poki.com/en/g/subway-surfers)
- [crazygames.com](https://www.crazygames.com/) · [crazygames.com/game/1v1-lol](https://www.crazygames.com/game/1v1-lol)
- [coolmathgames.com](https://www.coolmathgames.com/) · [coolmathgames.com/0-run-3](https://www.coolmathgames.com/0-run-3)
- [itch.io/games/free](https://itch.io/games/free)
- [miniblox.io](https://miniblox.io/)
- [y8.com](https://www.y8.com/)
- Ảnh chụp 2026-10-31, lưu ngoài repo.
