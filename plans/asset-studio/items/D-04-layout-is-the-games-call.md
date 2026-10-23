# D-04 — Màn dọc, màn ngang, desktop: ai quyết?

- Status: **decided** (owner: "tạm chốt") (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-04 · Blocked by: —
- Decided: owner, chat 2026-10-22: "1. 3. 4., ok cái nay tam chot dc do"

## Why it matters

Farming RPG muốn chạy tốt cả ở màn ngang. Game puzzle thường chỉ cần màn dọc. Bắt mọi game phải responsive thì tốn công
vô ích.

## What is true today

- `orientation`: `portrait` (mặc định), `landscape` hay `any` (`packages/contract/src/manifest.ts:166`).
- Kit dùng `Phaser.Scale.NONE` và tự resize theo DPR mỗi lần xoay, có `onResize` cho game
  (`packages/game-kit/src/phaser/game.ts:100`, `:171`).
- Conformance chỉ chụp màn 390×844 (`tools/conformance/src/run.ts:142`).
- Spike S3 (xoay màn hình và safe-area trong iframe) **vẫn mở** (`docs/roadmap/walking-skeleton.md:38`). iOS web không
  khoá được hướng màn hình.

## Options

### A — Nền tảng bắt mọi game responsive

### B — Game quyết; nền tảng làm cho việc đó rẻ

Kit có helper bố cục. Game khai báo `any` thì conformance chụp cả màn dọc, màn ngang và desktop.

## Recommendation

B.

## Decision

**B**, theo lời owner:

> "game nào cần thì làm, nếu game hướng tới màn đứng thì th (mà được thì nên vừa điện thoại/deskop, reponsive hợp lý thì
> ngon, ma k cũng được do game có thể đánh vào nhu cầu chính trước th là tối ưu r, nói chung là nên tảng ta mở cho làm,
> cần làm ntn thì game có quyết định của game)"

Chốt: "tạm chốt" (2026-10-22).

**Hệ quả:** E-04, gồm cả spike S3. Đây là một trường hợp của D-01: game khai báo `orientation`, conformance kiểm đúng
điều đó.
