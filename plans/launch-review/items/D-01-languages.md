# D-01 — Hai ngôn ngữ, vi và en: URL, SEO và cách chọn ngôn ngữ thế nào?

- Status: **proposed** (agent, 2026-10-22)
- Kind: decision
- Blocks: E-02, E-04, E-05, E-06 · Blocked by: D-02 (bố cục quyết nơi đặt `/en/`) · Đi cùng: [D-02](D-02-layout.md)
- Decided: phạm vi đã có lời owner (2026-10-22, gõ không dấu): "duy tri tieng anh va tieng viet th (game sau nay muon
  them van dc) trang gioi thieu cung 2 ngon ngu nha (nho toi uu ve SEO) trang console thi chot la chi dung english nha
  … dieu khoan va quyen cung 2 ngin ngu luon". Cách làm thì chưa quyết.

## Why it matters

URL công khai một khi đã được index thì đổi lại rất đắt. Điều khoản thì có bản người dùng đã đồng ý. Thẻ xem trước của
link mời đi theo tin nhắn của người gửi. Quyết cách làm trước khi dịch.

## What is true today

| Phần | Hôm nay | Nguồn |
|---|---|---|
| Hub | vi + en; chọn theo `navigator.language` (`en*` → en, còn lại vi); không có nút đổi | `apps/hub/src/i18n.ts:1607-1609` |
| Game | nhận `init.locale` (chuỗi tự do); bốn game có `strings.ts` vi + en | `packages/contract/src/protocol.ts:325`, `apps/hub/src/launcher/GameFrame.tsx:225` |
| Tên và mô tả game | một `name` (≤ 40) và một `description` trong `game.json` — app tiếng Anh vẫn hiện "Ghép Khối" | `packages/contract/src/manifest.ts:160,163` |
| Trang công khai | chỉ vi (`<html lang="vi">`, `og:locale vi_VN`); Astro 7.3.8 có i18n routing sẵn | `apps/web/src/layouts/Page.astro:34,45` |
| Điều khoản + Quyền riêng tư | chỉ vi, một nguồn cho app và trang `/terms`, `/privacy` (`TERMS_VERSION 2026-10-18.4`) | `apps/hub/src/legal/documents.ts`, `apps/web/src/pages/terms.astro:2` |
| Thẻ xem trước `/s`, `/r` | chỉ vi | `services/api/src/Tohe.Api/Modules/Links/LinkPreviews.cs:54-130` |
| Console | tiếng Việt viết thẳng trong code | `apps/console/src/pages/Shell.tsx:10-72` |
| Docs | tiếng Anh | `docs/` |

Google ([R-02](../research/R-02-layout-prior-art.md) §4): mỗi ngôn ngữ một URL; dùng thư mục con `/en/`; không tự chuyển
theo ngôn ngữ hay IP; `hreflang` hai chiều, khai báo một cách; có nút đổi ngôn ngữ nhìn thấy được.

## Options

Chỉ vùng **Chơi** (app, không index) mới có lựa chọn thật. Vùng **Khám phá** đã có lời khuyên rõ của Google.

### A — Ngôn ngữ nằm trong URL ở mọi chỗ (`/en/play`, `/en/s/…`)

- **Được**: URL nói rõ ngôn ngữ.
- **Cái giá**: nhân đôi mọi route của app, nhân đôi namespace của `@tohe/routes`.
- **Hạn chế**: một link mời phải chọn sẵn ngôn ngữ, nên người nhận nói ngôn ngữ kia vẫn mở ra ngôn ngữ của người gửi. App
  không được index, nên URL không đem lại gì cho SEO.

### B — URL theo ngôn ngữ cho vùng Khám phá, ngôn ngữ là cài đặt trong vùng Chơi *(đề xuất)*

- **Được**: link mời và mã bàn dùng chung cho mọi ngôn ngữ; người nhận thấy ngôn ngữ của mình.
- **Cái giá**: một cài đặt và một thứ tự chọn (dưới đây).

## Recommendation

**B.**

### Vùng Khám phá (trang công khai)

- **Tiếng Việt** ở `/…` và là `x-default`. Tò He làm cho người Việt trước.
- **Tiếng Anh** ở `/en/…`, cùng đường dẫn tiếng Anh như hôm nay (`/en/games/merge-block`, `/en/faq/`). Dùng i18n routing
  của Astro với `prefixDefaultLocale: false`.
- **`hreflang`** chỉ khai báo trong `sitemap.xml`, sinh ra lúc build, để không có hai chỗ phải giữ khớp nhau.
- **Mỗi trang** có:
  - `<html lang>` đúng ngôn ngữ;
  - `og:locale` và `og:locale:alternate`;
  - `rel=canonical` trỏ về chính nó;
  - JSON-LD theo ngôn ngữ của trang.
- **Nút VI | EN** ở header dẫn tới đúng trang đó ở ngôn ngữ kia. Không tự chuyển theo `Accept-Language`.
- **Kiểm SEO trong build** (đã có từ S1) thêm các luật: cặp `hreflang` đủ hai chiều, mỗi trang vi có bản en và ngược lại.

### Vùng Chơi (app)

- **Ngôn ngữ là một cài đặt**: "Tôi → Ngôn ngữ", lưu trên máy.
- **Thứ tự chọn**:
  1. cài đặt người chơi đã chọn;
  2. ngôn ngữ của trang công khai vừa đi qua (bấm "Chơi" từ `/en/…` thì vào app tiếng Anh);
  3. ngôn ngữ trình duyệt;
  4. tiếng Việt.
- **Link mời `/s/…` và mã bàn `/r/…`** không mang ngôn ngữ.
- **Game** nhận `init.locale` như hôm nay. Game muốn thêm ngôn ngữ thứ ba thì tự thêm; hub vẫn chỉ vi và en.
- **Thẻ xem trước** của một link mời theo **ngôn ngữ của người tạo link**, vì tin nhắn người ấy gửi kèm cũng bằng ngôn ngữ
  ấy:
  - hub gửi ngôn ngữ khi tạo link, API lưu cùng link (một cột thêm vào);
  - thẻ của một bàn chơi theo ngôn ngữ của người mở bàn.

### Console và docs

- **Console**: toàn tiếng Anh, chữ viết thẳng, không cần thư viện i18n (E-06).
- **Docs**: giữ tiếng Anh.

### Điều khoản + Quyền riêng tư

- Hai bản vi và en trong `documents.ts`, chung một `TERMS_VERSION`.
- Người dùng đồng ý với bản ở ngôn ngữ họ đang dùng.
- `/terms/` và `/en/terms/` render từ cùng nguồn (E-05).

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Chọn A hay B? | B |
| Q2 | Tên và mô tả game trong app tiếng Anh: (a) thêm tên theo ngôn ngữ vào `game.json` — đổi Game Contract (ADR, docs, conformance); (b) giữ tên game như tên riêng ("Ghép Khối" ở cả hai), chỉ trang công khai có tên tiếng Anh | (a), một trường thêm vào và không bắt buộc, như `ranked`, `shell` |
| Q3 | Khi hai bản Điều khoản lệch nhau, bản nào là bản gốc? | Owner quyết — agent không tư vấn pháp lý |
| Q4 | Tiếng Việt là `x-default`? | Có |

## Decision

—

## Discussion

**agent** (2026-10-22): scout đề xuất cho ngôn ngữ vào URL cả trong app (A). Agent chọn B, vì vùng Chơi không được index và
một link mời gửi cho cả nhà phải mở đúng ngôn ngữ của từng người nhận.
