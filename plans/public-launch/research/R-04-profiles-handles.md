# R-04 — Nhiều hồ sơ dưới một account, và tên duy nhất cho người chơi

- Date: 2026-10-17 · Feeds: D-01, D-05

## Câu hỏi

Các sản phẩm lớn làm thế nào khi (a) một lần đăng nhập phục vụ nhiều người dùng trong nhà, và (b) người dùng cần một
tên duy nhất để tìm và mời nhau?

## Phát hiện

**Netflix — nhiều hồ sơ dưới một account:**
- Khoá hồ sơ bằng PIN 4 số: vào trang Account, chọn hồ sơ, **nhập mật khẩu account**, rồi bật "Require a PIN".
- Có tuỳ chọn bắt PIN khi thêm hồ sơ mới, để trẻ em không tự thêm hồ sơ.
- Giới hạn độ tuổi đặt theo từng hồ sơ; chặn được từng nội dung trong một hồ sơ.
- Số hồ sơ tối đa: không tìm được nguồn đáng tin trong lần tìm này.

**Discord — tách handle khỏi tên hiển thị (đổi năm 2023):**
- Bỏ kiểu `Tên#1234`, vì khó nhớ và khó chia sẻ.
- Username (handle) mới: duy nhất; chỉ `a–z`, `0–9`, `_`, `.`; dài 2–32; không phân biệt hoa thường, ép chữ thường;
  không có hai dấu chấm liền nhau.
- Tên hiển thị: không cần duy nhất; được có khoảng trắng, emoji, chữ không phải Latin; là cách người dùng hiện ra chủ
  yếu. Discord gọi handle là "a technical necessity", dùng để kết bạn và phân biệt người dùng.

**Tò He hôm nay:** hồ sơ đã là người chơi (save, điểm, ghế trong phòng gắn `ProfileId`); tên hồ sơ là chữ tự do;
parent gate = nhập lại mật khẩu, mở khoá 10 phút (xem D-01 *Hiện trạng*).

## Giả định

- Hướng dẫn Netflix đến từ các trang bên thứ ba và đã đổi qua các năm; chỉ mượn *mẫu hình* (mật khẩu để đặt PIN, PIN
  để dùng hằng ngày), không mượn chi tiết.
- Bên thứ ba nói Discord không giới hạn số lần đổi username — chưa kiểm; Tò He tự chọn giới hạn 30 ngày (D-01).

## Ý nghĩa

- D-01: nhiều hồ sơ dưới một account là mẫu hình quen thuộc; handle duy nhất + tên hiển thị tự do là cách Discord chọn
  sau khi thử cách khác. Tên tiếng Việt có dấu nằm ở tên hiển thị; handle là ASCII.
- D-05: "mật khẩu (xác thực thật) để đặt PIN, PIN để dùng hằng ngày" là đúng hai mức đề xuất.

## Nguồn

- [Discord: Usernames (blog)](https://discord.com/blog/usernames) · [Discord Support: New Usernames & Display Names](https://support.discord.com/hc/articles/12620128861463)
- [Gigazine: Discord username system changed](https://gigazine.net/gsc_news/en/20230508-discord-usernames-change)
- [Netflix parental controls guide (Mobicip)](https://app.mobicip.com/blog/netflix-parental-controls-guide) · [FOSI: Netflix parental controls checklist](https://fosi.org/wp-content/uploads/2025/03/639b7f5ed72b5188df49f778_Netflix-ParentalControls_checklist.pdf) · [Netflix profile lock PIN (soyacincau)](https://www.soyacincau.com/2020/04/08/you-can-now-lock-your-netflix-profile-with-a-pin)
