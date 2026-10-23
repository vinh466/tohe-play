# Brief cho hoạ sĩ — bộ hình "Xưởng tò he"

- Viết bởi: agent, 2026-10-24, theo [ADR 0049](../../docs/decisions/0049-a-crafted-toy-voice-and-look.md) (owner chốt D-07)
- Người nhận: hoạ sĩ minh hoạ owner thuê. Owner gửi nguyên văn trang này (có thể bỏ mục "Cho agent" ở cuối).

## Tò He là gì

Tò He (https://toheplay.io.vn) là một góc nhỏ gồm những trò chơi đơn giản trên điện thoại và máy tính, cho cả nhà
người Việt: trẻ em chơi, bố mẹ yên tâm. Không quảng cáo, không bán gì. Tên lấy từ **tò he**, con giống nặn bằng bột gạo
nếp nhuộm màu ở làng Xuân La: nhỏ, tròn, bóng, nhiều màu, nặn nhanh bằng tay. Chúng tôi muốn mọi hình trong Tò He trông
như được **nặn từ bột tò he**, không như hình vẽ máy móc hay emoji.

## Cần vẽ

| # | Hình | Số lượng | Dùng ở đâu |
|---|---|---|---|
| 1 | **Avatar con giống** — mỗi con là một con tò he, nhìn thẳng, nửa người hoặc cả người, nét mặt vui | 16 | Hồ sơ người chơi: ô tròn 40–160 px, và lớn ở màn "Vẫn là …? Chơi tiếp" |
| 2 | **Ảnh bìa trò chơi** — một con tò he hoặc một vật chính ở tiền cảnh, gợi đúng trò chơi, **không có chữ** | 4 | Ô trò chơi trong app và trang công khai, ảnh xem trước khi gửi link (Zalo, Messenger) |
| 3 | **Linh vật** — một con tò he "chủ xưởng" (gợi ý: một cậu bé/cô bé tò he cầm que bột, hoặc một chú gà tò he), 4 tư thế | 4 | Màn trống ("chưa có bàn nào"), đang tải, mất mạng, chúc mừng |

**16 con giống** (giữ đúng thứ tự — tên gợi ý của người chơi đi kèm con vật, nên hình phải đúng con):

Cáo · Gấu trúc · Hổ · Ếch · Chim cánh cụt · Koala · Sư tử · Thỏ · Mèo · Chó · Kỳ lân · Bạch tuộc · Rùa · Khủng long ·
Ong · Cú

**4 trò chơi** (mở trên https://toheplay.io.vn/games/ để xem):

- **Ghép Khối** — thả khối số xuống cột, hai khối cùng số gộp lại (2 + 2 → 4…).
- **Chạm Ghép** — chạm vào một nhóm khối số giống nhau để gộp cả nhóm.
- **Tiến Lên** — bài Tiến lên miền Nam, chơi với bạn máy hoặc cả nhà mỗi người một máy.
- **Chạm Chấm** — chạm thật nhanh vào chấm tròn trong 20 giây.

## Phong cách

- **Chất liệu bột tò he**: khối tròn mềm, bề mặt bóng nhẹ, nét nặn bằng tay (vết miết, viền hơi không đều), que tre
  cắm phía dưới là được nhưng không bắt buộc. Tránh nét vector cứng, bóng đổ kiểu 3D bóng loáng, hay kiểu emoji.
- **Màu nhuộm truyền thống**: trắng gạo, đỏ gấc, vàng nghệ, xanh lá, đen than — có thể thêm vài sắc trung gian; tránh
  màu neon và tím/xanh lam lạnh làm chủ đạo.
- **Một bàn tay cho cả bộ**: cùng tỉ lệ đầu–thân, cùng kiểu mắt, cùng độ bóng. Các con khác nhau ở hình dáng và màu,
  không ở phong cách.
- **Dễ đọc ở cỡ nhỏ**: ở 40 px vẫn nhận ra con gì — hình khối rõ, ít chi tiết vụn.
- **Nền sáng và nền tối**: app có chế độ tối (nền gần đen ấm #17110e). Mỗi hình phải đứng được trên cả nền sáng (kem
  #fff7ed) lẫn nền tối — thường chỉ cần nền trong suốt và một viền sáng mảnh hoặc bóng nền nhẹ; nếu cần thì giao thêm
  bản cho nền tối.
- **Không chữ** trong hình (tên trò chơi do app viết bằng font Be Vietnam Pro).
- Trẻ em xem: không đáng sợ, không vũ khí, không dấu hiệu tôn giáo, chính trị, thương hiệu khác.

## Giao file

- **Định dạng**: SVG (ưu tiên) hoặc PNG 2048 × 2048 nền trong suốt; kèm file nguồn có lớp (AI, Affinity, Procreate,
  PSD…).
- **Khung**: avatar và linh vật vuông 1:1, chủ thể nằm trong vòng tròn 80% ở giữa (app cắt tròn). Ảnh bìa vuông 1:1,
  thêm bản 1200 × 630 cho ảnh xem trước link (chủ thể lệch trái hoặc giữa, chừa chỗ).
- **Tên file**: `avatar-cao.svg`, `avatar-gau-truc.svg` …, `cover-ghep-khoi.svg` …, `mascot-empty.svg`,
  `mascot-loading.svg`, `mascot-offline.svg`, `mascot-cheer.svg`; bản nền tối thêm `-dark`.
- **Quyền**: Tò He được dùng, sửa, thu nhỏ, cắt và phát hành các hình này không giới hạn trong sản phẩm, trang công khai
  và tài liệu; hoạ sĩ được ghi tên trong trang Giới thiệu và được dùng hình trong portfolio.
- **Các vòng duyệt**: (1) phác thảo 3 con (Cáo, Ếch, Ong) + 1 ảnh bìa để chốt phong cách; (2) cả bộ bản màu; (3) chỉnh
  sửa và giao file cuối.

## Cho agent (không cần gửi hoạ sĩ)

Khi nhận file: kiểm tên, cỡ, nền trong suốt, độ rõ ở 40 px, cả hai nền; nén (SVGO hoặc PNG → WebP/AVIF), đưa vào
`packages/design-tokens` hoặc thư mục ảnh của hub (namespace trong `@tohe/routes` nếu là đường dẫn mới), thay avatar emoji
theo `apps/hub/src/session/animals.ts` (giữ đúng thứ tự), ảnh bìa vào `games/<id>/` và vẽ lại ảnh xem trước bằng
`generate:og`; rồi làm phần còn lại của S3 (bảng màu từ màu nhuộm, chuyển động "bóp bột", tiếng gõ bột).
