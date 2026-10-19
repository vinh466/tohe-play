# R-06 — Chuẩn bố cục host và đường dẫn: chọn lại từ đầu

- Date: 2026-10-19 · Feeds: D-01

## Question

Owner (2026-10-19): "hiện tại ta có thể chọn 1 thiết kế tùy ý, nhưng hiểu quả cho nền tảng luôn, tại giờ rất rẻ nè, đừng
lo về việc sửa cái cữ hay ngoại thêm subdomain, tôi cần 1 chuẩn hợp lý và hiệu quả, bạn cứ research r đề xuất cho tôi
thiết kế bố cục sản phẩm để phân chia hợp lý + mở rộng kỹ thuật tốt cho các nhu cầu của sản phảm tốt nhé".

Không ràng buộc bởi hiện trạng: Tò He nên chia host và đường dẫn thế nào, theo chuẩn nào, để phục vụ đúng nhu cầu sản phẩm
và thêm thành phần về sau mà không phải nghĩ lại?

## Findings

### Chuẩn và khuyến nghị

- **RFC 10017 — OAuth 2.0 for Browser-Based Applications** (8/2026), §6.1 *Backend For Frontend*: một thành phần phía
  server giữ phiên/token, trình duyệt chỉ có cookie — cookie `Secure`, `HttpOnly`, nên `SameSite=Strict`, `Path=/`,
  **không đặt `Domain`**, nên dùng tiền tố `__Host-`; frontend có thể ở **cùng origin** với BFF, khỏi CORS. Kiến trúc này
  "strongly recommended" cho ứng dụng xử lý dữ liệu cá nhân ([RFC 10017](https://datatracker.ietf.org/doc/html/rfc10017)).
  → Tò He hôm nay đúng mẫu này: Caddy của hub chuyển `/api` cùng origin, phiên là cookie `__Host-tohe.session`
  (`SameSite=Lax` — cần cho redirect OAuth và link trong email).
- **HSTS**: nên dùng; `includeSubDomains` yêu cầu **mọi** subdomain đều HTTPS (cả subdomain nội bộ); chính hstspreload.org
  nói *không khuyên* preload ([hstspreload.org](https://hstspreload.org/)). → Tò He giờ giữ cả domain (ADR 0040) nên bật
  `includeSubDomains` được; không preload.
- **Trang trạng thái** phải sống khi dịch vụ chính sập: hạ tầng khác, nhà cung cấp khác; vài nguồn khuyên cả domain khác
  (DigitalOcean từng mất trang trạng thái cùng lúc với sự cố Cloudflare) ([PagerDuty](https://www.pagerduty.com/resources/outages/learn/status-page-best-practices/),
  [StatusGator](https://statusgator.com/blog/your-status-page-deserves-its-own-domain/)).
- **Gửi thư từ subdomain** để tách uy tín và nói rõ mục đích ([Resend](https://www.resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain)).
- **Trang vận hành sau một cổng danh tính**: Cloudflare Access chặn trước cả khi request tới máy chủ; gói Free đủ 50 người
  ([Cloudflare blog](https://blog.cloudflare.com/teams-plans), [HackerNoon](https://hackernoon.com/how-to-protect-private-domains-with-cloudflare-access)
  — nguồn cũ, kiểm lại giá hiện tại). Áp được cho cả một host.
- **Subdomain hay subdirectory** với Google: như nhau; giữ nội dung liên quan cùng một chỗ
  ([SEJ](https://searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says)).
- **Crawler AI không chạy JS** → trang công khai phải là HTML tĩnh ([Vercel](https://vercel.com/blog/the-rise-of-the-ai-crawler)).
- **PWA**: `scope` tính theo đường dẫn trên **một origin**; subdomain nằm ngoài scope
  ([Microsoft Edge docs](https://learn.microsoft.com/en-nz/Microsoft-edge/progressive-web-apps/how-to/handle-urls)).
- **Chứng chỉ miễn phí của Cloudflare** chỉ phủ gốc + một tầng subdomain (ADR 0002/0040) → mọi host công khai ở prod chỉ
  sâu một tầng.

### Sản phẩm tương tự

| Sản phẩm | Cách chia | Ghi chú |
|---|---|---|
| **Kahoot** | `kahoot.it` người chơi vào bằng PIN · `create.kahoot.it` người tạo · `kahoot.com` giới thiệu, account | chia theo **vai người dùng**; người chơi không cần account ([Kahoot help](https://support.kahoot.com/hc/articles/360039890713), [TeamDynamix KB](https://tulsatech.teamdynamix.com/TDClient/2573/Portal/KB/ArticleDet?ID=141169)) |
| Discord, Figma, Linear | giới thiệu và app **cùng origin**, app ở một đường dẫn (`/app`, `/files`, `/<workspace>`) | quan sát chung, không nguồn riêng |
| Slack, Spotify | app ở subdomain (`app.slack.com`, `open.spotify.com`) | tổ chức lớn, đội marketing riêng |
| itch.io, GitHub, Google | nội dung người khác viết ở **domain riêng** (`itch.zone`, `githubusercontent.com`) | Tò He đã cân nhắc ở D-13; owner chọn một domain (D-02) |
| Cổng game web (Poki, CrazyGames) | danh mục + trang game (SEO) + chơi trên cùng domain chính, game nạp từ hạ tầng riêng | quan sát chung; không tìm được tài liệu chính thức |

### Nhu cầu của Tò He (từ brief, D-03, D-06…D-08)

| # | Nhu cầu |
|---|---|
| N1 | Người mới chơi trong vài giây từ link hay trang giới thiệu |
| N2 | Link mời/chia sẻ ngắn, gõ được, không gãy |
| N3 | PWA cài được, chạy offline; hồ sơ máy và phiên gắn với một origin |
| N4 | Trang công khai tìm thấy được (SEO) và trích được (GEO) |
| N5 | Code game không tin được bị cô lập |
| N6 | Vận hành (admin) được bảo vệ chặt nhất |
| N7 | Tài liệu cho người làm game và agent |
| N8 | Thư tới hộp chính; có địa chỉ nhận |
| N9 | Dev / UAT / prod giống nhau, chỉ khác cấu hình |
| N10 | Thêm về sau: blog, tiếng Anh, API cho bên thứ ba, xưởng tạo game, ảnh người dùng, trang trạng thái, app Android (TWA) |

## Assumptions

- Cloudflare Access còn miễn phí tới 50 người — kiểm trên trang giá trước khi dựa vào.
- Trang trạng thái ở `status.toheplay.io.vn` vẫn chung DNS Cloudflare với Tò He (owner chọn một domain) — chấp nhận rủi ro
  sự cố DNS; kênh phụ là nhóm Zalo/Facebook của owner.

## So what

- Mẫu chuẩn: **host = ranh giới niềm tin + khán giả; đường dẫn = thành phần trong một host; API cùng origin với từng cửa
  vào (BFF)**. Không có lý do nào để tách API ra host riêng khi chưa có bên thứ ba.
- Thứ hôm nay đi ngược chuẩn: admin chung origin với người chơi (N6), gửi thư từ gốc (N8), HSTS chưa `includeSubDomains`,
  trang trạng thái chưa có.
- So sánh ba bố cục và chuẩn đề xuất: [D-01 v4](../items/D-01-host-and-path-layout.md).

## Sources

- https://datatracker.ietf.org/doc/html/rfc10017
- https://hstspreload.org/
- https://www.pagerduty.com/resources/outages/learn/status-page-best-practices/
- https://statusgator.com/blog/your-status-page-deserves-its-own-domain/
- https://www.resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain
- https://blog.cloudflare.com/teams-plans
- https://hackernoon.com/how-to-protect-private-domains-with-cloudflare-access
- https://searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says
- https://vercel.com/blog/the-rise-of-the-ai-crawler
- https://learn.microsoft.com/en-nz/Microsoft-edge/progressive-web-apps/how-to/handle-urls
- https://support.kahoot.com/hc/articles/360039890713
- https://tulsatech.teamdynamix.com/TDClient/2573/Portal/KB/ArticleDet?ID=141169
