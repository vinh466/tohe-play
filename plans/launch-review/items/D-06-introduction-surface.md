# D-06 — Bề mặt giới thiệu: thiết kế cho SEO, GEO, và để thêm game là có đủ trang?

- Status: **proposed** (agent, 2026-10-23)
- Kind: decision
- Blocks: đợt 1 xong (ADR + spec bề mặt) · Blocked by: — · Đi cùng: [D-01](D-01-languages.md), [D-02](D-02-layout.md)
- Decided: —

## Why it matters

Owner (2026-10-23): "chốt và nâng cấp bố cục sản phảm và các bề mặt tốt cho UX user, và bề mặt giới thiệu sản phẩm, SEO
GEO, và scale bề mặt này tương lai nè, tôi muốn chốt được thiết kế này xong là có thể build tiếp chi tiết tiếp theo và sau
đó có thể tập trung phát triển thêm đc game". Khi tập trung làm game, mỗi game mới phải tự kéo theo trang giới thiệu đúng
chuẩn mà không ai phải nhớ.

## What is true today

Xem [R-06](../research/R-06-seo-geo-scale.md).

- Nền S1 đã tốt: trang tĩnh; JSON-LD theo loại trang; `llms.txt`; `robots.txt` có Content-Signal (`ai-train=no`); kiểm SEO
  lúc build làm hỏng build.
- Còn thiếu:
  - tiếng Anh;
  - ảnh OG riêng cho từng game (hôm nay một ảnh chung);
  - trang game chưa trả lời ngay câu hỏi của người tìm;
  - bộ sưu tập khi có nhiều game;
  - **nội dung game viết tay trong một file** (`apps/web/src/content/games.ts`) — không tự có khi thêm game.

## Options

### A — Giữ nền S1, chỉ thêm `/en/` và `hreflang`

- **Cái giá**: nhỏ.
- **Không sửa**: chuyện thêm game phải nhớ viết trang tay, ảnh OG chung, trang game mỏng.

### B — Bề mặt giới thiệu theo "một nguồn, sinh ra hết" *(đề xuất)*

Nội dung của mỗi game nằm trong thư mục game, hai ngôn ngữ. Build sinh ra trang, `hreflang`, JSON-LD, ảnh OG, sitemap.
Build hỏng nếu thiếu gì.

## Recommendation

**B.**

### 1. Bản đồ URL (tiếng Việt là mặt chính, D-01)

| Loại trang | Tiếng Việt | Tiếng Anh | Có khi |
|---|---|---|---|
| Trang chủ — danh mục trước (D-02) | `/` | `/en/` | luôn |
| Trang của game | `/games/<id>/` | `/en/games/<id>/` | mỗi game |
| Bộ sưu tập (do người biên tập) | `/games/c/<slug>/` | `/en/games/c/<slug>/` | từ khoảng **8 game** |
| Trang theo nhu cầu tìm kiếm | `/guides/<slug>/` | `/en/guides/<slug>/` | khi có **≥ 3 game hợp** và chữ thật |
| Lời hứa | `/promise/` | `/en/promise/` | luôn |
| Hướng dẫn, hỏi đáp, giới thiệu, giấy tờ | `/guides/install/`, `/faq/`, `/about/`, `/terms/`, `/privacy/` | dưới `/en/` | luôn |
| App | `/play`… | — | không index |

Đường dẫn dùng tiếng Anh ở cả hai ngôn ngữ, như ADR 0042 ("English route names throughout"). Tên trên trang và tiêu đề
thì theo ngôn ngữ của trang.

### 2. Mỗi loại trang chứa gì

- **Trang chủ**:
  - một câu trả lời ngay: Tò He là gì — "Game nhỏ cho cả nhà · Không quảng cáo · Không cần tài khoản · Chơi ngay";
  - lưới game có link thật; link tới các bộ sưu tập;
  - ngày cập nhật;
  - nút "Chơi tiếp" cho máy đã từng chơi (D-02).
  - JSON-LD: `WebSite`, `Organization`, `ItemList` các game (để hiểu trang, không mong rich result).
- **Trang của game**:
  - `<h1>` là tên game; 1–2 câu trả lời ngay (là gì, tuổi nào, một ván bao lâu);
  - nút **Chơi** và nút **Chơi cùng bạn** ở đầu trang;
  - **bảng sự thật**: tuổi, số người, một ván bao lâu, chơi offline được không, quảng cáo: không, dữ liệu thu: không;
  - cách chơi; ảnh màn chơi có `alt`; game liên quan; ngày cập nhật.
  - JSON-LD: `VideoGame` (giữ), `BreadcrumbList`. Không làm giả đánh giá sao.
- **Bộ sưu tập, trang theo nhu cầu**:
  - lời dẫn thật sự trả lời câu hỏi ("game cho bé không quảng cáo") và bảng so sánh các game trong đó.
  - JSON-LD: `CollectionPage`, `ItemList`, `BreadcrumbList`.
  - **Chỉ đăng khi có ≥ 3 game hợp và chữ do người viết.** Đây là hàng rào chính để không thành "nội dung hàng loạt"
    (luật spam của Google).
- **Hỏi đáp**: hỏi–đáp bằng HTML; giữ `FAQPage` để Google hiểu trang, dù rich result đã bỏ.
- **Lời hứa**: không quảng cáo, không theo dõi, không mua, không xu — "không bao giờ". Gom từ D-03 mục 1.

### 3. Một nguồn cho mỗi game — thêm game là có đủ trang

- Nội dung trang của game nằm **trong thư mục game**: `games/<id>/page/vi.md` và `games/<id>/page/en.md`, gồm câu trả lời,
  cách chơi, hợp với ai, và các câu hỏi riêng. Không đặt trong `public/`, nên không phục vụ ở origin game.
- **Sự thật lấy từ `game.json`**, không viết lại: tên (D-01: `name`, `names.vi`), tuổi (`minAge`), hướng màn, số người
  (`rooms.seats`), có chơi cùng được không.
- Astro đọc thư mục `games/*/page/` qua content collection, sinh trang cho mọi ngôn ngữ, sinh `hreflang` trong sitemap, sinh
  JSON-LD từ một hàm cho mỗi loại trang, và **sinh ảnh OG cho từng game, từng ngôn ngữ** (`render-og.ts` đã có, mở rộng
  thêm).
- `check-build.ts` thêm các luật:
  - mỗi game trong danh mục có đủ trang vi và en;
  - cặp `hreflang` đủ hai chiều;
  - mỗi game có ảnh OG riêng;
  - mỗi trang có ngày cập nhật;
  - bộ sưu tập có ít nhất 3 game.
- Skill `/new-game` viết luôn hai file trang. Definition of Done của game gồm trang công khai — S1 đã có luật này, đổi chỗ
  để file.

### 4. GEO và chính sách crawler

- **Chữ là chính**: mọi sự thật nằm trong chữ nhìn thấy được; tên riêng nhất quán ("Tò He", tên game); có ngày; dùng bảng;
  có hỏi–đáp ngắn. Theo Google, không cần file AI đặc biệt. `llms.txt` giữ vì rẻ.
- **`robots.txt`**:
  - giữ Content-Signal (`search=yes, ai-input=yes, ai-train=no`);
  - **cho phép rõ** bot tìm kiếm và trả lời: Googlebot, Bingbot, `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`,
    Applebot, `coccocbot-web`;
  - bot chỉ để huấn luyện (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`): owner quyết chặn rõ
    hay không (Q2). Chặn chúng không ảnh hưởng tìm kiếm của Google.
- **Cloudflare**: kiểm AI Crawl Control và Bot Fight Mode không chặn bot tìm kiếm. Việc này đang chờ owner từ Phase 1, là
  một dòng của Cổng.

### 5. Mở rộng từ 4 tới 100 game

| Số game | Bề mặt |
|---|---|
| 4 (hôm nay) | trang chủ liệt kê mọi game; chưa có bộ sưu tập |
| ~8 | 3–6 bộ sưu tập do người biên tập (tuổi, số người, kiểu chơi) |
| ~30 | tìm kiếm tĩnh trong trang (một file JSON sinh lúc build, không index); trang "mọi game" chia trang, mỗi trang canonical riêng |
| ~100 | một sitemap cho mỗi ngôn ngữ dưới một sitemap index; báo IndexNow khi deploy (cho Bing; Google không dùng) |

### 6. Đo

- Search Console và Bing Webmaster: lượt hiện và lượt bấm theo loại trang và theo ngôn ngữ. Search Console tính cả lượt từ
  AI Overviews.
- Log của server: lượt theo từng crawler, kể cả bot tìm kiếm của AI.
- Lighthouse trong CI cho Core Web Vitals. Không có script bên thứ ba, nên không đo người dùng thật trong trình duyệt.
- Mỗi tháng tự hỏi 10–20 câu tiếng Việt và tiếng Anh trên ChatGPT, Perplexity, Google AI để xem Tò He có được trích không.

### Cái giá

| PR | Nội dung |
|---|---|
| 1 | Trang công khai hai ngôn ngữ (`/en/`, `hreflang`, nút VI/EN, gợi ý ngôn ngữ), cùng nội dung tiếng Anh — đi cùng D-01 |
| 2 | Một nguồn cho mỗi game (`games/<id>/page/`), sự thật từ `game.json`, ảnh OG từng game, luật mới của `check-build.ts`, `/new-game` |
| 3 | Trang chủ danh mục trước, trang game có bảng sự thật, trang lời hứa, `robots.txt` cho phép rõ bot tìm kiếm của AI — đi cùng D-02 |
| sau | bộ sưu tập (~8 game), tìm kiếm (~30 game), sitemap index (~100 game) |

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Chọn B? | B |
| Q2 | Chặn rõ bot chỉ để huấn luyện AI (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`…) trong `robots.txt`? Content-Signal đã nói `ai-train=no`, nhưng không phải bot nào cũng đọc | Chặn rõ — khớp lời hứa "không theo dõi"; không ảnh hưởng tìm kiếm |
| Q3 | Nội dung trang của game nằm trong thư mục game (`games/<id>/page/`)? | Có — thêm game là một PR tự đủ |
| Q4 | Mốc mở bộ sưu tập (8 game) và tìm kiếm (30 game)? | Đồng ý |

## Decision

—

## Discussion

**agent** (2026-10-23): nền SEO của S1 đã đúng; D-06 làm cho nó **tự mở rộng** — điều kiện để owner yên tâm "tập trung
phát triển thêm game" mà bề mặt giới thiệu không tụt lại.
