# Brief — Bề mặt sản phẩm v2: sạp game cho người 16+

- Trạng thái: **confirmed** — owner xác nhận 2026-10-31.
- Ngày: 2026-10-31 · Người viết: agent, phiên "Surface v2"
- Liên quan: [`launch-review`](../launch-review/PLAN.md) (đợt 1, 2, 2b), [`voice-and-look`](../../docs/conventions/voice-and-look.md),
  ADR [0049](../../docs/decisions/0049-a-crafted-toy-voice-and-look.md),
  [0055](../../docs/decisions/0055-front-page-explains-greets-and-the-app-asks-once.md)

## Vì sao

Owner, 2026-10-31:

> "dường như các công việc đã tạm ổn, tôi muốn bạn review và dive research và brainstorm cho tôi về product surface, UIUX,
> content các screen, bố cục web, thiết kế web, có thể tạo ra một bề mặt sản phẩm một cách hiệu quả hơn nếu được không.
> Tôi thấy hiện tại nó khá là AI và có vẻ chưa ở góc độ trải nghiệm người dùng lắm. Tôi muốn người dùng mới lẫn cũ có thể
> sạch về trải nghiệm từ đa thiết bị đến rõ ràng về func của app. Người dùng chủ yếu là các 16+ đã có kinh nghiệm dùng các
> web app tương tự, phần trẻ em nên là một phần nhỏ, cần nó nếu user là bố mẹ cần quản lý (số ít)."

Đây là lần đầu định vị người dùng **không** phải "cả nhà" làm mặc định. Những đợt trước (`launch-review`) đã làm tốt phần
an toàn, câu chữ, PWA, bố cục cơ bản; nhưng chúng được thiết kế cho một sản phẩm gia đình, nên bề mặt hiện tại nói với
người 16+ rằng đây là "app cho bé". Khoảng cách đó không sửa được bằng vài câu chữ; nó là chuyện định vị, bố cục và nội
dung.

## Người dùng

**Chính — 16+, đã quen web app**

- Đã dùng Poki, CrazyGames, Coolmath, Roblox, itch.io, Discord, TikTok, Zalo.
- Quen: mở là thấy game, cuộn là thấy lựa chọn, tìm kiếm, chơi ngay, toàn màn hình, dark mode.
- Không kiên nhẫn với: landing page giải thích, đăng nhập trước khi chơi, chữ "bé", "bố mẹ", tuổi mầm non, giao diện
  giống app trẻ con.
- Quan tâm: game gì, chơi bao lâu, chơi với ai, có quảng cáo/xu không, có lưu tiến độ không, có rủ bạn được không.

**Phụ — phụ huynh có con nhỏ (số ít)**

- Cần: hồ sơ cho con, PIN, giới hạn nội dung/thời gian, biết dữ liệu ở đâu, không quảng cáo.
- Không cần: toàn bộ sản phẩm nói bằng giọng "bố mẹ"; họ tìm thấy phần quản lý khi cần.

**Không phải người dùng chính:** trẻ em tự mở và tự dùng một mình. Trẻ vẫn chơi được, nhưng sản phẩm không được thiết kế
quanh trẻ.

## Điều đúng, phải giữ

- Mở là chơi; không quảng cáo, không xu, không bán gì trong game.
- Không cần tài khoản; tiến độ trên máy; đăng nhập khi muốn giữ trên nhiều máy.
- Chơi cùng qua link, mỗi người một máy, ghế trống có máy chơi thay.
- Trang game có bảng sự thật, cách chơi, câu hỏi — hơn hầu hết cổng game.
- Giọng Việt ấm, câu ngắn, không áp lực, không dark pattern.
- PWA, offline, dark mode, safe area, bàn phím, screen reader.

## Điều cần thay

- **Trang chủ là landing page giới thiệu**, không phải bề mặt sản phẩm: 5 giây đầu thấy logo, chữ, hai nút; không thấy
  game nào; cuộn 6 section mới hết. Người 16+ đến để chơi, không đến để đọc.
- **Định vị "cả nhà" là mặc định**: tiêu đề, mô tả, section "Cho bé và bố mẹ", FAQ "Bố mẹ hay hỏi", chip "Từ 3 tuổi".
  Người 16+ thấy mình không thuộc về đây.
- **Catalog là lưới icon to**: 5 ô vuông, không ảnh bìa, không mô tả, không thể loại, không tìm kiếm; desktop trống một
  nửa màn; chỉ thấy "Rủ bạn", không thấy "Chơi".
- **Trang game là bài viết**: icon nhỏ, bảng facts, cách chơi, FAQ; không ảnh gameplay, không clip, không "chơi thử".
- **Màu cam Tailwind + card bo tròn đồng nhất + section icon–tiêu đề–đoạn văn** là bộ dấu hiệu "AI" rõ nhất.
- **Nội bộ lộ ra**: SHA build ở cuối trang Tôi; "Dữ liệu kỹ thuật" ngay màn đăng nhập.
- **Cửa vào đang hỏi đăng nhập trước**: "Chơi thử trên máy này" là nút phụ; người 16+ muốn chơi trước.

## Done khi

- Người mới trên điện thoại: trong **5 giây** nói được "đây là sạp game nhỏ, bấm vào game là chơi"; trong **10 giây** đã
  vào game đầu tiên.
- Người quay lại: thấy "Chơi tiếp [game]" kèm ảnh bìa, một chạm là vào; không phải nhớ tên game.
- 360 / 390 / 768 / 1024 / 1440 px, dọc và ngang, sáng và tối: không cắt chữ, không nút dưới nếp gấp, không khoảng trống
  vô lý.
- Người 16+ thấy sản phẩm dành cho mình; phụ huynh tìm thấy phần quản lý mà không phải đi qua nó.
- Không còn dấu hiệu "AI" dễ thấy: landing template, lưới feature icon, các bước 1–2–3, FAQ trên trang chủ, palette một
  màu, ảnh giả.
- Có số đo: thời gian từ trang đầu đến lần chạm đầu trong game; tỉ lệ chơi trong 30 giây; số game mỗi phiên; quay lại
  D1/D7; đăng nhập sau khi chơi.

## Không nằm trong plan này

- Làm game mới, sửa luật chơi, thêm chế độ chơi.
- Chat trong bàn, kết bạn, moderation cộng đồng.
- Thanh toán, quảng cáo, subscription.
- Đổi backend/API trừ phần tối thiểu để có ảnh bìa/ảnh chụp game.
- Viết lại toàn bộ Điều khoản/Quyền riêng tư (E-05 của `launch-review` vẫn giữ).

## Owner đã chốt (2026-10-31)

1. **Đồng ý** hướng A: giữ tên Tò He và chất "đồ chơi nặn tay"; "sạp" là mặt tiền/ẩn dụ, không đổi tên.
2. Trang chủ **như prototype**: sạp game (hero + shelf + tất cả), không phải landing page.
3. **Giữ cửa**, nhưng **"Chơi ngay" lên trước**; cân bằng người cũ (Chơi tiếp/đăng nhập) và người mới (thử ngay);
   cần thiết kế **luồng gợi ý đăng ký/đăng nhập sau khi chơi**.
4. **Đồng ý**: gia đình trong `Tôi` + `/family`, không tách app.
5. **Screenshot + khung tạm** trước; chưa thuê vẽ cover.
6. Tab đổi thành **"Sạp"**.

## Câu hỏi mở

Không còn câu hỏi định vị. Còn chi tiết triển khai (copy cuối, token màu qua test tương phản, contract `coverUrl`) — xem
[design.md](design.md) và graduation list ở [PLAN.md](PLAN.md).
