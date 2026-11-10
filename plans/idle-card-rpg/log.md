# Log — RPG thẻ bài treo máy

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

## 2026-11-10 — agent (pentagon board concept)

- R-11 + wireframe v4: board 6×3 ngũ giác, 9 ô/bên, 6 hero, 3 ô mở; trái/phải; card tối giản; deck dưới (Đường đi / Dự bị / Chiêu).
- Thắng tự sang màn, ribbon trong feed, không popup; thua là panel “tường” dưới, không chặn board.
- Chờ owner góp ý: 9 hay 12 ô, địa hình/lane, card có tên không, DOM/CSS hay Phaser.

## 2026-11-10 — agent (UI/UX v2)

- Owner chơi v1.0.0: UI lệch/chồng lấn, hơi lag. R-10 đo và thiết kế lại.
- Stage thành cột HUD/board/controls/dock; card vẽ sẵn texture, turn rail bằng portrait, số sát thương DOM, atlas 44 frame, maxDpr 1.25.
- Headless: p50 49.9→16.7ms (320), 50→33.3ms (360/390), long task gần như hết; layout test 320×380/360×452/390×652.
- Sheets gọn hơn; HUD vàng/tinh chất/cấp/đợt; dock Đội/Trang bị/Triệu hồi/Sổ tay/Hôm nay. Chờ chữ release.

## 2026-11-09 — agent (v1.0.0 release candidate)

- Full v1: 4 vùng × 12 màn, 20 hero, 20 quái + 4 boss, 10 mối nối, 44 portrait pixel, save v2.
- Tháp 40 tầng, expedition ngày, boss tuần, Thử Thách tuần, Khởi Hành 7 ngày; stage picker/codex/gear/daily sheets.
- `pnpm verify` xanh: API 610/610, mọi game build + conformance; balance sim qua 48 màn.
- Chờ chữ release của owner; chưa merge/tag/deploy.

## 2026-11-09 — agent (implementation starts)

- Platform P0a: save budget across contract/SDK/API/hub, persistent shell, FX player; docs/ADR 0059.
- Game `games/van-du-ky`: pure core, 6-hero/12-stage slice, Phaser board, team/hero/summon/offline sheets, public pages/OG.
- Conformance passes; `pnpm verify` all tasks except API parallel (local inotify limit); API 610/610 sequential.
- Next: C3/C5 polish (turn rail, codex/daily, SFX, full content), then C6 release candidate.

## 2026-11-09 — agent (brief confirmed + final scope)

- Owner chốt brief; plan chuyển **Converge**.
- D-07 earned gacha + pity; D-16 **20 hero / 20 quái / 4 boss / 2 event**; D-09/D-08/design/PLAN cập nhật.
- Graduation list provisional đã có: platform P0 → game spec → battle prototype → content → polish.
- Next: owner says start graduate; first step is the platform P0 ADRs + `games/van-du-ky/SPEC.md`.
