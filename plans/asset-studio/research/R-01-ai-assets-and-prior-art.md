# R-01 — AI tạo asset game, và cách các nền tảng quản lý asset tập trung

- Date: 2026-10-22 · Feeds: D-02, D-05, D-06, D-07, D-08, D-10

## Question

AI tạo được asset game tới mức nào? Có công cụ nào agent gọi trực tiếp được không? Các nền tảng lớn quản lý và phân phối
asset dùng chung ra sao? Pack miễn phí nào dùng được? Lưu file lớn trên GitHub tốn bao nhiêu? Asset do AI tạo có bản
quyền không?

## Findings

**AI tạo asset**

- Claude (agent của Tò He) **không tạo được ảnh raster**. Nó viết được SVG, hình vẽ bằng code, và toàn bộ content dạng
  data. (Biết từ chính công cụ đang dùng.)
- Một bài tổng hợp 2026 (do vendor viết, nên cần cân nhắc) cho rằng tiêu chí đúng là: đọc rõ ở kích thước thật, đủ cỡ
  sprite, **cùng một nhân vật qua các frame** idle, walk, attack, và có xuất sprite sheet hay atlas. Kết luận của bài:
  AI hợp cho prototype và placeholder; nhân vật chính và animation final vẫn cần người chỉnh. [1]
- **PixelLab có MCP server**, kết nối bằng HTTP với bearer token, dùng được từ Claude Code. Công cụ gồm: tạo nhân vật 4
  hoặc 8 hướng, animate nhân vật có sẵn, tạo Wang tileset, tạo tile isometric. Ngoài ra có package cộng đồng
  `pixellab-mcp` (style transfer, inpainting), nhưng không rõ có phải bản chính thức không. Tạo nhân vật và tileset tốn
  nhiều lượt hơn trong gói thuê bao. [2]
- **Scenario** train model riêng từ 10–30 ảnh mẫu để giữ một style, và gọi qua API. Chưa thấy MCP server. [3]

**Pack miễn phí**

- Kenney **Tiny Farm**: CC0, 16×16, khoảng 130 file, dành cho farm RPG và roguelike. Kenney **Isometric Miniature
  Farm**: CC0 1.0 (theo trang itch.io), có mẫu Tiled. **RPG pack base set**: CC0, 32×32. [4]

**Tiền lệ quản lý tập trung: Roblox Creator Store**

- Asset được người và máy duyệt cả trước lẫn sau khi publish. Duyệt có thể mất tới 24 giờ. Tài khoản đã xác minh được
  publish nhiều hơn.
- **Cấm** code tải asset từ xa lúc chạy (`require(assetId)`, `InsertService:LoadAsset()`).
- Asset có revision; API tải về mặc định lấy bản mới nhất, nhưng cho chọn version. [5]

**Lưu trữ trên GitHub**

- Git LFS, GitHub Free/Pro: **10 GiB lưu trữ và 10 GiB băng thông mỗi tháng**. Tải file LFS (kể cả CI checkout) là trừ
  băng thông của chủ repo. Vượt quá thì tính tiền, hoặc bị chặn nếu ngân sách là $0. [6]

**Bản quyền asset do AI tạo**

- US Copyright Office, *Copyright and AI* Part 2 (2025-01-29): output chỉ được bảo hộ khi có phần biểu đạt do người
  tạo; prompt không đủ để thành tác giả. Người chỉnh sửa hay sắp đặt sáng tạo thì phần đó được bảo hộ. [7]

## Assumptions

- Điều khoản thương mại và phân phối lại của PixelLab, Scenario và các model ảnh khác **chưa tra**. Cách kiểm: đọc ToS
  từng vendor trong D-10.
- Chất lượng thật của PixelLab với style Tò He **chưa thử**. Cách kiểm: tạo thử vài asset trong E-07, nếu owner duyệt
  ngân sách.
- Luật Việt Nam về tác phẩm do AI tạo **chưa tra**.

## So what

- **D-02:** cách Roblox cấm tải từ xa lúc chạy, cho chọn version và duyệt trước khi public củng cố lựa chọn C.
- **D-05:** pack CC0 được phát hành theo bộ cùng style, nên chọn pack làm đơn vị phát hành.
- **D-06:** LFS có hạn mức, nên P0 dùng git thường có giới hạn, file lớn chờ object storage. (Owner sau đó chọn object storage + DB ngay từ đầu, xem D-06.)
- **D-07:** asset thuần AI có thể không có bản quyền, nên cần ghi nguồn gốc và có người duyệt.
- **D-08 / D-10:** đồng bộ style là điểm yếu nhất. Công cụ giữ style (model riêng, art bible, hậu xử lý cố định) quan
  trọng hơn chuyện chọn model nào.

## Sources

1. [Best AI pixel art generators 2026 (LlamaGen)](https://llamagen.ai/en-au/articles/best-ai-pixel-art-generators-2026)
2. [PixelLab MCP (Glama)](https://glama.ai/mcp/servers/@samedii/PixelLab) · [pixellab-mcp (npm)](https://npmjs.com/package/pixellab-mcp)
3. [Scenario docs](https://docs.scenario.com/get-started/documentation/integrating-with-applications-real-world-scenarios) · [Scenario: custom style models](https://www.scenario.gg/post/training-custom-inventory-style-ai-models-for-enhanced-game-development)
4. [Tiny Farm (gamedev.net)](https://gamedev.net/news/4237-tiny-farm/) · [Isometric Miniature Farm (itch.io)](https://kenney-assets.itch.io/isometric-miniature-farm) · [RPG pack base set (OpenGameArt)](https://opengameart.org/content/rpg-pack-base-set)
5. [Roblox Creator Store](https://create.roblox.com/docs/production/creator-store) · [moderation](https://create.roblox.com/docs/marketplace/moderation.md)
6. [GitHub: Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
7. [US Copyright Office: Part 2 released](https://copyright.gov/newsnet/2025/1060.html)
