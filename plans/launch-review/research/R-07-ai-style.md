# R-07 — "AI style": vì sao Tò He trông như máy làm, và cách bớt

- Ngày: 2026-10-23 · Làm bởi: scout (Opus · high) + master · Phục vụ: [D-07](../items/D-07-visual-direction-and-voice.md), E-04
- Owner 2026-10-23: "làm kỹ thay đổi để bớt AI style đi (bạn có thể research thêm và brainstorm …) để phục vụ người
  dùng tốt hơn"
- Ảnh chụp prod: `$CLAUDE_JOB_DIR/tmp/survey/out*/` của job 79919e37 (không lưu trong repo); script khảo sát ở
  [R-09](R-09-survey-2026-10-23.md)

## 1. Dấu hiệu — có nguồn

**Hình ảnh**

- Mô hình quay về "trung tâm thống kê" của dữ liệu: font hệ thống, bố cục và component quen thuộc, bảng màu "rụt rè,
  chia đều" → giao diện "nhận ra ngay và bỏ qua ngay". Cái chống lại: màu chủ đạo mạnh + điểm nhấn sắc, bố cục theo
  ngữ cảnh. ([Anthropic, frontend design](https://claude.com/blog/improving-frontend-design-through-skills))
- Bảng dấu hiệu của web "vibe-coded" (tổng hợp từ Reddit): mặc định shadcn/Tailwind, gradient, emoji làm icon, hero
  căn giữa + ba thẻ. ([vibecoded-design-tells](https://github.com/JCarterJohnson/vibecoded-design-tells))
- Thẻ bo tròn + bóng mờ, icon nét mảnh thay nhau được, hero "của mười nghìn sản phẩm khác". Cách sửa: quyết định
  thương hiệu thật thay cho mặc định. ([925studios](https://www.925studios.co/blog/ai-slop-design-tells))
- Emoji làm UI: trình đọc màn hình đọc tên Unicode, mỗi hệ điều hành vẽ một kiểu.
  ([UM-Flint](https://www.umflint.edu/accessibility/using-emojis/))

**Câu chữ**

- Văn AI dùng gạch ngang dài nhiều gấp ~10 lần, bộ ba gấp 4, "không chỉ X mà là Y" gấp 3, mũi tên và ký tự lạ gấp 3,
  emoji kiểu UI; không dấu hiệu nào tự nó là bằng chứng. ([Pangram](https://www.pangram.com/signs-of-ai-writing),
  [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing))
- Hướng dẫn tiếng Việt của Microsoft: tránh dịch từng chữ ("giọng sẽ cứng"), bỏ bớt từ mô tả cho gọn, giọng "rõ, thân,
  ngắn … như nói chuyện", chỉ viết hoa chữ đầu câu, chọn từ hiện đại ("Không tải được" hơn "Tải về không thành công").
  ([Microsoft VN style guide](https://download.microsoft.com/download/b/f/e/bfecb1b4-21ab-48fd-a48c-c2471b026f8f/vie-vnm-StyleGuide.pdf))
- Câu bị động tiếng Anh thường nên thành câu chủ động tiếng Việt, bớt "được/bị".
  ([VJOL](https://vjol.info.vn/giaochuc/article/view/141239))
- Không tìm thấy hướng dẫn UX writing công khai của MoMo, Zalo, Tiki, VNG.

**Trẻ em và bố mẹ**

- NN/g: chia 3–5, 6–8, 9–12; trẻ nhỏ không đọc, trẻ bỏ qua đoạn dài; trẻ chờ âm thanh và chuyển động; link cho bố mẹ
  để ở footer chữ. ([NN/g children](https://www.nngroup.com/articles/childrens-websites-usability-issues/),
  [NN/g kids cognition](https://www.nngroup.com/articles/kids-cognition/))
- Toca Boca: "nhiều chữ là không ổn với người dùng nhỏ", cố ý chừa khoảng trống.
  ([GamesBeat](https://gamesbeat.com/how-toca-boca-got-100m-mobile-downloads-by-putting-kids-first/)) Sago Mini: hình
  bắt đầu từ sổ phác thảo, "ngộ nghĩnh". ([Sago Mini](https://sagomini.com/about))
- Poki: một dòng ("What are you playing today?") rồi lưới ô nhiều cỡ, không có các khối giới thiệu; ảnh bìa "một vật
  rõ ở tiền cảnh … bỏ chữ". ([poki.com](https://poki.com/), [Poki thumbnail guide](https://developers.poki.com/guide/game-thumbnail))
- Tò he: bột gạo nếp, màu truyền thống vàng, đỏ (gấc), đen, xanh lá; con giống và nhân vật cổ tích; làng Xuân La.
  ([Báo Văn hoá](https://baovanhoa.vn/loi-song/to-he-mon-qua-tuoi-tho-thuong-nho-57353.html),
  [Wikipedia](https://en.wikipedia.org/wiki/T%C3%B2_he))

## 2. Tò He hôm nay — đã thấy trên prod

| Chỗ | Dấu hiệu |
|---|---|
| Màu, font | Token là dải orange của Tailwind gần như nguyên giá trị (`--tohe-page #fff7ed` = orange-50, `--tohe-ink #431407` = orange-950, `packages/design-tokens/tokens.css`); font `system-ui` |
| Icon | Emoji làm icon khắp nơi: tab 🎮 🤝 👤, 🔗 trên mỗi ô, `#` cho Nhập mã, ✉️, ☀️ 🌙 🌗, 🏆; trong game 🧱 làm logo Ghép Khối (danh mục lại dùng icon vẽ), 🔊 ⚙️ ❓ ▶ |
| Avatar, tên | 16 emoji Noto; tên ngẫu nhiên không khớp hình ("Cá Heo Lém Lỉnh" + 🦊, "Ếch Lấp Lánh" + 🐝) — hai danh sách bốc riêng (`session/profileNames.ts`, `storage/deviceProfiles.ts`) |
| Bố cục | Mọi thứ là thẻ trắng bo tròn căn giữa trên nền kem; trang chủ lặp 6 lần "tiêu đề + đoạn + link →"; H1 cam to lặp lại tên tab trên mỗi tab |
| Câu chữ | "Game nhỏ cho cả nhà · Không quảng cáo · Không cần tài khoản · Chơi ngay"; "— không bao giờ"; "Dành cho người làm game … cho cả người lẫn AI" trên trang chủ cho gia đình; mô tả game bị cắt giữa chữ ("trong 20…") |
| Nhắc mãi | Dải "Tiến độ đang lưu trên máy này. Đăng nhập" ở Trò chơi mọi lần mở |
| Khoảng trống | Tablet và máy tính: danh mục chiếm một phần ba trên, còn lại trống |

## 3. Viết lại — ví dụ (agent đề xuất; agent tự áp dụng câu chữ UI theo quyết định cũ của owner)

| Trước | Sau |
|---|---|
| Game nhỏ cho cả nhà · Không quảng cáo · Không cần tài khoản · Chơi ngay | Mấy trò chơi nhỏ cho cả nhà. Mở là chơi, không quảng cáo. |
| Chơi ngay — không cần tài khoản | Chơi luôn (dòng nhỏ dưới: Không cần đăng ký.) |
| Mở phòng chơi, gửi link qua Zalo hay Messenger là bạn vào cùng bàn — mỗi người một điện thoại. | Mở bàn, gửi link qua Zalo là cả nhà vào chơi, mỗi người một máy. |
| Như một ứng dụng trên điện thoại / Thêm Tò He vào màn hình chính… | Để Tò He ngay ngoài màn hình / Lần sau bấm một cái là mở. |
| Còn thắc mắc? Miễn phí không, dữ liệu để đâu, bé chơi có ổn không — … | Bố mẹ hay hỏi (ba câu hỏi làm link) |
| Không quảng cáo, không theo dõi, không mua bán, không xu — không bao giờ. | Không quảng cáo, không bán gì, không xu. Bé bấm đâu cũng không mất tiền. |
| Dành cho người làm game … cho cả người lẫn AI. | (xuống footer) Bạn làm game? Tài liệu (tiếng Anh) |
| Đang ngoại tuyến — hiển thị danh sách đã lưu | Đang mất mạng. Trò đã mở trước đó vẫn chơi được. |
| Trò chơi không phản hồi. Thử lại sau nhé. | Trò chơi chưa chạy được. Thử mở lại nhé. |
| Có mã bàn chơi (6 số) hoặc mã link mời (8 ký tự)? Nhập vào đây. + 6 số hoặc 8 ký tự. Dán cả link cũng được. | Mã được gửi cho bạn · gợi ý: Gõ mã hoặc dán link. (luật 6/8 chỉ hiện khi gõ sai) |
| Chưa có link nào. Bấm 🔗 trên một trò chơi để tạo link mời. | Chưa gửi link nào. |
| 🏆 {{game}} | Bảng điểm {{game}} (icon SVG) |

Luật rút ra: "·" chỉ dùng trong dòng dữ liệu (`{{host}} · 3/4 chỗ`), không trong câu; tối đa một gạch ngang dài mỗi
màn; câu chủ động; bỏ "bạn" khi chủ ngữ đã rõ; không lộ chi tiết nội bộ (SHA, "game mẫu", "hợp đồng", "AI") ở bề mặt
người chơi; tránh từ hệ thống khô (ngoại tuyến, hiển thị, phản hồi) khi có từ thường.

## 4. Ba hướng

| | A — Xưởng tò he | B — Đồ chơi gọn | C — Chợ phiên Đông Hồ |
|---|---|---|---|
| Ý | Mọi bề mặt như nặn từ bột gạo màu | Gọn, chắc, lấy hình thật của game | Nét khắc gỗ, giấy dó, âm thanh chợ |
| Hình | 16 avatar con tò he (khớp danh sách tên), linh vật cho màn trống, ảnh bìa mỗi game (một vật chính, không chữ) | Bộ icon SVG (Phosphor fill/duotone, MIT), ảnh bìa từ ảnh chụp game | Viền khắc, nền giấy |
| Màu | Token lấy lại từ màu nhuộm: trắng gạo, đỏ gấc (thương hiệu), xanh lá, vàng, mực đen | Giữ tông, cam chỉ cho hành động | Đỏ son, vàng, đen trên nền giấy |
| Chữ | Font có dấu Việt chuẩn, tự host (vd. Be Vietnam Pro) + font tiêu đề tròn (kiểm dấu) | Như A | Như A |
| Chuyển động, âm | Bấm "bóp bột", tiếng gõ bột nhẹ | Ít | Âm chợ |
| Giá | Lớn (người vẽ là phần chính; code vừa) | Rẻ → vừa | Vừa → lớn |
| Rủi ro | Giữ một phong cách qua nhiều game; lệch sang "đồ Tết"; minh hoạ ở dark mode | Vẫn có thể chung chung; ít chất Việt | Khó đọc, dark mode khó, hoài cổ cho bố mẹ hơn cho trẻ |

**Khuyến nghị (agent):** đích là **A**; làm trước phần nền của **B** vì cả hai đều cần (icon SVG, câu chữ, bố cục
danh mục, tên khớp hình). A là hướng duy nhất mọc ra từ cái tên, và biến thứ chung chung nhất (avatar emoji) thành
thương hiệu.

## 5. Checklist cho mỗi lần rà màn

- Có emoji nào đang làm icon hay nút? → SVG + nhãn.
- Tiêu đề màn có lặp tên tab? Hơn một H1 cam?
- Có phải mọi thứ là thẻ trắng căn giữa? Có khối "tiêu đề + đoạn + link →" lặp?
- Có chữ bị cắt "…" giữa từ?
- Tên và hình có khớp?
- Dark, 360 px, tablet, máy tính: có khoảng trống lớn vô lý?
- Vùng chạm ≥ 44 px, có nhãn?
- Câu chữ: không bộ ba "·" trong câu, ≤ 1 gạch ngang dài, chủ động, ít "bạn", không từ hệ thống khô, viết hoa chữ đầu câu.
- Có gì nội bộ lộ ra cho người chơi?
- Màn này cho trẻ hay cho bố mẹ? Phần của bố mẹ (giấy tờ, dữ liệu, kỹ thuật) ở footer, Tôi, hoặc sau cổng PIN.
- Ông bà có nói câu này thành lời như vậy không?
