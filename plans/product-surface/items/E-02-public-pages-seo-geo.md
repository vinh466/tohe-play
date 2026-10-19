# E-02 — Trang công khai: giới thiệu, trang game, hướng dẫn — tìm thấy được (SEO) và trích được (GEO)

- Status: **decided** (2026-10-19, chat) — trừ Q2 (cho AI huấn luyện?) còn mở
- Kind: enhancement — thay landing hiện tại
- Blocks: — · Blocked by: D-01 (ở đâu) · D-03 decided: user-first, không chia đối tượng
- Decided: owner, 2026-10-19, chat — xem *Decision*

## Vì sao

Owner (2026-10-19): "tôi đụng SEO GEO cho trang giới thiệu, hay mong muốn có 1 luồng thu hút user có thể dễ nhất giới
thiệu hướng dẫn user dùng đc ToHe".

## Sự thật

- Landing hiện tại: một trang Astro ở `docs.toheplay.io.vn/` (`apps/site/src/pages/index.astro`): bốn ý, câu chuyện tên
  gọi, mục "Dành cho người làm game"; không ảnh game, không trang riêng cho game, không hướng dẫn cài; meta description có,
  không Open Graph, không structured data.
- Gốc `toheplay.io.vn`: SPA, soft-404, không robots/sitemap thật, không `og:` ([R-01](../research/R-01-backlog-review.md) D2–D3).
- Crawler AI không chạy JS ([R-02](../research/R-02-hosts-seo-geo.md)).

## Đề xuất

### Trang (tiếng Việt; user-first theo D-03)

| Trang | Để làm gì |
|---|---|
| `/` | Trong 5 giây biết Tò He là gì; ảnh/clip ngắn của game; nút chính **"Chơi ngay — không cần tài khoản"** → `/play`; nút phụ "Đăng nhập"; ba điểm khác biệt (mở là chơi · không quảng cáo · rủ bạn bằng một link); nói với **một người bất kỳ** (D-03) |
| `/tro-choi/` + `/tro-choi/<slug>` | Mỗi game một trang: ảnh, chơi thế nào (lấy từ `SPEC.md`), hợp với ai/độ tuổi, chơi một mình hay cùng bạn, nút "Chơi ngay" → `/play/<id>` |
| `/huong-dan/cai-dat` | Cài app: Android, iPhone (iOS 26: ⋯ → Chia sẻ → Thêm vào MH chính), mở link từ Zalo/Messenger bằng trình duyệt — có hình |
| `/huong-dan/ca-nha` · `/huong-dan/choi-cung-ban` | Hồ sơ cho bé, mã quản lý; rủ bạn vào bàn bằng link/QR |
| `/hoi-dap` | Câu hỏi thật, câu trả lời ngắn: miễn phí? quảng cáo? dữ liệu của bé? chơi offline? iPhone? — dạng mà AI dễ trích |
| `/gioi-thieu` | Ai làm, vì sao không quảng cáo, liên hệ (`hello@`, D-01 Q4) |
| `/dieu-khoan`, `/quyen-rieng-tu` | Bản tĩnh của văn bản đang ở `apps/hub/src/legal/documents.ts` (một nguồn, hai nơi hiển thị) |

### Kỹ thuật (kiểm tự động trong build của `apps/web`)

- HTML tĩnh, `lang="vi"`, mỗi trang: `<title>` và description riêng, canonical, `og:title/description/image` (ảnh
  1200×630 cho trang chủ và từng game), `twitter:card`.
- JSON-LD: `WebSite` + `Organization` ở trang chủ; `VideoGame` ở trang game (giúp máy hiểu — không hứa rich result).
- `sitemap.xml`, `robots.txt` thật: cho phép trang công khai, chặn `/api/`, `/admin/`; đường dẫn app có
  `X-Robots-Tag: noindex`; **404 thật**.
- Content signals trong `robots.txt` (cú pháp của Cloudflare): `search=yes, ai-input=yes`; `ai-train` theo Q2.
- Không JS bên thứ ba, không font ngoài; ảnh tối ưu; điểm Lighthouse SEO và Accessibility ≥ 90 trên trang chủ và một
  trang game (đo trong CI hoặc bằng một kiểm đơn giản trong build).
- `llms.txt` cho trang công khai: rẻ, làm cho đủ, không kỳ vọng (R-02).
- Mỗi game mới có trang công khai: thêm vào `/new-game` và Definition of Done cho game.

### Ngoài trang (owner)

- Xác minh ở Google Search Console + Bing Webmaster Tools, nộp sitemap (D-04).
- Xem **AI Crawl Control** của zone trong Cloudflare: crawler Search phải được phép; Training tuỳ Q2.

## Câu hỏi cho owner

| Q | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Trang công khai chỉ tiếng Việt ở Phase 1? | **Có**; tiếng Anh sau (hub đã có `en`) |
| Q2 | Cho phép AI **huấn luyện** trên nội dung (`ai-train`)? | **Tuỳ owner** — `search` và `ai-input` nên `yes` để được trích dẫn |
| Q3 | Có clip/ảnh động trên trang chủ không, hay chỉ ảnh tĩnh? | ảnh tĩnh trước (nhẹ), clip sau |

## Chi phí

App `apps/web` (Astro) + nội dung tiếng Việt cho ~10 trang + ảnh chụp game + kiểm SEO trong build. Viết nội dung là phần
tốn công nhất và cần owner duyệt giọng văn.

## Decision

**owner** (2026-10-19, chat): "ổn nha, theo đề xuất" — trả lời lượt gom câu hỏi ở PLAN → *Waiting on the owner*.

Q1 = chỉ tiếng Việt ở Phase 1 · Q3 = ảnh tĩnh trước, clip sau · **Q2 còn mở** — không có đề xuất mặc định (sở thích của owner); `search` và `ai-input` bật.
