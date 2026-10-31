# Prototype — "Sạp" (concept)

**Đây là concept, không phải spec.** Mục đích là để nhìn và tranh luận về hướng đi, không phải để merge vào app.
Ảnh bìa là hình tạm vẽ bằng CSS/SVG; câu chữ là mẫu; không có dữ liệu thật, không có tương tác.

## Xem

Mở `home.html` hoặc `game.html` bằng trình duyệt (font self-host lấy từ `packages/design-tokens/fonts/`, nên mở bằng
`file://` vẫn đúng). Hoặc:

```sh
python3 -m http.server -d plans/surface-v2/prototype 8080
# http://localhost:8080/home.html
```

## Có gì

- `home.html` — sạp công khai: hero game, "Đang mở", "Chơi tiếp", "Mới tuần này", band "Rủ bạn", "Tất cả" + tag.
- `game.html` — trang store: cover, facts chip, ảnh chụp, cách chơi, trò khác, nút Chơi dính đáy trên mobile.
- `door.html` — cửa vào: "Chơi ngay" trước, "Đăng nhập" sau; máy đã chơi thấy "Chơi tiếp"; gợi ý "Giữ điểm này?"
  sau ván đầu, không chặn.
- `concept.css` — palette giấy/mực/đỏ gấc/nghệ/lá, viền mực, offset shadow, chữ Be Vietnam Pro.

## Điều đang thử

1. **Ảnh bìa thay icon**: mọi game là một cover 16:9, khung thống nhất.
2. **Card có "Chơi" rõ**, không chỉ "Rủ bạn".
3. **Home có nhịp**: hero + shelf + danh sách, không phải lưới phẳng hay landing page.
4. **Giọng 16+**: "Sạp hôm nay", "2048 nhưng có combo", "Rủ bạn qua một link"; không "cả nhà", "bé", "bố mẹ".
5. **Màu có chủ đích**: đỏ gấc cho hành động, nghệ cho mới, lá cho chơi cùng; không gradient, không glow.
6. **Đa thiết bị**: 2 cột mobile, 4–5 cột desktop; hero full-bleed; nút dính đáy ở trang game.

## Chưa có

- Dark mode (sẽ làm ở D-06).
- Dữ liệu thật, search/filter hoạt động, keyboard/focus, axe.
- Ảnh gameplay thật; đây là hình tạm.
- Màn gia đình, tài khoản, chơi cùng; mới có mặt tiền.
