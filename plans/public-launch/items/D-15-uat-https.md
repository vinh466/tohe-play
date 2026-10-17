# D-15 — UAT có cần HTTPS và tên miền không?

- Status: **deferred** (2026-10-17, chat) — mở lại theo một trong ba điều kiện ở *Đề xuất*
- Kind: decision
- Blocks: — · Blocked by: D-04
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Vì sao câu hỏi đổi

Review trước đề xuất UAT có `https://tohe-uat.vinetic.io.vn`, vì Google không chấp nhận redirect URI là IP thô hoặc
HTTP (trừ localhost — [R-01](../research/R-01-auth-linking.md)). Owner đã chốt OAuth chỉ chạy ở prod (D-04), nên lý do
chính đó không còn.

## Lợi ích còn lại nếu làm

- Cài PWA lên màn hình chính và service worker trên điện thoại (ADR 0005 — hôm nay UAT không có).
- Cookie `Secure` trên UAT giống prod.
- Passkey sau này (cần secure context).

Cách làm nếu mở lại: tên miền trỏ IP nội bộ 10.100.0.2 (DNS-only), cert Let's Encrypt bằng DNS-01 qua API token của
Cloudflare; vẫn chỉ vào được qua WireGuard/LAN.

## Đề xuất của agent

**deferred**, mở lại khi một trong ba điều xảy ra: cần thử cài PWA trên điện thoại ở UAT, làm passkey, hoặc cần UAT
giống prod về cookie để bắt lỗi.

## Decision

**owner** (2026-10-17, chat): "còn lại ôn" — chấp nhận đề xuất để UAT HTTPS sang sau trong report cùng ngày.
