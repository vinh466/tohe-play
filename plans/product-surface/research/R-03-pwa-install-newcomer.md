# R-03 — Người mới tới Tò He từ đâu, và cài PWA trên từng nền tảng

- Date: 2026-10-19 · Feeds: E-03, D-01, D-03

## Question

Một người chưa biết Tò He tới bằng đường nào (tìm kiếm, link trong Zalo/Messenger, QR, AI), trên thiết bị gì, và cần gì
để chơi được ngay rồi cài app lên màn hình chính — Android, iPhone, trình duyệt trong app chat, máy tính?

## Findings

### Thiết bị ở Việt Nam

- Android ≈ 60 %, iOS ≈ 40 % lưu lượng web di động (StatCounter, 5–7/2026,
  [gs.statcounter.com](https://gs.statcounter.com/os-market-share/mobile/viet-nam)). → iPhone không phải trường hợp phụ.

### Android (Chrome)

- Cài được khi: HTTPS, manifest có `name`/`short_name`, icon 192 và 512, `start_url`, `display` standalone; service
  worker; người dùng đã tương tác (chạm ít nhất một lần, khoảng 30 giây) và app chưa cài
  ([web.dev](https://web.dev/install-criteria/), [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable)).
- Khi đủ điều kiện, trình duyệt bắn `beforeinstallprompt`; trang giữ sự kiện lại và gọi `prompt()` từ nút của mình
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable)).
- Tò He hôm nay: đủ điều kiện kỹ thuật trên prod (manifest, service worker), nhưng **không xử lý `beforeinstallprompt`**
  → chỉ có menu ⋮ của Chrome.

### iPhone / iPad (Safari, iOS 26)

- Không có `beforeinstallprompt`. Người dùng phải tự làm: với giao diện tab "Compact" mặc định của Safari 26 là
  **⋯ → Chia sẻ → Thêm vào MH chính** (thêm một chạm so với trước)
  ([Glide community](https://community.glideapps.com/t/ios-26-add-to-home-screen-workflow-change/84599)).
- Từ iOS 26, mọi trang thêm vào màn hình chính **mở như web app theo mặc định**, có công tắc "Mở dưới dạng ứng dụng web"
  trong hộp thoại ([heise](https://heise.de/-10749652)).
- App trên màn hình chính có **storage riêng**, tách khỏi Safari. Lúc thêm vào, iOS chép cookie **một lần**; localStorage
  và IndexedDB không được chép ([WWDC23 notes](https://wwdcnotes.com/notes/wwdc23/10120)). → Với Tò He: account đã
  đăng nhập trong Safari (cookie phiên) đi theo vào app; **tiến độ của khách (IndexedDB) ở lại Safari**.
- Safari có thể xoá storage do script ghi sau 7 ngày dùng Safari mà không ghé trang; app trên màn hình chính có bộ đếm
  ngày riêng theo việc dùng app ([Search Engine Land](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519)).
  → Khách chơi trong tab Safari rồi bỏ một tuần có thể mất tiến độ.

### Trình duyệt trong app chat (Zalo, Messenger, Facebook)

- Link mở trong WebView của app; tính năng PWA (service worker, cài app) khác nhau nhiều giữa các WebView
  ([Google Research](https://research.google/pubs/pub46739/)).
- Zalo có tuỳ chọn mở link bằng trình duyệt: Cá nhân → Cài đặt → Quyền riêng tư → Tiện ích → "Mở bằng trình duyệt web"
  ([Thế Giới Di Động, 2023](https://www.thegioididong.com/tin-tuc/cach-mo-link-tren-zalo-bang-chrome-1548614)) — bài cũ,
  cần thử lại trên Zalo hiện tại.
- Với cộng đồng nhỏ ở Việt Nam, link đi qua Zalo và Messenger là đường chính → trang phải nhận ra mình đang trong WebView
  và chỉ cách mở bằng trình duyệt trước khi nói chuyện cài app.

### Xem trước link khi chia sẻ

- App chat dựng thẻ xem trước từ thẻ `og:` trong **HTML gốc** (không chạy JS); thiếu `og:title` thì lấy `<title>`; ảnh
  khuyến nghị 1200×630 ([opengraph.io](https://www.opengraph.io/link-preview-studio)). Cách riêng của Zalo chưa có tài
  liệu — thử bằng một link thật.
- Tò He hôm nay: HTML của hub không có thẻ `og:` nào → link bàn `/r/<code>` gửi qua Zalo chỉ hiện "Tò He".

### Hành trình hiện tại của người mới (code, `main` = `d685547`)

1. Mở `toheplay.io.vn` → `/` cần người chơi → chuyển `/welcome` (`RequireSession`).
2. `/welcome`: logo, "Bố mẹ đăng nhập một lần, các bé chỉ cần chọn hình của mình.", form email + mật khẩu, link đăng ký,
   nút mờ "Chơi thử không cần tài khoản" ở cuối (`WelcomePage.tsx`).
3. Chơi thử → danh mục với dải "khách" mời đăng ký (`CatalogPage.tsx`).
4. Link bàn `/r/<code>` khi chưa có account → `/register` (`JoinPage.tsx`): email, tên, mật khẩu, tuổi + điều khoản, chờ mã
   qua email, rồi mới ngồi vào bàn. Đăng ký "theo lời mời" thì còn cần mã cộng đồng.
5. Không có chỗ nào nói về cài app.

## Assumptions

- Thao tác iOS 26 lấy từ báo cáo cộng đồng và heise, chưa thử trên iPhone của owner.
- Mục cài đặt của Zalo lấy từ bài 2023.
- Thẻ xem trước của Zalo đọc `og:` như các app khác — chưa thử.

## So what

- **Khách chơi trước, tài khoản sau**: vision đã hứa "first game visible within a few seconds"; hôm nay người mới gặp form
  đăng nhập trước.
- Cài app phải là **ba lối khác nhau**: Android (nút gọi `prompt()`), iPhone (hướng dẫn có hình theo iOS 26), WebView của
  Zalo/Messenger (mở bằng trình duyệt trước). Máy tính: icon cài của Chrome/Edge là đủ.
- Trên iPhone, nhắc **đăng nhập/đăng ký trước khi cài** nếu khách đã có tiến độ — vì cookie theo vào app, IndexedDB thì không.
- Link bàn là vòng lan truyền chính (Tiến Lên) và đang là chỗ nhiều ma sát nhất → E-03 + D-03.
- Thẻ `og:` tĩnh trong HTML của hub + ảnh xem trước: rẻ, làm được ngay trong P1.

## Sources

- https://gs.statcounter.com/os-market-share/mobile/viet-nam
- https://web.dev/install-criteria/
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable
- https://community.glideapps.com/t/ios-26-add-to-home-screen-workflow-change/84599
- https://heise.de/-10749652
- https://wwdcnotes.com/notes/wwdc23/10120
- https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519
- https://research.google/pubs/pub46739/
- https://www.thegioididong.com/tin-tuc/cach-mo-link-tren-zalo-bang-chrome-1548614
- https://www.opengraph.io/link-preview-studio
