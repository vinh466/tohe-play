# D-13 — Phục vụ `precache` và `on-demand` lúc chạy thế nào?

- Status: **deferred** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: — · Blocked by: D-02, E-06
- Decided: owner, chat 2026-10-23: "ok chốt theo đề xuất ổn" (để sau)

## Why it matters

D-02 đã chốt ba chế độ tải. Hai chế độ chạy lúc chơi (`precache`, `on-demand`) cần đường dẫn trên games origin, service
worker, hạn mức lưu trữ trên máy, nhãn "cần mạng" của hub và cách xử lý khi tải lỗi.

## What is true today

- Spike S1 (service worker của games origin trong iframe, iOS, PWA) chưa chạy (`docs/roadmap/walking-skeleton.md:36`).
- Chưa có game nào cần tải theo chương hay cần nhạc dài.

## Decision

**Để sau.** P0 chỉ có `bundle`.

**Mở lại khi** cả hai điều sau đều đúng:

1. Spike S1 (E-06) có kết quả.
2. Có game đầu tiên cần `precache` hoặc `on-demand`.

Khi mở lại thì bắt đầu từ thiết kế đã có trong D-02 và design §3 E: file đặt ở `/assets/<hash>` trên games origin, lấy
từ bucket qua Cloudflare `immutable`; conformance tải xong rồi cắt mạng.

Thêm giá trị mới cho `delivery` là thay đổi additive, không đổi số protocol
(`docs/contracts/game-contract-v1.md`, *Versioning*).
