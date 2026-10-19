# R-02 — Bố cục host trên domain, SEO và GEO cho trang giới thiệu

- Date: 2026-10-19 · Feeds: D-01, D-02, E-02, D-04

## Question

1. Đặt landing, app (hub), console admin, API, tài liệu, game lên host/đường dẫn nào để ổn định lâu dài và dễ chuyển sang
   một domain khác sau này?
2. Trang giới thiệu cần gì để Google tìm thấy (SEO) và để các công cụ trả lời bằng AI đọc và trích được (GEO)?

## Findings

### Hiện trạng trên production (kiểm từ ngoài, 2026-10-19)

| Host | Phục vụ | Ghi chú |
|---|---|---|
| `toheplay.io.vn` | SPA hub, `/api/*` (cùng origin), `/admin/*` (console, `noindex`) | Mọi đường dẫn trả `200` + `index.html` — kể cả `/robots.txt`, `/sitemap.xml`, `/khong-ton-tai`. HTML chỉ có `<title>Tò He</title>`. Manifest: `start_url "/"`, `scope "/"`, **không có `id`**. Scalar `/api/docs` và `/api/openapi/v1.json` mở. |
| `games.toheplay.io.vn` | build game, `catalog.json`; `/` → 302 hub; `X-Robots-Tag: noindex` | ADR 0039, 0040 |
| `docs.toheplay.io.vn` | landing tiếng Việt ở `/`, tài liệu kỹ thuật tiếng Anh ở `/docs/`, `llms.txt`, sitemap; `/play` → 302 hub | `robots.txt` là bản Cloudflare chèn (chỉ comment) |
| `www.toheplay.io.vn` | 301 → gốc (Cloudflare) | |
| `send.toheplay.io.vn` | MX + SPF của Resend (return-path) | **đã bị Resend dùng** |
| gốc — MX | **không có** | không địa chỉ `@toheplay.io.vn` nào nhận được thư |

### Cái gì đắt khi đổi về sau

| Thứ | Vì sao đắt | Đổi về sau thì sao |
|---|---|---|
| **Origin của hub** (scheme + host) | danh tính PWA đã cài, storage local-first (IndexedDB: hồ sơ khách, save), cookie phiên, link bàn `/r/<code>`, link mời, link trong email đã gửi, QR đã in | người dùng phải cài lại app, đăng nhập lại; tiến độ của khách mất; link cũ chỉ cứu được bằng redirect |
| **`id` / `start_url` của manifest** | khi không có `id`, trình duyệt lấy `start_url` làm danh tính app ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable)) | đổi `start_url` sau khi đã có người cài = một app khác |
| **URL trang công khai** | thứ hạng tìm kiếm, link từ nơi khác | 301 giữ được phần lớn, mất thời gian |
| **Domain gửi thư** | uy tín gửi thư phải "làm nóng" lại | thư vào spam một thời gian |
| Host của game, docs, admin; đường dẫn API | chỉ là cấu hình nội bộ (game không có storage riêng — D-13), không ai bookmark | rẻ, lúc nào cũng đổi được |

### Subdomain hay đường dẫn — Google và crawler AI

- Google nói subdomain và subdirectory được đối xử như nhau; Mueller khuyên giữ nội dung liên quan cùng một chỗ, chỉ tách
  subdomain khi phần đó thật sự khác ([SEJ](https://searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says)).
  → Landing, trang game, hướng dẫn và app cùng một sản phẩm → nên cùng host; tài liệu kỹ thuật tiếng Anh cho người làm
  game là khán giả khác → để subdomain riêng là hợp.
- Googlebot chạy JavaScript (Chromium headless) rồi index HTML đã render; SPA không trả được mã 404 thật thì Google khuyên
  redirect bằng JS sang một URL trả 404, hoặc chèn `noindex` ([Google JS SEO basics](https://developers.google.com/search/docs/guides/javascript-seo-basics)).
- Crawler AI lớn (GPTBot, ClaudeBot…) **không chạy JavaScript**: có tải file JS nhưng không thực thi
  ([Vercel + MERJ, 12/2024](https://vercel.com/blog/the-rise-of-the-ai-crawler)). → Với SPA hiện tại, AI thấy một trang
  trống. Trang công khai phải là **HTML tĩnh**.
- Cloudflare: từ 2026-09-15, zone mới mặc định chặn crawler *Training* và *Agent* trên trang **có quảng cáo**, crawler
  *Search* được phép; crawler đa dụng (Googlebot, Bingbot, Applebot) bị chặn theo chính sách khắt khe hơn nếu chặn
  Training ([Help Net Security, 2026-07-02](https://www.helpnetsecurity.com/2026/07/02/cloudflare-ai-crawler-controls/)).
  Zone `toheplay.io.vn` tạo sau ngày đó, Tò He không có quảng cáo → nhiều khả năng không bị chặn, nhưng **owner cần xem
  AI Crawl Control** trong dashboard. Thử bằng User-Agent giả của GPTBot/ClaudeBot/Googlebot từ máy này: đều `200`
  (không chứng minh được gì với bot thật đã xác minh).
- `llms.txt`: Google nói không dùng; nghiên cứu trên ~300k domain không thấy liên hệ với việc được AI trích dẫn; 97 % file
  không nhận request nào trong 5/2026 ([SEJ](https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/),
  [PPC Land](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/)). Rẻ, nhưng đừng kỳ vọng.
- Structured data: `VideoGame` là kiểu con của `Game` và `SoftwareApplication` ([schema.org](https://schema.org/VideoGame));
  không thấy Google có rich result riêng cho game — đánh dấu giúp máy hiểu, không hứa hiển thị đặc biệt.

### PWA và nhiều host

- `scope` của manifest tính theo đường dẫn trên **một origin**; subdomain nằm ngoài scope. App ở subdomain riêng thì
  landing ở gốc không chuyển link vào app đã cài được nếu không có *scope extensions* (đang origin trial)
  ([Microsoft Edge docs](https://learn.microsoft.com/en-nz/Microsoft-edge/progressive-web-apps/how-to/handle-urls),
  [Chrome](https://developer.chrome.com/docs/capabilities/scope-extensions)).

### Thư

- Resend khuyên gửi từ subdomain (vd `notifications.acme.com`) để cô lập uy tín và nói rõ mục đích với hộp thư
  ([Resend](https://www.resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain)).
  Tò He đang gửi `no-reply@toheplay.io.vn` (gốc), lượng rất nhỏ. Bên thứ ba lưu ý subdomain mới phải làm nóng lại và
  lượng thấp khó tạo uy tín riêng ([Suped](https://www.suped.com/knowledge/email-deliverability/sender-reputation/how-does-domain-reputation-work-with-subdomains-and-fqdns-in-email-sending)).

### Cách các sản phẩm khác làm (quan sát chung, không có nguồn riêng)

- Landing + app cùng domain, app ở một đường dẫn: Discord (`/app`), Figma (`/files`), Notion — người đã đăng nhập vào
  trang chủ thì được đưa thẳng vào app.
- App ở subdomain: Slack (`app.slack.com`) — landing lớn, đội marketing riêng.
- Nội dung do người khác viết ở domain riêng: itch.io (`itch.zone`), GitHub (`githubusercontent.com`) — Tò He đã cân
  nhắc ở D-13/ADR 0040 và chọn một domain.

## Assumptions

- Crawler AI có thể đã bắt đầu chạy JS sau nghiên cứu 12/2024 — chưa có nguồn mới; HTML tĩnh vẫn an toàn cho mọi trường hợp.
- Cài đặt AI Crawl Control của zone chưa kiểm được từ ngoài — owner xem trong dashboard Cloudflare.
- Từ khoá người Việt hay tìm ("game ghép số", "tiến lên miền nam online", "game cho bé không quảng cáo"…) là giả định;
  kiểm bằng Google Search Console sau khi trang lên.

## So what

- **Origin của hub (`https://toheplay.io.vn`) và `id` của manifest là hai thứ phải đúng trước khi có người cài app** — mọi
  thứ khác đổi sau được.
- Trang công khai phải là HTML tĩnh trên **chính host của hub** (một sản phẩm, một chỗ; Google và AI đọc được; landing
  chuyển link vào app đã cài được). Tài liệu kỹ thuật ở lại `docs.`.
- Cần một hộp thư nhận (`hello@` / `security@`) — Cloudflare Email Routing miễn phí, chỉ thêm MX ở gốc, không đụng `send.`.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable
- https://searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says
- https://developers.google.com/search/docs/guides/javascript-seo-basics
- https://vercel.com/blog/the-rise-of-the-ai-crawler
- https://www.helpnetsecurity.com/2026/07/02/cloudflare-ai-crawler-controls/
- https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/
- https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/
- https://schema.org/VideoGame
- https://learn.microsoft.com/en-nz/Microsoft-edge/progressive-web-apps/how-to/handle-urls
- https://developer.chrome.com/docs/capabilities/scope-extensions
- https://www.resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain
- https://www.suped.com/knowledge/email-deliverability/sender-reputation/how-does-domain-reputation-work-with-subdomains-and-fqdns-in-email-sending
