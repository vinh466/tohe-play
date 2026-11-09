# Log — RPG thẻ bài treo máy

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

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
