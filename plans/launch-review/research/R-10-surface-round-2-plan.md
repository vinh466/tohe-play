# R-10 — Bề mặt vòng 2: hiện trạng và kế hoạch research

- Date: 2026-10-24 · Feeds: [D-08](../items/D-08-landing-introduces.md), [D-09](../items/D-09-the-way-back-in.md),
  [D-10](../items/D-10-entering-the-hub.md), [E-08](../items/E-08-screens-layouts-and-flows.md)
- Làm bởi: master, phiên "ToHe Surface". Ảnh chụp Playwright trên prod `prod-2026-10-24.3`, chỉ đọc.
- Owner duyệt kế hoạch 2026-10-24: "duyệt, kế hoạch ổn, làm đi". Bước 1–3: [R-11](R-11-surface-today-and-evaluation.md),
  [R-12](R-12-peers-front-door-and-first-run.md); bước 4–5: D-08–D-10, E-08 `proposed`. Giả thuyết dưới đây được R-11
  xác nhận.

## Question

Owner, 2026-10-24, chat, sau khi thử trên máy thật (mục 1–3 của checklist đợt 2 "ổn"):

> nhìn chung func ổn k lỗi nha, còn về luồng và UI thì cần cải thiện cho xịn hơn nữa, landing page làm cho nó giới
> thiệu 1 chút có các section và căn giữa các nút phù hợp hơn đi, chủ yếu là các văn ở đây, chúng ta có page game list
> đồ r thì k cần list game ở đây lặp, tôi thấy trang đầu tiên cho user mới cuộn xuống có thể đọc hiểu sản phẩm ok, và
> về user cũ cần vào game mà nhập domain vào đây cũng đáng quan tâm là làm sao để họ nhấn thêm 1 nút để vào hub 1 cách
> thoải mái đi, research cho tôi 1 ý tưởng làm UIUX chỗ này thật sự mượt va hiệu quả k làm user khó chịu lẫn hoang mang
> chuyện gì xảy ra đi (tôi đang nghi do bố cục domain/path ta k ổn quá, nói chung là khảo sát thử), luồng khi vào hub
> thì cũng nên hỏi user cần đăng nhập nếu chưa đăng nhập đi, tôi test thấy vào thẳng với profile tạm nó hơi làm user k
> biết chuyện gì đang xảy ra, bạn nên lập kế hoạch research lên layout phù hộp cho các screen và đánh giá UIUX ấn tượng
> cùng luồng làm user dễ chịu và hiểu cách vận hành nha

Ba câu hỏi cụ thể (D-08, D-09, D-10) và một câu chung (E-08): mỗi màn bố cục thế nào, luồng nào làm người dùng dễ chịu
và hiểu Tò He vận hành ra sao.

## Findings — hiện trạng (2026-10-24)

Pixel 7 (412×915) và 1366×820, tiếng Việt, sáng.

| Chỗ | Hôm nay | Nguồn |
|---|---|---|
| `/`, máy mới | H1 "Tò He" + một câu → "Chơi gì hôm nay?" lưới 4 game → hộp "Chơi cùng" một câu → "Bố mẹ hay hỏi" 3 link → footer. Không có phần nói Tò He là gì, chơi thế nào, hồ sơ và tiến độ, an toàn cho trẻ, cài app. Nút duy nhất: *Chơi ngay* ở góc header; hero không có nút. Máy tính: một cột ~930 px, hai bên trống | prod; `apps/web/src/pages/index.astro` |
| `/`, máy đã mở game | Thêm một nút *Chơi tiếp* rộng cả màn ở trên H1, header đổi *Chơi ngay* → *Chơi tiếp*. Nút không nói vào đâu, hồ sơ nào, game gì | prod; khoá `tohe:returning` |
| Lưới game | Trùng với `/games/` (trang danh sách công khai) và danh mục `/play` | `apps/web/src/pages/games/index.astro` |
| `/play`, máy mới | Vào thẳng danh mục với một hồ sơ máy tự đặt tên ("Thỏ Hiền Khô", avatar emoji) ở góc. Không lời nào nói đây là ai, tiến độ lưu ở đâu, đăng nhập ở đâu (đăng nhập nằm trong Tôi) | prod; [identity.md](../../../docs/architecture/identity.md) "Device profiles" |
| App đã cài | Mở `/play`, không qua `/` | ADR 0046 |
| Người đã đăng nhập, trình duyệt mới | `/` thấy như người mới: trang tĩnh chỉ đọc `localStorage` (`tohe:returning`, `tohe:guest`), không biết phiên | `apps/web/src`, ADR 0046 |

Quyết định đang có hiệu lực mà ba câu hỏi chạm vào:

- **ADR 0046** — không redirect ở `/` (owner 2026-10-22: "triệt để bỏ đi, làm như mới"); phương án bị loại "giữ
  redirect" vì người quay lại không đọc được giới thiệu, Hỏi đáp từ link `/`. App đã cài mở `/play`.
- **ADR 0047** + D-06 — trang chủ "danh mục trước".
- **ADR 0042** + D-05 — host theo độ tin, path theo thành phần: người chơi ở `toheplay.io.vn`, trang công khai ở `/`,
  app ở `/play`, `/together`, `/account`.
- **ADR 0043** — hồ sơ máy (không email, không account, tối đa 5 mỗi máy, chỉ lên server khi ngồi bàn, chuyển máy
  hay gộp vào account); brief của `product-surface`: "chơi ngay không cần tài khoản".
- **ADR 0025** — câu tuổi và đồng ý khi dữ liệu lần đầu lên server. **ADR 0044** — link mời `/s/`, `/r/` vào nhanh.

## Assumptions

- Owner nghi bố cục domain/path. Giả thuyết của agent, **chưa kiểm**: chỗ khó chịu nằm ở *nội dung* hai cửa (nút
  chung chung ở `/`, hồ sơ tạm im lặng ở `/play`) nhiều hơn ở path; research bước 2–3 kiểm bằng tiền lệ và đánh giá.
- "Hỏi đăng nhập khi vào hub" chưa nói rõ là **bắt buộc** hay **hỏi và cho chọn**; hai cách khác nhau nhiều (D-10).

## Kế hoạch research

**Câu hỏi.**

| # | Câu hỏi | Item |
|---|---|---|
| Q-A | Trang giới thiệu của một nền tảng game gia đình cần những section nào, thứ tự nào, để người mới cuộn xuống là hiểu: Tò He là gì, chơi thế nào, cho ai, an toàn, chơi cùng, cài app, bắt đầu? Nút đặt đâu (hero căn giữa, cuối trang, dính đáy trên điện thoại)? Bỏ lưới game mà vẫn giữ link nội bộ cho SEO/GEO thế nào? | D-08 |
| Q-B | Người đã chơi gõ `toheplay.io.vn`: cách nào vào hub trong một chạm, biết mình đang đi đâu, mà link `/` vẫn ra trang giới thiệu cho người cần đọc? Có phải đổi bố cục domain/path không? | D-09 |
| Q-C | Màn đầu của hub cho người chưa đăng nhập nên hỏi gì, mấy bước tới ván đầu, người được mời qua link có bị chặn không, ai cầm máy lần đầu (bố mẹ hay trẻ)? | D-10 |
| Q-D | Mỗi màn: mục đích, một hành động chính, bố cục điện thoại · tablet · máy tính, trạng thái rỗng · đang tải · lỗi. "Ấn tượng" đo bằng gì? | E-08 |
| Q-E | Người dùng hiểu cách Tò He vận hành (hồ sơ, tiến độ lưu ở đâu, chơi cùng, cài app) qua chỗ nào: trang giới thiệu, màn đầu hub, trạng thái rỗng, gợi ý đúng lúc? | E-08 |

**Các bước.**

| Bước | Làm gì | Ra gì |
|---|---|---|
| 1. Hiện trạng | Ảnh chụp prod theo ma trận: máy mới · máy đã chơi · đã đăng nhập · app đã cài · mở từ link mời × 412 · tablet · 1366 × sáng · tối × vi · en; bản đồ luồng hôm nay (Mermaid) đọc từ code | R-11 (trang ảnh + luồng) |
| 2. Tiền lệ | 12–15 sản phẩm, ba nhóm: game cho trẻ và gia đình (Poki, CrazyGames, PBS Kids Games, Khan Academy Kids, Toca Boca, YouTube Kids); web app có trang giới thiệu và app (Duolingo, Lichess, chess.com, Discord, GitHub, Notion); thói quen ở Việt Nam (Zalo Web). Mỗi cái: `/` cho người mới và người quay lại, màn đầu khi chưa đăng nhập, chơi thử không tài khoản, section của trang giới thiệu, cách nói "đang mở app" | R-12, có nguồn và ảnh khi lấy được |
| 3. Đánh giá | Hiện trạng theo Nielsen 10, hướng dẫn UX cho trẻ của NN/g, checklist [voice-and-look](../../../docs/conventions/voice-and-look.md); "phép thử 5 giây": người mới nói lại được Tò He là gì không, người quay lại biết bấm đâu không | Bảng điểm đau xếp mức trong R-11 |
| 4. Phương án | D-08, D-09, D-10 lên `proposed`: 2–4 phương án mỗi item, chi phí, ADR bị đụng, đề xuất; wireframe điện thoại + máy tính cho phương án đề xuất; luồng mới (Mermaid) | item files, wireframe |
| 5. Bố cục từng màn | E-08: bảng màn → mục đích → hành động chính → bố cục ba khổ → trạng thái rỗng/lỗi; wireframe 4 màn: trang giới thiệu, cửa người quay lại, màn đầu hub, Trò chơi | E-08 + wireframe |
| 6. Owner duyệt → graduate | ADR sửa 0046/0047 (có thể 0042, 0043) → `docs/architecture/surfaces.md` → PR build → prod → owner thử trên máy | graduation list "vòng 2" |

Bước 1–3 một phiên; bước 4–5 một phiên; owner xem; build khoảng 2–4 PR. Tuỳ chọn sau build: owner và 2–3 người trong nhà
làm hai việc ("vào chơi tiếp Ghép Khối", "đăng nhập") trong lúc owner nhìn — không dùng analytics bên thứ ba.

**Ràng buộc.** Lời hứa của vision (không quảng cáo, không theo dõi); tiếng Việt là mặt chính; màu từ design token, sáng
và tối; voice-and-look (không emoji làm icon); SEO/GEO của ADR 0047 và không cloaking (bot và người mới thấy cùng một
trang); link mời của ADR 0044 vẫn vào nhanh; trẻ và bố mẹ; prod là môi trường test trước launch (owner 2026-10-24).

**Không thuộc vòng này.** S3 (tranh của hoạ sĩ), Asset Studio, tính năng mới ở backlog sản phẩm.

## So what

Ba quyết định đã chốt bị mở lại một phần: D-06 (trang chủ danh mục trước), D-04/ADR 0046 (cửa của người quay lại), và
có thể D-05/ADR 0042 (path), tuỳ kết quả bước 2–3. ADR 0043 (chơi ngay bằng hồ sơ máy) mở lại nếu D-10 chọn bắt đăng nhập.

## Sources

- Ảnh chụp prod 2026-10-24 (Playwright 1.64, Chromium), lưu ngoài repo.
- ADR [0042](../../../docs/decisions/0042-hosts-by-trust-paths-by-component.md),
  [0043](../../../docs/decisions/0043-device-profiles-and-identity-levels.md),
  [0044](../../../docs/decisions/0044-entry-links.md),
  [0046](../../../docs/decisions/0046-player-surfaces-two-zones-one-frame.md),
  [0047](../../../docs/decisions/0047-two-languages-and-an-introduction-surface-that-grows.md);
  [surfaces.md](../../../docs/architecture/surfaces.md), [identity.md](../../../docs/architecture/identity.md).
