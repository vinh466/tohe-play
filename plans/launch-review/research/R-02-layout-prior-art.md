# R-02 — Bố cục hiện đại: tiền lệ, điều hướng, SEO hai ngôn ngữ

- Date: 2026-10-22 · Feeds: D-02 (bố cục), D-01 (ngôn ngữ)
- Nguồn đọc ngày 2026-10-22. **[chưa kiểm]** = từ hiểu biết chung, không phải trang đã đọc hôm nay — dùng như gợi ý,
  không như sự thật.

## Question

Owner (2026-10-22, gõ không dấu): "tap trung dive research ve bo cuc cac screen/app cho toi 1 giai phap hien dai, toi uu
cho nhu cau cua san pham ta, ta chua launch gi ca nen gia rat re ta co the thoai mai upgrade/change nha". Các nền tảng
game web và app hiện đại bố cục thế nào, điều hướng PWA nên ra sao, và SEO hai ngôn ngữ làm thế nào cho đúng?

## Findings

### 1. Nền tảng game web

| Nền tảng | Trang chủ | Trang game | Ngôn ngữ | Nguồn |
|---|---|---|---|---|
| Poki | danh mục là trang chủ, không có hero quảng bá **[chưa kiểm]** | **một URL vừa là trang SEO vừa là chỗ chơi**: khung game ở trên (nút toàn màn hình, báo lỗi), dưới là giới thiệu, cách chơi, hỏi đáp, breadcrumb, game liên quan | tiền tố đường dẫn `/en/g/…` | https://poki.com/en/g/subway-surfers |
| CrazyGames | danh mục là trang chủ; máy tính có rail trái theo thể loại, thanh trên có tìm kiếm và đăng nhập **[chưa kiểm]** | cũng một URL: game + mẹo, điều khiển, ghi chú an toàn, ngày phát hành | — | https://www.crazygames.com/game/bloxdhop-io |
| itch.io, Apple Arcade, Netflix Games, PBS Kids | trang game cũng là chỗ chơi (itch.io); app có thanh tab (Arcade, Netflix); ô nhân vật to, ít chữ, khu "người lớn" riêng (PBS Kids) | — | — | **[chưa kiểm]** |

Hai nền tảng lớn (Poki, CrazyGames) sống bằng quảng cáo và không có trạng thái cá nhân đáng kể. Tò He thì không quảng cáo,
không script bên thứ ba (ADR 0042), và có trạng thái riêng: hồ sơ, bàn chơi, lời mời, link.

### 2. Điều hướng app và PWA

- **Thanh dưới khi màn hẹp, rail khi màn rộng**: Android mặc định navigation bar khi chiều rộng hay chiều cao ở mức compact
  (điện thoại, cả khi xoay ngang), navigation rail cho màn rộng hơn, drawer là tuỳ chọn ở màn rất rộng —
  https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation
- **Tab là để đi giữa các mục, không phải để làm hành động**; thanh luôn hiện, mỗi biểu tượng có nhãn, ít mục —
  https://developer.apple.com/design/human-interface-guidelines/tab-bars. Số mục thường gặp: thanh 3–5, rail 3–7
  **[chưa kiểm]**.
- `display_override` là danh sách chế độ theo thứ tự ưu tiên, rơi về `display`; `window-controls-overlay` chỉ cho PWA đã
  cài trên máy tính, còn thử nghiệm — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override,
  https://web.dev/articles/window-controls-overlay
- **[chưa kiểm]**: ở chế độ standalone không có nút back của trình duyệt — iPhone không có back của hệ thống, nên app tự có
  nút lùi và thoát; Android back đi theo lịch sử, nên mỗi tầng (đang chơi, menu game) là một mục lịch sử. WebView của
  Zalo, Messenger không cài PWA được — Tò He đã có `InAppStrip` (`apps/hub/src/ui/Screen.tsx:15`).

### 3. Trang giới thiệu và app trên cùng một origin

- Google: **cloaking** là cho người và máy tìm kiếm thấy nội dung khác nhau *với ý định thao túng*; ví dụ redirect hợp lệ
  có "đưa người dùng tới trang bên trong khi họ đã đăng nhập" — https://developers.google.com/search/docs/essentials/spam-policies
  (cập nhật 2026-08-28).
- Suy luận (không phải lời Google): Googlebot không có localStorage nên luôn thấy trang công khai; redirect người quay lại
  từ `/` sang `/play` là hợp lệ. Cái giá là về trải nghiệm: người đã chơi không bao giờ đọc lại được `/`, kể cả khi bấm
  một link tới nó.

### 4. SEO hai ngôn ngữ

Theo https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites (cập nhật 2025-12-10):

- **Thư mục con** (`/en/`) dễ dựng, dễ giữ trên một host; tham số URL "không khuyên dùng".
- **Mỗi ngôn ngữ một URL**, không dựa vào cookie hay cài đặt trình duyệt.
- **Không tự chuyển theo ngôn ngữ**, không đổi nội dung theo IP; Googlebot chủ yếu bò từ Mỹ, không gửi `Accept-Language`.
- **Link đổi ngôn ngữ nhìn thấy được** trên mỗi trang.

Theo https://developers.google.com/search/docs/specialty/international/localized-versions (cập nhật 2026-09-21):

- `hreflang` khai báo **một cách thôi**: thẻ HTML, header `Link`, hoặc sitemap (`xhtml:link`).
- Mỗi bản liệt kê chính nó và mọi bản kia, giống nhau ở mọi bản; link một chiều bị bỏ qua; URL tuyệt đối `https://`.
- Mã ISO 639-1 (`vi`, `en`); `x-default` cho bản dùng khi không bản nào khớp.

Việt Nam: Google chiếm phần lớn tìm kiếm, Cốc Cốc khoảng 4–6% —
https://gs.statcounter.com/search-engine-market-share/all/viet-nam/2025. Thẻ xem trước của Zalo, Messenger đọc Open
Graph do server trả **[chưa kiểm]** — Tò He đã render thẻ ở server cho `/s`, `/r` (`LinkPreviews.cs`).

### 5. Trẻ em và gia đình

- Apple 1.3 (Kids): không link ra ngoài app, không mời mua, không làm phân tâm trẻ, **trừ khi** ở một khu riêng sau
  "parental gate"; không analytics hay quảng cáo bên thứ ba — https://developer.apple.com/app-store/review/guidelines/,
  https://developer.apple.com/app-store/kids-apps/. Google Play Families tương tự **[chưa kiểm]**.
- **[chưa kiểm]**: vùng chạm tối thiểu 48dp (Material) hay 44pt (Apple); ô theo hình, ít chữ; mọi thứ của người lớn (tài
  khoản, cài đặt, link ra ngoài, giấy tờ) gom về một chỗ.

### 6. Trong repo (kiểm 2026-10-22)

- Astro 7.3.8 (`apps/web`) có i18n routing sẵn (`prefixDefaultLocale` trong `astro/dist`).
- Manifest của game có một `name` (≤ 40) và một `description` (`packages/contract/src/manifest.ts:160,163`); trang công
  khai có nội dung riêng cho từng game (`apps/web/src/content/games.ts`).
- API đã có `GET /api/rooms/mine` và `GET /api/rooms/invites` (`services/api/src/Tohe.Api/Modules/Rooms/RoomsModule.cs:130,267`).
- Bố cục hôm nay: [R-01](R-01-pages-and-ways-in.md).

## Assumptions

- Người chơi Tò He chủ yếu dùng điện thoại; máy tính là thiểu số — chưa có số liệu (telemetry chỉ đếm tổng, ADR 0015).
- Bố mẹ là người đọc trang giới thiệu, trẻ là người chơi — từ D-03 của Phase 1, chưa đo.

## So what

- **Danh mục là trang chủ, mỗi game một trang có nút chơi ở trên**: hợp với người lạ từ Google. Tò He giữ được mà không
  cần quảng cáo.
- **Trạng thái cá nhân cần một "nhà" kiểu app**: chơi tiếp, bàn của tôi, lời mời. Poki không có nên không phải chép.
- **Thanh dưới 3 mục trên điện thoại, rail trên máy tính; ẩn khi đang chơi.**
- **`/en/` cho trang công khai**, `hreflang` qua sitemap, nút đổi ngôn ngữ, không tự chuyển theo ngôn ngữ.
- **Chỗ của người lớn** gom link ra ngoài và giấy tờ; hồ sơ trẻ em có thể cần mã của bố mẹ để mở chúng.
