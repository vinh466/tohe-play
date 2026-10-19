# D-02 — Domain lâu dài của Tò He là gì, và đổi lúc nào?

- Status: **proposed** (2026-10-19) — cần owner xác nhận ý định
- Kind: decision — đổi origin của hub → ADR (sửa ADR 0040) nếu đổi
- Blocks: D-01 (tên trong cấu hình; bố cục không đổi), E-05 · Blocked by: —
- Decided: —

## Vì sao

Owner (2026-10-19): "chúng ta plan có domain riêng sau này nên có thể là 1 đúng hay tốt". Agent hiểu: có thể sẽ có một
domain thương hiệu khác sau này, nên bố cục bây giờ phải chuyển được. **Đây là cách hiểu của agent, cần owner xác nhận** —
nếu ý owner là `toheplay.io.vn` chính là domain riêng đó thì item này đóng với phương án A.

## Sự thật

- Mọi host đi từ `publicUrls.hub|games|site` của chart; không có tên domain nào trong code, trừ file mẫu và docs (ADR 0039 rà).
- Đổi origin của hub sau khi đã có người dùng làm mất: app đã cài (phải cài lại), phiên đăng nhập, **tiến độ của khách
  (IndexedDB)**, link bàn/mời/email cũ và QR (chỉ cứu bằng redirect vĩnh viễn từ domain cũ) ([R-02](../research/R-02-hosts-seo-geo.md)).
- Hôm nay chỉ owner dùng prod → đổi bây giờ chỉ tốn cấu hình: zone Cloudflare, xác minh domain ở Resend (DKIM, `send.`),
  host ở `platform-infra`, `publicUrls`, ADR.
- DNS (dns.google, 2026-10-19): `tohe.vn` và `tohe.app` đã có người dùng; `toheplay.vn`, `toheplay.com`, `toheplay.app`,
  `tohe.games`, `tohe.fun` trả NXDOMAIN — **nhiều khả năng** còn trống, phải kiểm ở nhà đăng ký.

## Phương án

| | Cách | Giá |
|---|---|---|
| **A** | `toheplay.io.vn` là domain lâu dài | 0. Nếu mai này đổi thì đi đường C. |
| **B** | Mua domain thương hiệu và chuyển **trước khi mời người ngoài** (trước Cổng E-05) | một domain/năm + một buổi cấu hình; `toheplay.io.vn` giữ làm redirect 301. Gần như không ai bị ảnh hưởng. |
| **C** | Chuyển **sau** khi đã có người dùng | redirect 301 cứu được SEO và link; app đã cài, phiên, tiến độ khách thì không; uy tín gửi thư làm lại; OAuth redirect URI làm lại. |

Đi kèm phương án nào cũng được: **gửi thư từ subdomain** (`notify.<domain>` — Resend khuyên). Làm cùng lúc với lần xác
minh domain kế tiếp (B), không làm riêng.

## Đề xuất của agent

**Quyết trước Cổng (E-05), không cần quyết ngay.** Nếu owner định có domain thương hiệu trong vài tháng tới → **B**,
chuyển trước khi mời người ngoài. Nếu chưa có ý định cụ thể → **A**, và cứ xây theo D-01 (bố cục không phụ thuộc tên).
Tránh C.

## Câu hỏi cho owner

- Q1: "domain riêng sau này" là một domain khác `toheplay.io.vn`, hay chính nó?
- Q2: Nếu là domain khác — khoảng khi nào, và trước hay sau khi mời cộng đồng đầu tiên?
