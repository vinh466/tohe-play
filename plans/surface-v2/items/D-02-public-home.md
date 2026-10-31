# D-02 — Trang chủ công khai: sạp game như prototype

- Status: **decided** — owner, 2026-10-31, chat: "2. nhu prototype trông ổn nha"
- Kind: decision
- Blocks: E-05 · Blocked by: D-01
- Decided: owner, 2026-10-31

## Why it matters

`/` là ấn tượng đầu tiên. Hiện tại nó là landing page 6 section, không cho thấy game nào trong 5 giây. Người 16+ đến để
chơi, không đến để đọc.

## Decision

Theo `prototype/home.html`:

1. **Hero là một game**, không phải logo: cover 16:9, tên, một câu hook, `Chơi ngay` + `Rủ bạn`.
2. **"Đang mở"**: 3–4 game, danh sách ngắn bên cạnh hero (desktop), ẩn trên mobile.
3. **Dải tin một dòng**: không quảng cáo · không cần tài khoản · lưu trên máy này.
4. **"Chơi tiếp"** (nếu máy đã chơi): card rộng có cover, tên game, `Tiếp tục`.
5. **"Mới tuần này"**: 4 card cover.
6. **Band "Rủ bạn"**: `Tạo bàn` + `Nhập mã`, nền mực, một câu.
7. **"Tất cả trò chơi"**: 5 card + tag lọc.
8. **Bỏ khỏi `/`**: "Tò He có gì", "Chơi thế nào", "Cho bé và bố mẹ", "Cài như một app", "Bố mẹ hay hỏi", banner CTA cuối.
   Chuyển sang `/about`, `/family`, `/faq/`, `/guides/`.

## Consequences

- `apps/web/src/views/HomePage.astro` + `content/home.ts` viết lại; ảnh bìa tạm từ screenshot.
- `/games/` vẫn giữ cho SEO và link trực tiếp; `/about`, `/family`, `/faq/`, `/guides/` nhận nội dung cũ.
- Giữ JSON-LD `WebSite` + `Organization`; thêm `ItemList` cho game nếu hợp.
- SEO: `/` không còn bài giới thiệu dài; bù bằng `/about` + `/family` + `/games/` có nội dung thật.

## Discussion

**owner** (2026-10-31): "2. nhu prototype trông ổn nha"
