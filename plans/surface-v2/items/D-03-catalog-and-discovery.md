# D-03 — Catalog và khám phá: cover, search, tag, tab "Sạp"

- Status: **decided** — owner, 2026-10-31, chat: "6. Sạp đi" + "2. nhu prototype trông ổn nha"
- Kind: decision
- Blocks: E-01 · Blocked by: D-01, D-08
- Decided: owner, 2026-10-31

## Why it matters

`/play` là màn chính của người chơi. Hiện tại nó là lưới 5 icon vuông to, không cover, không search/tag, không thấy nút
Chơi; desktop trống nửa màn.

## Decision

- Tab đổi từ **Trò chơi** thành **Sạp** (en: **Shelf** hoặc **Games** — chốt khi viết copy).
- **Card cover-first**: ảnh 16:9, tên, một dòng hook/tag, **nút Chơi hiện rõ**; cả card click được; "Rủ bạn" là phụ.
- **Search + 4 tag**: Giải đố, Bài, Phản xạ, Chơi cùng. Với 5 game, lọc nhanh là đủ; không cần full-text index.
- **Shelf**: Chơi tiếp → Bàn đang ngồi → Gần đây → Tất cả.
- **Desktop 4–6 cột**, card 220–280 px, không kéo 5 card thành 5 ô to; **mobile 2 cột**.
- **Empty state**: "Sạp mở rồi. Chọn một trò." + 3 cover.
- **Bỏ tuổi** khỏi card mặt tiền; tuổi ở `/family` và bảng facts.

## Consequences

- `CatalogPage.tsx`, `GameIcon`, `ContinueTile`, i18n `frame.games`.
- Cần `coverUrl` trong `GameSummary` (D-08); trước mắt dùng khung 16:9 + screenshot/icon.
- Test: routes, tabs, e2e smoke; ảnh ở 360/768/1440; axe.

## Discussion

**owner** (2026-10-31): "6. Sạp đi" · "2. nhu prototype trông ổn nha"
