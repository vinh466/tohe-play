# D-08 — Nội dung game: screenshot + khung tạm, cover về sau

- Status: **decided** — owner, 2026-10-31, chat: "5. screenshot + khung tạm tạm thời đi"
- Kind: decision
- Blocks: D-03, D-04 · Blocked by: —
- Decided: owner, 2026-10-31

## Why it matters

Không có ảnh thì không có sạp. Hiện tại `GameSummary` chỉ có `iconUrl` (1:1); catalog và trang game không có ảnh gameplay.

## Decision

- **Trước mắt**: dùng **screenshot game** (chụp màn hình, crop 16:9) đặt trong **khung tạm** thống nhất (viền, tỉ lệ, tem).
  Chưa thuê vẽ cover.
- **Sau**: khi có tranh, thay từng ảnh, không đổi bố cục.
- **Convention đề xuất**:
  - `games/<id>/page/cover.png` — 16:9, ảnh chính.
  - `games/<id>/page/shot-1.png` … `shot-3.png` — ảnh chụp.
  - `games/<id>/page/facts.json` thêm `hook` (≤ 60 ký tự) và `tags` (2–3).
- **API**: `GameSummary.coverUrl` (và có thể `shotUrls`) — nếu chỉ là convention thì API suy ra từ id; nếu phải sửa contract
  thì làm ADR + docs + conformance.
- **Icon 1:1** giữ cho PWA/header; **tuổi** không lên card mặt tiền.

## Consequences

- `apps/web/src/content/games.ts` + `game-page.ts` đọc cover/shots; `apps/web` copy ảnh.
- `services/api` catalog thêm `coverUrl`; `apps/hub` `GameSummary` + `GameCard`.
- `games/<id>/page/` có thêm ảnh; `generate:og` vẫn dùng ảnh OG riêng.
- Kiểm: ảnh 16:9 không méo; alt text; dark mode; LCP.

## Discussion

**owner** (2026-10-31): "5. screenshot + khung tạm tạm thời đi"
