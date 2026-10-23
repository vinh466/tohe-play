# D-03 — Content của game (item, cây, quest, hội thoại) nằm ở đâu, nền tảng giúp gì?

- Status: **decided** (owner: "tạm chốt") (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-03 · Blocked by: —
- Decided: owner, chat 2026-10-22: "1. 3. 4., ok cái nay tam chot dc do"

## Why it matters

Game nhiều content cần thêm cây, item, NPC mà không phải sửa engine. Agent làm tốt nhất khi chỉ phải viết data có
schema.

## What is true today

- Luật của game là logic thuần, có test và bot chơi thử (`games/merge-block/src/logic.ts`,
  `games/tien-len/src/rules.ts`; theo quy trình `/new-game`).
- Save tối đa 64 KB JSON (`docs/contracts/game-contract-v1.md:254`).
- Build bất biến; ranked và rooms chạy lại luật trên server (ADR 0016, 0030).

## Options

### A — Content trong build của game, nền tảng cung cấp công cụ

Data (JSON hoặc TS) nằm trong folder của game, theo schema Zod, có kiểm tham chiếu (mọi id được nhắc tới đều tồn tại).
Muốn thêm content thì ra version mới.

### B — Content do nền tảng phục vụ lúc chạy (live ops)

Đổi content không cần build lại. Nhưng phá tính bất biến và replay, và cần thêm hạ tầng.

## Recommendation

A. Game tự quản content của mình. Nền tảng cho công cụ: `@tohe/game-kit/content` (schema, loader, test helper) và một
bài kiểm content trong conformance (E-03).

## Decision

**A**. Owner hỏi: "highlevel thì đây là dạng game tự quản lý ha, cần/nên tảng hỗ trợ chũng k". Agent trả lời: game tự
quản, nền tảng cho công cụ. Owner chốt: "tạm chốt" (2026-10-22).

**Hệ quả:** E-03. Hình và âm thanh của content (icon item, sprite cây) đến từ Studio qua D-12. Content chỉ giữ **key**
trỏ tới asset, không giữ file.

## Discussion

**agent** (2026-10-22): giới hạn save 64 KB chỉ xem lại khi pilot (E-07) chạm tới. Không nới trước.
