# D-02 — Domain lâu dài của Tò He là gì, và đổi lúc nào?

- Status: **decided** (2026-10-19, chat) — **A**: `toheplay.io.vn` là domain duy nhất, lâu dài
- Kind: decision
- Blocks: D-01 (tên trong cấu hình), E-05 · Blocked by: —
- Decided: owner, 2026-10-19, chat — xem *Decision*

## Vì sao

Agent hiểu câu "chúng ta plan có domain riêng sau này" là có thể sẽ có một domain thương hiệu khác, nên hỏi lại trước khi
chốt bố cục. Đổi origin của hub sau khi đã có người dùng làm mất app đã cài, phiên, tiến độ của khách, link và QR cũ
([R-02](../research/R-02-hosts-seo-geo.md)).

## Phương án (lúc đề xuất)

| | Cách | Giá |
|---|---|---|
| **A** | `toheplay.io.vn` là domain lâu dài | 0 |
| B | Mua domain thương hiệu, chuyển trước khi mời người ngoài | một domain/năm + một buổi cấu hình |
| C | Chuyển sau khi đã có người dùng | mất app đã cài, phiên, tiến độ khách; làm lại uy tín gửi thư |

## Decision

**owner** (2026-10-19, chat): "toheplay.io.vn sẽ là domain duy nhất, sản phẩm ta sẽ build up trên đây, ý của tôi là đinh
hướng sản phẩm sẽ nằm duy nhất 1 domain (và chia nhìu subdomain), ổn chứ".

**agent**: ổn. Hệ quả:
- Không cần đường chuyển domain; bố cục D-01 dùng thẳng `toheplay.io.vn`.
- "Chia nhiều subdomain" đúng cho các **vai khác nhau** (game không tin được, tài liệu kỹ thuật, sau này `admin.`,
  `status.`…). Phần người chơi thấy — trang công khai và app — vẫn nên ở **cùng một host** (gốc): PWA, cookie phiên và
  tiến độ của khách gắn với một origin, và Google/AI coi một sản phẩm là một chỗ (D-01).
- Gửi thư từ subdomain (`notify.toheplay.io.vn`, Resend khuyên): không gấp; làm khi lượng thư tăng hoặc khi cần thư
  marketing tách khỏi thư giao dịch.
