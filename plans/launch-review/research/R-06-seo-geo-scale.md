# R-06 — Bề mặt giới thiệu: SEO, GEO, và mở rộng tới hàng chục game

- Date: 2026-10-23 · Feeds: D-06
- **[đã kiểm]** = đọc hôm nay, kèm ngày cập nhật của trang. **[thứ cấp]** = bài viết khác thuật lại. **[chưa kiểm]** = hiểu
  biết chung.

## Question

Owner (2026-10-23): "bề mặt giới thiệu sản phẩm, SEO GEO, và scale bề mặt này tương lai". Bề mặt giới thiệu hôm nay có
gì, Google và các công cụ trả lời bằng AI cần gì năm 2026, và làm sao để thêm một game là có đủ trang mà không thành
"nội dung hàng loạt"?

## Findings — Tò He hôm nay (code tại `main` 5c37d1c)

| Có | Nguồn |
|---|---|
| Trang tĩnh Astro: `/`, `/games/`, `/games/<id>`, `/guides/…`, `/faq/`, `/about/`, `/terms/`, `/privacy/`, chỉ tiếng Việt | `apps/web/src/pages/` |
| JSON-LD: `WebSite` + `Organization` (trang chủ), `VideoGame` (trang game), `FAQPage` (hỏi đáp) | `index.astro:12,21`, `games/[id].astro:25`, `faq.astro:9` |
| Ảnh OG sinh lúc build — **một ảnh chung** `/og.png` | `apps/web/scripts/render-og.ts` |
| `llms.txt` | `apps/web/src/pages/llms.txt.ts` |
| `robots.txt` sinh từ `@tohe/routes`: `Content-Signal: search=yes, ai-input=yes, ai-train=no`, chặn `/api/` | `apps/hub/public/robots.txt` |
| Kiểm lúc build, hỏng build nếu thiếu: `lang`, title, description, canonical, OG/Twitter, một `<h1>`, đúng JSON-LD cho loại trang, sitemap khớp từng trang, link nào cũng tới chỗ map biết | `apps/web/scripts/check-build.ts:1-11` |
| Nội dung từng game viết tay trong một file | `apps/web/src/content/games.ts` |

## Findings — bên ngoài

### Google Search

- **Rich result**: "Software app" có; **VideoGame không phải rich result**; carousel chỉ cho công thức nấu ăn, khoá học, nhà
  hàng, phim; Breadcrumb và Organization có — https://developers.google.com/search/docs/appearance/structured-data/search-gallery
  **[đã kiểm, 2026-10-16]**. Rich result của Software app thường cần đánh giá sao **[chưa kiểm]** — Tò He không có, và
  không được làm giả.
- **FAQ rich result đã bỏ cho mọi site từ 2026-05-07**; Google vẫn dùng markup để hiểu trang **[thứ cấp]**
  (https://ppc.land/google-kills-faq-rich-results-what-seos-saw-coming-since-2019/).
- **Nội dung hàng loạt** (scaled content abuse): "many pages are generated for the primary purpose of manipulating search
  rankings" — https://developers.google.com/search/docs/essentials/spam-policies **[đã kiểm, 2026-08-28]**. Trang của
  một game thật có thông tin riêng thì không sao; ma trận "từ khoá × thể loại" thì có rủi ro.

### GEO — được AI trích dẫn

- **Google AI Overviews, AI Mode**: trang được trích nếu đã index và cho hiện đoạn trích; "You don't need to create new
  machine readable files, AI text files, or markup"; nội dung quan trọng phải là chữ, dữ liệu có cấu trúc phải khớp chữ
  trên trang — https://developers.google.com/search/docs/appearance/ai-features **[đã kiểm, 2025-12-10]**. Search Console
  đếm lượt từ AI Overviews và AI Mode trong Performance.
- **Crawler cho tìm kiếm khác crawler cho huấn luyện**:
  - OpenAI: `OAI-SearchBot` (tìm kiếm) và `GPTBot` (huấn luyện) chặn riêng được — https://developers.openai.com/api/docs/bots **[đã kiểm]**.
  - Anthropic: `Claude-SearchBot` (tìm kiếm), `ClaudeBot` (huấn luyện) — https://support.claude.com/en/articles/8896518 **[đã kiểm, 2026-04-07]**.
  - Perplexity: `PerplexityBot` chỉ cho tìm kiếm — https://docs.perplexity.ai/guides/bots **[đã kiểm]**.
  - `Google-Extended` cho Gemini, "does not impact a site's inclusion in Google Search" —
    https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers **[đã kiểm, 2026-10-15]**.
- **Cloudflare**: mặc định mới cho domain mới từ 2026-09-15 chặn bot huấn luyện trên trang có quảng cáo, để bot tìm kiếm
  qua — https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/ **[đã kiểm, 2026-07-01]**. Prod
  đứng sau Cloudflare; việc chỉnh AI Crawl Control đang chờ owner từ Phase 1.
- **`llms.txt`**: Google nói không dùng; một nghiên cứu log thấy 97% file `llms.txt` không có lượt AI nào trong 5/2026
  **[thứ cấp]** (https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/). Rẻ, giữ, nhưng
  không trông vào nó.
- Kiểu nội dung hay được trích **[chưa kiểm, đồng thuận ngành]**: câu trả lời ngay ở 1–2 câu đầu, tên riêng nhất quán,
  sự thật có ngày, bảng so sánh, hỏi–đáp ngắn bằng HTML thường.

### Việt Nam **[chưa kiểm]**

- Cốc Cốc có crawler riêng (`coccocbot-web`), thị phần nhỏ so với Google.
- Zalo đọc `og:title`, `og:description`, `og:image` (ảnh khoảng 1200×630, URL tuyệt đối), và giữ cache xem trước lâu.
- Bố mẹ hay gõ không dấu ("game cho be").

## So what

- Nền SEO của S1 đúng hướng; cái thiếu là **tiếng Anh**, **ảnh OG riêng cho từng game**, **trang game trả lời ngay câu
  hỏi của người tìm** (một bảng sự thật), **bộ sưu tập** khi có nhiều game, và **một nguồn nội dung** để thêm game là có đủ
  trang hai ngôn ngữ.
- GEO không cần file đặc biệt: chữ rõ ràng, sự thật có ngày, và **để bot tìm kiếm của AI vào được** (cả ở Cloudflare).
- Không có rich result nào cho game mà Tò He lấy được một cách thật thà — nên đầu tư vào chữ và cấu trúc, không vào
  markup.
