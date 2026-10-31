# R-01 — Bề mặt hôm nay: ảnh chụp, chỗ đau, dấu hiệu "AI"

- Date: 2026-10-31 · Feeds: brief, D-01…D-08 · Tiếp nối [R-11](../../launch-review/research/R-11-surface-today-and-evaluation.md)
  (2026-10-24) và [R-07](../../launch-review/research/R-07-ai-style.md) (2026-10-23)
- Ảnh chụp: prod `toheplay.io.vn` ngày 2026-10-31, chỉ đọc, Playwright 1.64: 390×844, 820×1180, 1440×900; sáng và tối;
  vi và en; trang mới và máy đã chơi. Lưu ngoài repo.

## Câu hỏi

Bề mặt hiện tại đang nói gì với một người 16+ mở nó lần đầu, và chỗ nào làm họ không hiểu, không thấy game, hoặc thấy
đây là sản phẩm cho trẻ con?

## Cách chụp

- `/` (vi, en), `/games/`, `/games/merge-block/`, `/account/sign-in`, `/play`, `/play/merge-block`, `/account`,
  `/together`, màn "Chơi thử trên máy này" (vào bằng nút phụ, không gửi form lên server).
- Mỗi trang: 390 px (Pixel 7), 820 px (tablet), 1440 px (máy tính); sáng/tối; full page.
- Trạng thái đã đăng nhập đọc từ code, không tạo tài khoản.

## Bề mặt hôm nay — một câu

Một **trang giới thiệu cho gia đình** ở `/`, dẫn vào một **app launcher** ở `/play` với năm icon lớn, và một **trang bài
viết** cho mỗi game. Cả ba đều làm đúng chức năng, nhưng không cái nào nói "đây là sạp game cho người 16+".

## Điều đang tốt (giữ)

| Điều | Ở đâu | Vì sao giữ |
|---|---|---|
| Mở là chơi, không quảng cáo, không cần tài khoản | `/`, `/play` | Lợi thế cạnh tranh thật so với Poki/CrazyGames |
| Chơi cùng qua link, ghế trống có máy | `/together`, `/r/…` | Khác biệt lớn; không cổng game lớn nào làm tốt |
| Trang game có bảng sự thật, cách chơi, câu hỏi | `/games/<id>/` | Hơn hầu hết đối thủ; là nền để làm trang game tốt hơn |
| Giọng Việt ấm, câu ngắn, không áp lực | toàn bộ | Giữ chất, nhưng đổi register cho 16+ |
| PWA, offline, dark mode, safe area | hub | Nền kỹ thuật tốt, không cần làm lại |
| Chip hồ sơ "An · Trên máy này" | `/play` | Đúng hướng: nói rõ người chơi là ai, tiến độ ở đâu |

## Mười hai chỗ đau

Mức: **cao** = người mới không chơi được / hiểu sai sản phẩm; **vừa** = chậm, khó chịu, trông nghiệp dư; **thấp** = bóng
bẩy.

| # | Chỗ đau | Ở đâu | Bằng chứng | Mức |
|---|---|---|---|---|
| 1 | **Trang chủ không cho thấy game nào.** 5 giây đầu: logo, "Mấy trò chơi nhỏ cho cả nhà", hai nút; không ảnh game, không tên game, không lối tắt vào game. | `/` | Ảnh 390 px: hero chiếm 1 màn; phải cuộn qua "Tò He có gì", "Chơi thế nào" mới thấy "Xem 5 trò chơi" | cao |
| 2 | **Định vị "cả nhà" là mặc định.** Tiêu đề, mô tả, section "Cho bé và bố mẹ", FAQ "Bố mẹ hay hỏi", chip "Từ 3 tuổi". | `/`, `/games/` | Copy trong `apps/web/src/content/home.ts`; chip tuổi trong `factWords` | cao |
| 3 | **Catalog là app launcher, không phải sạp game.** Năm ô icon vuông to; không ảnh bìa, không mô tả, không thể loại, không tìm kiếm; desktop 1440 px trống gần nửa màn. | `/play` | Ảnh 1440 px: 4 ô hàng đầu + 1 ô hàng hai, phần còn lại trống | cao |
| 4 | **Không thấy hành động "Chơi" trên ô game.** Ô click được, nhưng thứ duy nhất hiện ra là "Rủ bạn"; người mới có thể tưởng đây là thẻ chia sẻ. | `/play` | `CatalogPage.tsx`: `Link` bọc ảnh + tên; dưới là `ShareButton`, `LeaderboardButton` | cao |
| 5 | **Ảnh game không cùng một hệ.** Chạm Chấm (vector phẳng), Chạm Ghép (3D), Ghép Khối (tile 3D), Tiến Lên (thẻ bài), Vườn Rau (pixel). | `/play`, `/games/` | Ảnh chụp catalog | vừa |
| 6 | **Trang game là bài viết, không phải trang game.** Icon 96 px, nút Chơi, bảng facts, cách chơi, FAQ; không ảnh gameplay, không clip, không "chơi thử". | `/games/<id>/` | Ảnh 1440 px; template `GamePage.astro` có `pictures` nhưng game chưa có ảnh | cao |
| 7 | **Cửa vào hỏi đăng nhập trước.** "Tiếp tục với Google" là nút chính; "Chơi thử trên máy này" là nút phụ; thanh tab dưới vẫn hiện trên màn đăng nhập. | `/account/sign-in` | Ảnh 390 px; `WelcomePage.tsx` | cao |
| 8 | **Trang Tôi là danh sách cài đặt, không phải hồ sơ.** Không có tiến độ, game đã chơi, thành tích; cuối trang lộ SHA build. | `/account` | Ảnh 390 px: "Phiên bản sha-c87fac…" | vừa |
| 9 | **Chơi cùng quá trống.** "Chưa ngồi bàn nào", một ô mã, "Link đã gửi: Chưa gửi link nào"; không nói vì sao nên rủ bạn. | `/together` | Ảnh 390 px | vừa |
| 10 | **Bố cục desktop/tablet chưa dùng hết chỗ.** Trang chủ một cột ~930 px; catalog 5 ô to; trang game một cột ~660 px. | `/`, `/play`, `/games/<id>/` | Ảnh 1440 px | vừa |
| 11 | **Màu và hình khối đơn điệu.** Toàn bộ palette là dải orange của Tailwind (`#fff7ed` → `#431407`); mọi thứ là card trắng bo tròn, bóng mờ. | tokens, toàn bộ | `packages/design-tokens/tokens.css` | vừa |
| 12 | **Nội bộ lộ ra.** "Dữ liệu kỹ thuật" ngay màn đăng nhập; SHA ở Tôi; "game mẫu" từng có (đã sửa). | `/account`, `/account/sign-in` | Ảnh chụp; `voice-and-look` #9 | thấp |

## Vì sao trông "AI"

"AI" ở đây không phải một màu hay một font; nó là **sự vắng mặt của nội dung cụ thể**. Một trang do máy viết thường có
đủ khung nhưng không có chi tiết: không ảnh thật, không con số, không giọng riêng, không lựa chọn của người làm. Trang
chủ hiện tại có đủ sáu dấu hiệu kinh điển:

1. **Hero căn giữa, logo + tagline + hai nút**, không có sản phẩm thật trong khung.
2. **Lưới feature 3 ô**, mỗi ô một icon trong ô bo tròn, một tiêu đề, một đoạn văn — lặp lại.
3. **Các bước 1–2–3** ("Chọn một trò chơi / Chơi luôn… / Gửi link…").
4. **FAQ accordion** ngay trên trang chủ.
5. **Banner CTA cuối trang** ("Sẵn sàng chơi?").
6. **Footer link farm** + "Cập nhật 25/10/2026".

Thêm vào đó: **một dải màu duy nhất** (cam), **mọi thứ là card trắng bo tròn**, **mascot thay cho ảnh game**, và **chữ
giải thích thay cho việc cho thấy**. Đây đúng là bộ dấu hiệu R-07 đã ghi; đợt S1/S2 đã sửa emoji và câu chữ, nhưng cấu
trúc trang vẫn là template.

## Điều này nói gì với người 16+

- "Đây là app cho bé" — vì tiêu đề, ảnh, tuổi, giọng "bố mẹ", avatar con vật.
- "Đây là trang giới thiệu, không phải nơi chơi" — vì không thấy game ở màn đầu.
- "Tôi phải đăng nhập" — vì cửa vào đặt đăng nhập trước.
- "Chắc chỉ có 5 game" — vì catalog trống, không có thể loại, không có "mới", không có tìm kiếm.
- "Game này chắc đơn giản" — vì ảnh là icon, không phải ảnh gameplay.

## So what

1. **Đổi bề mặt đầu tiên từ "giới thiệu" sang "sạp game"**: ảnh bìa, tên, câu hook, nút Chơi; câu chuyện sản phẩm xuống
   `/about` hoặc một dải ngắn dưới danh mục.
2. **Đổi register mặc định sang 16+**, đưa "gia đình" thành một khu riêng (trong Tôi + `/family`), không phải giọng chính.
3. **Đầu tư ảnh bìa + ảnh chụp game** — đây là đòn bẩy lớn nhất cho cảm giác "sản phẩm thật", hơn mọi thay đổi màu.
4. **Sửa affordance của ô game** (Chơi hiện rõ, cả ô click được, có hover/focus) — nhanh, rẻ, tác động ngay.
5. **Bỏ các dấu hiệu template**: feature grid, steps, FAQ, CTA cuối trang; thay bằng shelf, editorial, facts, ảnh.
6. **Đo lại**: thời gian tới lần chạm đầu trong game, tỉ lệ chơi trong 30 giây, số game/phiên.

## Giả định

- Ảnh chụp chỉ đọc; không đo được hành vi thật (chưa có phễu theo phiên).
- "Người 16+" là định vị owner đưa ra, chưa kiểm bằng phỏng vấn; nên xác nhận bằng 5–8 buổi thử 5 giây.
- Các game hiện có thể không đủ sức hút cho 16+; bề mặt tốt hơn không sửa được game yếu. Plan này chỉ làm bề mặt.

## Nguồn

- Ảnh chụp prod 2026-10-31 (Playwright, chỉ đọc).
- `apps/web/src/views/HomePage.astro`, `apps/web/src/content/home.ts`, `apps/web/src/views/GamePage.astro`.
- `apps/hub/src/pages/CatalogPage.tsx`, `PlayPage.tsx`, `WelcomePage.tsx`, `AccountPage.tsx`, `TogetherPage.tsx`.
- `apps/hub/src/frame/AppFrame.tsx`, `apps/hub/src/frame/tabs.ts`.
- `packages/design-tokens/tokens.css`, `docs/conventions/voice-and-look.md`.
- [R-07](../../launch-review/research/R-07-ai-style.md), [R-11](../../launch-review/research/R-11-surface-today-and-evaluation.md).
