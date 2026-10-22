# R-08 — App đã cài và lúc quay lại: đã thoải mái chưa?

- Ngày: 2026-10-23 · Làm bởi: scout (Opus · high) + master (khảo sát prod, [R-09](R-09-survey-2026-10-23.md)) ·
  Phục vụ: [E-07](../items/E-07-installed-app-and-return.md)
- Owner 2026-10-23: "đánh giá lại luồng khi người chơi quay lại và PWA có thoải mái cho user chưa"

Nhãn: **[S]** có nguồn · **[P]** master thấy trên prod · **[R]** đọc từ code · **[O]** ý kiến.

## 1. Nền tảng làm gì

**iOS / iPadOS 26 (Safari)**

- [S] Mọi trang thêm vào màn hình chính mặc định mở như web app (có công tắc "Open as Web App"); manifest không bắt
  buộc, icon của nó vẫn được dùng. ([WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/))
- [S] Không có `beforeinstallprompt`: cài là các bước tay. Không có shortcuts của manifest.
  ([caniuse bip](https://caniuse.com/mdn-api_window_beforeinstallprompt_event), [caniuse shortcuts](https://caniuse.com/mdn-manifests_webapp_shortcuts))
- [S] App đã cài có kho riêng; chỉ cookie được chép từ Safari, một lần, lúc thêm.
  ([WWDC23 notes](https://wwdcnotes.com/documentation/wwdc23-10120-whats-new-in-web-apps/))
- [S] Giới hạn 7 ngày tính theo ngày *dùng app đã cài*: nhà nào mở ít nhất mỗi tuần thì không bị xoá; `persist()` được
  ưu tiên cho web app trên màn hình chính. ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/))
- [S, nguồn cũ] Vuốt từ mép trái để lùi có trong standalone từ iOS 12.2 ([firt.dev](https://firt.dev/ios-12.2/)) — cần
  thử lại trên iOS 26.
- [S] iOS 26.1 bỏ `theme-color`: thanh của Safari lấy màu nền body, hoặc màu của phần tử fixed đang hiện — thanh dưới
  của Tò He sẽ nhuộm "cằm" Safari. ([Ben Frain](https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/))
- [S, nguồn cũ] Màn khởi động của iOS cần `apple-touch-startup-image` đúng từng cỡ máy; thiếu thì trắng tới lần vẽ đầu.

**Android 15/16 (Chrome, Samsung Internet)**

- [S] `beforeinstallprompt` có ở Chrome và Samsung Internet ≥ 8.2; shortcuts có ở Chrome (WebAPK) và Samsung ≥ 14.
- [S] Chrome bật kéo-để-tải-lại trong app standalone; `overscroll-behavior-y` tắt được.
  ([web.dev app design](https://web.dev/learn/pwa/app-design))
- [S] Splash lấy `background_color` của manifest; bản tối (`color_scheme_dark`) còn là PR của spec (04/2026) → máy
  để chế độ tối vẫn thấy splash sáng.
- [S] Chỉ tắt chọn chữ trên phần tử giao diện, không trên nội dung. ([web.dev](https://web.dev/learn/pwa/app-design))

**Quay lại, trẻ em**

- [S] ICO Children's Code (chuẩn 13): với 0–9 tuổi, đẩy về hướng nghỉ ngơi, có công cụ dừng và lưu; streak bị nêu là
  vòng thưởng. ([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/))
- [S] Apple 1.3 Kids: link ra ngoài, mua bán chỉ sau cổng phụ huynh — PIN của Tò He khớp.
- [S] NN/g: tải < 1 s không cần chỉ báo; skeleton hợp với tải cả trang. ([NN/g](https://nngroup.com/articles/skeleton-screens/))
- Không tìm thấy số liệu đáng tin 2024–26 về tỉ lệ cài PWA hay lý do gỡ.

## 2. Tò He hôm nay

**Đã tốt [P/R]:** *Chơi tiếp* và *Gần đây* hiện sau khi chơi; "Ai đang chơi?" một chạm sau 30 phút; cập nhật không cắt
ngang ván; mở lạnh có service worker 0,53 s tới ô game đầu; khung ba tab; PIN trước link ra ngoài trong app.

**Chưa tốt — xếp theo mức ảnh hưởng** (PR đang sửa: F1, F2 — xem PLAN.md)

| # | Mức | Chuyện | Sửa ở |
|---|---|---|---|
| 1 | blocker | Xoay ngang điện thoại: menu của game dọc (Ghép Khối) bị cắt nút Chơi, mất Âm thanh/Cài đặt/Về Tò He; danh mục chỉ thấy hàng đầu [P]. Hệ quả của việc bỏ khoá màn dọc (ADR 0046) | F2 |
| 2 | blocker | Sảnh phòng `/play/<id>/rooms` với khách: form đặt tên, không khung, không nút lùi → kẹt trên iPhone đã cài [P] | F1 |
| 3 | blocker | Mất mạng: game chưa mở lần nào đứng "Đang tải…" mãi [P] | F1 |
| 4 | major | "Chơi trên máy này" ở màn đăng nhập dẫn tới `/` — app không có route này → Not Found [R] | F1 |
| 5 | major | Mạng yếu: `/api/auth/me` không timeout, `#root` rỗng → chỉ thấy "Đang tải…" [R]; mở lạnh không cache 1,9 s [P] | F2 |
| 6 | major | Nhấn giữ ô game bật menu "Mở / Lưu ảnh" của hệ điều hành; kéo xuống tải lại app [R] | F1 |
| 7 | major | Splash và thanh trạng thái chưa theo chế độ tối; không có ảnh khởi động iOS [R] | F1 (theme-color), E-07 |
| 8 | major | Màn con trong khung (`/account/profiles`, đăng nhập, đăng ký) không có ← — trên iPhone không có nút lùi hệ thống [P] | F1 |
| 9 | major | "Có bản mới — Tải lại" hiện ngay lần mở đầu sau mỗi deploy; "Để sau" chỉ là ✕ [R/O] | E-07 (Q2) |
| 10 | minor | Icon trong suốt ở góc (iOS tô đen), maskable dùng chung file [R] | F2 |
| 11 | minor | Shortcuts chỉ "Ghép Khối" [R] | F2 |
| 12 | minor | Dải "đang mất mạng" chỉ đọc `navigator.onLine` một lần [R] | F1 |
| 13 | minor | Hướng dẫn cài iOS chỉ đúng bố cục thanh dưới của iPhone [R] | F2 |
| 14 | minor | Tên khách không khớp avatar [P] | F1 |

## 3. Danh sách thử trên máy thật (owner: một Android, một iPhone)

1. Cài: Android qua lời mời của Chrome (thử cả Samsung Internet); iPhone qua Safari → Chia sẻ → Thêm vào MH chính, bật
   "Mở dưới dạng ứng dụng web". Góc icon có sạch không?
2. Mở lạnh ở chế độ sáng và tối: màu splash, thanh trạng thái, có chớp trắng hay màn trống?
3. Xoay ngang ở danh mục, ở menu Ghép Khối và trong ván: bấm được mọi nút không?
4. Nhấn giữ một ô game và ô *Chơi tiếp*: có menu hay xem trước bật lên không?
5. Kéo xuống ở danh mục và trong game: có tải lại không?
6. iPhone: vuốt từ mép trái ở game, bàn chơi, `/account/profiles`, đăng nhập — lúc nào cũng về được Trò chơi?
7. Chế độ máy bay: mở app, mở một game đã chơi, rồi một game chưa chơi.
8. Mạng yếu: bao lâu thì thấy ô game đầu?
9. Để app 30 phút trên máy có 2 hồ sơ trở lên rồi mở lại: "Ai đang chơi?" một chạm?
10. Sau một lần deploy: mở app — "Có bản mới" hiện ngay không? "Tải lại" có mất gì không?
11. Android: nhấn giữ icon ngoài màn hình (shortcuts); mở link `/r/…` từ Zalo khi app đang mở.
12. Chơi khi đã cài, xoá lịch sử Safari, tiến độ còn không?
