# R-04 — Review host và path: chia subdomain và đường dẫn như hôm nay đã tối ưu chưa?

- Date: 2026-10-22 · Feeds: D-05 (host và path), D-02, D-01
- Nguồn đọc ngày 2026-10-22 là **[đã kiểm]**; phần còn lại là **[chưa kiểm]**.

## Question

Owner (2026-10-22): "quay lai bai toan bo cuc chia trang xep sap subdomain hay path da hop ly chua, ban co the reseach hoc
hoi de review xem ta da toi uu chua". So bố cục hôm nay (ADR 0040, 0042) cộng với D-02 (`/together`) và D-01 (`/en/`)
với cách làm của các sản phẩm khác và với hướng dẫn của Google và web.dev.

## Findings

### Tò He hôm nay

| Host | Vai | Phiên |
|---|---|---|
| `toheplay.io.vn` | trang công khai + app (`/play`, `/account`, `/r`, `/s`; sắp có `/together`, `/en/…`) + API `/api` | `__Host-tohe.session`, Lax |
| `console.` | người vận hành; Cloudflare Access **tuỳ chọn** (owner 2026-10-20) | `__Host-tohe.console`, Strict |
| `games.` | code game, không tin cậy | không có |
| `docs.` · `status.` · `notify.` · `www.` | docs tiếng Anh · trang trạng thái bên ngoài · gửi thư · chuyển về gốc | — |

Phòng thủ cho `games.` (ADR 0002, 0011, 0021, 0040; code):

- iframe `sandbox="allow-scripts allow-same-origin"` (`apps/hub/src/launcher/GameFrame.tsx:567`). Có `allow-same-origin`
  để game tự tải file và WebAssembly của nó; thiếu nó thì Godot hỏng (ADR 0002).
- CSP của game có `connect-src 'self'`, `form-action 'none'` và `frame-ancestors` là hub (`packages/contract/src/csp.ts`).
- API từ chối request đổi dữ liệu khi `Sec-Fetch-Site` không phải `same-origin`, và kiểm `Origin` cho console
  (`services/api/src/Tohe.Api/Infrastructure/Security/SameOriginGuard.cs:42-47`).
- Cookie phiên là `__Host-`, nên host khác không đặt đè được.

Owner đã chọn một domain cho mọi thứ (2026-10-18, ADR 0040): "phương án 1, hãy giúp tôi làm tận gốc nhé". Phương án game ở
domain thứ hai được xét và không chọn.

### Bên ngoài

- **`io.vn` nằm trong Public Suffix List** **[đã kiểm]**: https://publicsuffix.org/list/public_suffix_list.dat. Nên
  `toheplay.io.vn` là một domain đăng ký được, và `games.`, `console.` **cùng site** với gốc: SameSite không ngăn request
  giữa chúng.
- **web.dev, "Securely hosting user data"** (2023-06-08) **[đã kiểm]**: https://web.dev/articles/securely-hosting-user-data
  - Cách cổ điển cho nội dung không tin cậy là một **domain riêng** (`exampleusercontent.com`).
  - Cách mới là mỗi nội dung một subdomain của domain đó, và đưa domain đó vào PSL.
  - Bài không coi một subdomain của site chính là cách được khuyên.
  - GitHub (`githubusercontent.com`), Google (`googleusercontent.com`), CodePen, itch.io đều làm vậy; Google Bug Hunters
    không coi script trên domain sandbox của họ là lỗ hổng, chính vì nó ở domain riêng
    (https://bughunters.google.com/learn/invalid-reports/web-platform/xss/6619189462433792).
- **SEO: subdomain hay thư mục**: Google nói đối xử như nhau, chỉ phải học bò riêng từng subdomain; dùng subdomain khi nội
  dung khác hẳn (John Mueller, qua báo thứ cấp) **[chưa kiểm nguồn gốc]**. Docs ở subdomain là chuyện thường:
  `stripe.com/docs` chuyển 301 sang `docs.stripe.com`; `vercel.com/docs`, `supabase.com/docs` thì ở path **[đã kiểm]**.
- **App ở gốc hay ở `app.`**: `discord.com/app` cùng origin với trang giới thiệu **[đã kiểm]**; Slack, Netlify, Linear tách
  host **[chưa kiểm]**. Một PWA cho mỗi origin là cách đơn giản nhất **[chưa kiểm]**.
- **Ngôn ngữ**: thư mục con `/en/` "ít công giữ" trên một host; Google không xếp hạng cách nào cao hơn **[đã kiểm]**:
  https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- **ccTLD**: Google coi ccTLD là tín hiệu mạnh rằng site dành cho một nước; `.vn` không nằm trong danh sách ccTLD được coi
  như domain chung **[đã kiểm, cùng trang]**. Nên trang `/en/` được hiểu là dành cho Việt Nam: người đọc tiếng Anh ở Việt
  Nam không sao, người tìm ở nước ngoài thì xếp thấp hơn.

## So what — review từng quyết định

| Quyết định | Đánh giá | Vì sao |
|---|---|---|
| Host theo ranh giới tin cậy (ADR 0042) | **đúng** | khớp cách các sản phẩm lớn tách người vận hành và nội dung |
| App và trang công khai cùng gốc, API cùng origin | **đúng** | cookie `__Host-` + Lax, không CORS; hub là nơi người ta đến (ADR 0040 đã xét `app.`) |
| `docs.` riêng | **đúng** | người đọc khác hẳn (dev, tiếng Anh); không làm hại gốc |
| `/en/` là thư mục con | **đúng** | theo Google; ccTLD `.vn` làm bản tiếng Anh yếu ở nước ngoài — chấp nhận, vì người Việt là chính |
| Một PWA, `scope "/"`; `/together` là namespace trong app | **đúng** | không tạo PWA thứ hai |
| Game ở `games.` cùng site với gốc | **chấp nhận được với game của Tò He**, không phải cách tối ưu | phòng thủ đủ cho code do repo này viết; đi ngược cách web.dev khuyên cho nội dung không tin cậy. Phần còn hở: dùng chung tiến trình và phân vùng lưu trữ của trình duyệt, và cookie không có `__Host-` (hôm nay vô hại) |
| `console.` cùng site với `games.`, Access tuỳ chọn | **nên bật Access trước launch** | `SameSite=Strict` không chặn request từ host cùng site; đã có kiểm `Origin` — Access là lớp thứ hai (E-01 dòng 13) |

**Chuyển game sang domain riêng thì tốn bao nhiêu, và lúc nào?**

- Origin của game lấy từ cấu hình (ADR 0042: "Hosts come from configuration"). Việc chuyển gồm:
  - một domain và một zone Cloudflare (gói miễn phí cho phép nhiều zone);
  - giá trị của chart ở `platform-infra`;
  - `frame-src`, `img-src` của hub;
  - một ADR sửa ADR 0040.
- URL của game **không được index và không ai chia sẻ** (link mời ở gốc), nên chuyển sau launch không đắt hơn chuyển bây
  giờ là bao.
- Cái đổi ý thật sự: khi Tò He nhận **game không do repo này viết** (người ngoài, cộng đồng). Khi đó domain riêng là bắt
  buộc. Nếu cần tách game với nhau thì mỗi game một subdomain của domain đó.
