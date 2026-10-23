# D-01 — Game phụ thuộc nền tảng tới đâu, và ai quyết?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-02 · Blocked by: —
- Decided: owner, chat 2026-10-22: "ok chốt"

## Why it matters

Game có thể rất khác nhau: một game nhỏ chạy một mình, offline, hay một RPG tải map theo chương. Một luật cứng duy nhất
("mọi thứ phải bundle", hoặc "mọi thứ lấy từ Studio") sẽ chặn một nhóm game. Không có luật nào thì nền tảng mất kiểm
soát về an toàn, offline và replay.

## What is true today

Contract đã đi theo cách "game khai báo, nền tảng kiểm":

- `capabilities` (`packages/contract/src/manifest.ts:167`): `save`, `scores`, `rooms`, `shell`, `ranked`. Lời gọi không
  khai báo thì bị từ chối.
- `identity` (ADR 0045): `play` là `any`, `named` hay `account`. Game nói mình cần định danh tới mức nào, hub lo phần còn
  lại.
- `orientation`, `themes`, `sizeBudgetKb`: game khai báo, conformance kiểm.

## Options

### A — Nền tảng quy định một cách cho mọi game

Đơn giản và dễ test. Nhưng game đa dạng thì bị bó: hoặc tất cả cùng nặng, hoặc tất cả phải bundle hết.

### B — Game khai báo mức phụ thuộc; nền tảng cung cấp các mức đó và giữ rào

Game chọn trong những gì nền tảng mở ra. Những gì không thương lượng được (an toàn, nguồn tải, tính bất biến, kiểm
duyệt) thì không game nào đổi được. Conformance kiểm đúng điều game khai báo.

## Recommendation

B. Đây là cách contract đang làm (`capabilities`, `identity`), giờ chỉ đặt tên và mở rộng nó.

## Decision

**B**, theo lời owner:

> "nền tảng ta sẽ hỗ trợ và game sẽ tự quyết định mức độ phụ thuộc [...] đó là lựa chọn của game, game sẽ tự xử lý để
> đảm bảo vận hành của chính nó và nó contract rõ với nền tảng, nền tảng thì cũng cấp mở hơn (... có thể là cách tiếp
> cận này cho các vấn đề khá, chủ yếu là ý tưởng rõ ràng trong phụ thuộc để game đa dạng và mở hơn)"

Chốt: "ok chốt" (2026-10-22).

**Hệ quả:**

- Một ADR riêng cho nguyên tắc này, viết lúc graduate. Nó tổng quát hoá `capabilities` và `identity` và là căn cứ cho
  D-02.
- Mỗi mức mà game được chọn phải có bài conformance riêng (chi phí test được chấp nhận: D-02).
- Cách game khai báo dùng lại cho các vấn đề khác về sau (nhập liệu, mạng, tài nguyên). Plan này chỉ áp dụng cho asset.

## Discussion

**agent** (2026-10-22): nguyên tắc có hai nửa: *game chọn* và *nền tảng giữ rào*. Bảng rào cho asset nằm ở D-02. Mỗi
lần áp nguyên tắc này cho một vấn đề mới thì phải viết bảng rào của vấn đề đó trước khi mở lựa chọn cho game.
