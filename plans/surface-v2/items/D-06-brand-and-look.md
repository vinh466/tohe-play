# D-06 — Brand và design language: giấy, mực, gấc, nghệ, lá

- Status: **decided** — owner, 2026-10-31, chat: "1. dong y nha" + "2. nhu prototype trông ổn nha"
- Kind: decision
- Blocks: E-03 · Blocked by: D-01
- Decided: owner, 2026-10-31

## Why it matters

Palette hiện tại là dải orange của Tailwind; mọi thứ là card trắng bo tròn, bóng mờ. Đó là bộ dấu hiệu "AI" rõ nhất, và
nó không có gu. Cần một hệ có chủ đích, đọc được ở light/dark, và không trẻ con.

## Decision

Theo `prototype/concept.css` (giá trị sẽ qua test tương phản trước khi thành token):

- **Màu**: giấy `#F6EFE3`, surface `#FFFDF8`, mực `#201A16`, đỏ gấc `#C8402A` (hành động), nghệ `#D99A2B` (mới/đang
  chú ý), lá `#3E6B4F` (chơi cùng/online), line `#E4D5C3`; dark: than ấm `#171310`, surface `#221C18`, brand sáng hơn.
- **Chữ**: Be Vietnam Pro cho UI; display Be Vietnam Pro 800/900, tracking âm nhẹ; wordmark vẽ tay "Tò He" (một lần).
- **Hình khối**: card bán kính 10–14px, viền mực 1.5px, offset shadow 2–3px; nút chính đỏ gấc, pressed dịch xuống;
  tem/sticker cho "Mới", "2–4 người", "Offline"; không gradient, không glow, không bóng mờ rộng.
- **Ảnh**: cover 16:9 là đơn vị chính; icon 1:1 chỉ ở header/PWA; screenshot/clip cho trang game.
- **Chuyển động**: chỉ phản hồi (hover nhấc 2px, ảnh zoom 1.02, press); bỏ `animate-pop-in` delay từng card; tôn trọng
  `prefers-reduced-motion`.
- **Dark mode**: giữ ảnh, thêm viền; không pure black; kiểm tương phản.

## Consequences

- `packages/design-tokens/tokens.css` + `contrast.test.ts`; cập nhật `theming.md`, `voice-and-look.md`.
- Component primitives: `GameCard`, `Cover`, `Button`, `Tag`, `Shelf`, `SectionRule`; thay card trắng đồng nhất.
- ADR 0049 sửa (look) + ADR 0057 (định vị).
- Không dùng palette Tailwind; token test giữ.

## Discussion

**owner** (2026-10-31): "1. dong y nha" · "2. nhu prototype trông ổn nha"
