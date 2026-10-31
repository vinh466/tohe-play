# D-04 — Trang game công khai: store page, ảnh, facts, tuổi

- Status: **decided** — owner, 2026-10-31, chat: "2. nhu prototype trông ổn nha" + "5. screenshot + khung tạm"
- Kind: decision
- Blocks: — · Blocked by: D-08
- Decided: owner, 2026-10-31

## Why it matters

`/games/<id>/` là trang người lạ và công cụ tìm kiếm thấy. Hiện tại nó là bài viết: icon 96 px, nút Chơi, bảng facts,
cách chơi, FAQ; không ảnh gameplay.

## Decision

Theo `prototype/game.html`:

1. **Cover hero 16:9** + tên + hook + `Chơi ngay` + `Rủ bạn`.
2. **Facts dạng chip**: 1 người, 5 phút, offline, không quảng cáo, có bảng xếp hạng.
3. **Ảnh chụp**: 3 ảnh (hoặc clip muted 6–10 giây) — trước mắt là screenshot + khung tạm.
4. **Cách chơi**: 3 bullet; bảng facts đầy đủ giữ ở dưới cho ai muốn đọc.
5. **Trò khác**: 3 card.
6. **Tuổi** chuyển xuống "Phù hợp" hoặc `/family`; không đặt cạnh tên game.
7. **Nút Chơi dính đáy** trên mobile sau khi cuộn qua hero.
8. Giữ JSON-LD `VideoGame`, breadcrumb, OG image.

## Consequences

- `GamePage.astro` + `game-page.ts`; `games/<id>/page/` cần cover/shots (D-08).
- `apps/web` build copy ảnh; `generate:og` vẫn giữ.
- Không đổi route; `/play/<id>` vẫn là nơi chơi.

## Discussion

**owner** (2026-10-31): "2. nhu prototype trông ổn nha" · "5. screenshot + khung tạm tạm thời đi"
