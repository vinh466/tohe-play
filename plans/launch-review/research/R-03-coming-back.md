# R-03 — Quay lại: mở app đã cài, hay vào lại `/play` lần thứ hai trở đi

- Date: 2026-10-22 · Feeds: D-04 (mở lại app), D-02 (bố cục)
- **[chưa kiểm]** = từ hiểu biết chung, không phải nguồn đã đọc hôm nay.

## Question

Owner (2026-10-22, gõ không dấu): "flow khi app intalled hay user enter lai app UX ban thay on chu, ban co khao sat va
research nhu cau nay chua". Phase 1 đã nghiên cứu **lần đầu** mở app đã cài (product-surface R-03, E-03 §8). Còn những
lần mở sau thì app hôm nay làm gì, và nên làm gì?

## Findings — hôm nay (code tại `main` 5c37d1c)

| Kịch bản | Hôm nay | Nguồn | Thiếu |
|---|---|---|---|
| **Mở app → màn đầu** | phiên lấy từ `me` (có bản cache ở IndexedDB khi mất mạng): account trước, rồi hồ sơ máy, rồi tạo hồ sơ máy im lặng; màn đầu là danh mục | `apps/hub/src/api/queries.ts:27-44`, `session/session.ts:56-97` | phiên account hết hạn thì app **lặng lẽ** về hồ sơ máy — tiến độ rơi vào hồ sơ máy, không ai báo |
| **Máy dùng chung, nhiều hồ sơ** | hồ sơ đang chơi do server giữ theo phiên của máy (`ActiveProfileId`), nên lần sau vẫn là người lần trước; màn chọn chỉ hiện khi chưa chọn ai | `services/api/src/Tohe.Api/Modules/Identity/Views.cs:64-70`, `apps/hub/src/router.tsx:92-99` | không có bước "Ai đang chơi?" khi quay lại; chưa kiểm hồ sơ trẻ chuyển sang hồ sơ người lớn có cần PIN không |
| **Chơi tiếp ván dở** | lưu ván ở máy trước (IndexedDB), account đồng bộ lên server; màn tiêu đề của game có "Chơi tiếp" | `session/useBackgroundSync.ts:37-40`, `packages/game-kit/src/shell.ts:206-207` | danh mục không có "chơi tiếp", không có "gần đây" — phải mở đúng game mới biết có ván dở |
| **Quay lại bàn đang chơi** | API giữ ghế 30 giây rồi cho bot đánh thay; bàn không ai nối thì đóng sau 30 phút; SignalR tự nối lại khi app hiện lại | `RoomRegistry.cs:19,22`, `RoomActor.cs:1049`, `apps/hub/src/rooms/connection.ts:21-31` | hub có `rooms.mine()` (`api/client.ts:338`) nhưng **không màn nào gọi** — không có "bạn đang ở bàn…", muốn quay lại phải có link hay mã |
| **Chuyện xảy ra lúc vắng** | lời mời vào bàn được hỏi 20 giây một lần khi app đang hiện, chỉ cho account, hiện trên danh mục | `rooms/RoomInvites.tsx:18-20`, `CatalogPage.tsx:75` | hồ sơ máy (`named`) không thấy lời mời; không có thông báo đẩy, không có badge |
| **Cập nhật app** | `registerType: 'autoUpdate'`; `sw.js` có `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`; nhiều màn nạp lười; `lazyRouteComponent` của TanStack Router **tự nạp lại trang một lần** khi thiếu file màn (`apps/hub/node_modules/@tanstack/react-router/dist/esm/lazyRouteComponent.js:37-41`) | `apps/hub/vite.config.ts:82`, `router.tsx:125-197` | **đã thử, không có màn lỗi** (2026-10-22, test hai bản build trên Chromium): file cũ thường còn trong HTTP cache (`/assets/` immutable một năm) nên không có gì xảy ra; khi cache bị xoá thì trang tự nạp lại **một lần, không báo**, lúc chuyển màn — không cắt ngang game đang chơi; mất trạng thái chỉ có trong bộ nhớ. Safari/iOS chưa thử |
| **Mất mạng** | danh mục từ cache, có dòng "Đang ngoại tuyến"; game mở bằng những gì máy có | `CatalogPage.tsx:77-78`, `GameFrame.tsx:648` | game chưa mở gần đây có thể không chạy offline (suy luận) |
| **Link khi đã cài app** | manifest không có `launch_handler`, `share_target`; có một shortcut (Ghép Khối); ô "Nhập mã" cho iPhone | `vite.config.ts:91-113` | link mở trong trình duyệt; cửa sổ app đang mở không được đưa lên |
| **Đo** | `funnel.standaloneOpen()` một lần mỗi ngày | `telemetry/funnel.ts:24,54-55` | không đếm lần quay lại trong trình duyệt |

## Findings — tiền lệ

- **Chọn hồ sơ trên máy dùng chung**: Netflix khoá hồ sơ bằng PIN 4 số, cần để mở hồ sơ đó; đặt PIN cần mật khẩu account —
  https://help.netflix.com/en/node/114277. **[chưa kiểm]** Netflix hiện "Ai đang xem?" ở phần lớn lần mở app và sau
  một lúc không dùng; Nintendo Switch cho bỏ bước chọn khi máy chỉ có một người; Disney+, YouTube Kids khoá đường ra khỏi
  hồ sơ trẻ bằng PIN hay câu đố. Mẫu chung: một hồ sơ thì nhớ; nhiều hồ sơ thì hỏi nhẹ khi mở lạnh hay sau một lúc vắng;
  **trẻ → người lớn có cổng, người lớn → trẻ thì không**.
- **Chơi tiếp** **[chưa kiểm]**: Duolingo, Apple Arcade, PS5, Switch, Poki ("Recently played") — màn đầu là "việc bạn đang
  làm dở", một chạm; danh mục ở dưới.
- **Cập nhật service worker** **[chưa kiểm]**: Chrome/Workbox khuyên không tự `skipWaiting` khi trang cũ có thể hỏng; thay
  bằng "có bản mới — tải lại", hoặc áp dụng ở lần mở lạnh sau —
  https://developer.chrome.com/docs/workbox/handling-service-worker-updates
- **`launch_handler`**: thử nghiệm, ít trình duyệt có; giá trị `focus-existing` gửi URL vào `launchQueue`; MDN khuyên
  `["focus-existing","auto"]` có kiểm tính năng — https://developer.mozilla.org/en-US/docs/Web/Manifest/launch_handler.
  **[chưa kiểm]** Android: app đã cài (WebAPK) mở link trong phạm vi của nó từ app khác, nhưng WebView của Zalo/Messenger
  thường giữ link lại; iOS 26: chạm link luôn mở Safari, không mở app trên màn hình chính.
- **Badge và thông báo đẩy trên iOS**: `setAppBadge` chạy ở web app trên màn hình chính iOS 16.4+, chỉ sau khi người dùng
  cho phép thông báo; Web Push cần app đã thêm vào màn hình chính, `display` standalone, và xin quyền ngay sau một thao tác
  của người dùng; không cần bên thứ ba ngoài dịch vụ push của trình duyệt — https://webkit.org/blog/13878/
- **Lưu trữ**: WebKit cấp lưu trữ bền theo tín hiệu, trong đó có "mở như web app trên màn hình chính"; quota như trình
  duyệt — https://webkit.org/blog/14403/. **[chưa kiểm]** giới hạn 7 ngày của Safari không áp cho web app trên màn hình
  chính; Chrome Android tự cấp `persist()` cho trang đã cài.
- **Trẻ em — không níu kéo**: ICO Children's Code, chuẩn 5, cảnh báo các tính năng "dính" — vòng thưởng, cuộn vô tận,
  thông báo, tự chạy tiếp — "khuyến khích tiếp tục chơi"; nên trình bày lựa chọn tiếp tục một cách trung tính và có chỗ
  dừng — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/5-detrimental-use-of-data/
  Hợp với lời hứa của vision (không quảng cáo, không theo dõi).

## Assumptions

- Máy cả nhà dùng chung là chuyện thường ở các gia đình dùng Tò He — từ D-03 Phase 1 (bố mẹ + con), chưa đo.
- iPhone giết app nền sớm, nên gần như mỗi lần quay lại trên iPhone là một lần mở lạnh **[chưa kiểm]**.
- ~~Rủi ro sau deploy cần tái hiện~~ — đã thử 2026-10-22 (Chromium, hai bản build): không có màn lỗi; Safari/iOS chưa thử.

## So what

- Màn đầu của người quay lại phải là **việc họ đang làm dở**, không phải danh mục từ đầu: chơi tiếp, bàn đang ngồi, lời mời.
- Máy dùng chung cần **"Ai đang chơi?" nhẹ**, và cổng khi trẻ chuyển sang hồ sơ người lớn.
- **Cập nhật**: không có màn lỗi (đã thử); chỉ có một lần tự nạp lại không báo khi file cũ không còn trong cache. Báo "có bản
  mới" và cập nhật ở lần mở lạnh là cải thiện trải nghiệm, không phải sửa lỗi gấp.
- Phiên hết hạn phải được **nói ra**, không lặng lẽ đổi người chơi.
- Không thêm vòng níu kéo cho trẻ; thông báo đẩy (nếu có) chỉ khi người chơi tự bật, cho việc thật như "đến lượt bạn".
