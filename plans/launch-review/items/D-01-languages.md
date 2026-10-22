# D-01 — Hai ngôn ngữ, vi và en: URL, SEO và cách chọn ngôn ngữ thế nào?

- Status: **decided** — B, tiếng Anh mặc định (owner, 2026-10-22, chat); Q3 (bản gốc của Điều khoản) chờ owner
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

**B.** *(Owner đã đảo Q4: tiếng Anh mặc định ở `/`, tiếng Việt ở `/vi/` — xem [Decision](#decision); các dòng
"tiếng Việt ở `/…` và là `x-default`" dưới đây không còn đúng.)*

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

Owner, 2026-10-22, chat: "D-01 Q1 theo đề xuất, Q2 chốt tên game chính là tiếng anh hết nhé (bắt buộc và là default hiển thị) hỗ trợ optional thêm locate cho tên game (nếu có thì hiện), mà những tên k quá cần tiếng việt thì cứ tiếng anh đi cho chuẩn tại gamer viet nam cũng pro lắm haha … Q4 tiếng Anh là mặc định, nếu có phát hiện user đặt vi thì hỗ trợ vào đó".

- **Q1 = B**: URL theo ngôn ngữ cho trang công khai; ngôn ngữ là cài đặt trong app; link mời không mang ngôn ngữ.
- **Q4 = tiếng Anh mặc định** — đảo đề xuất của agent (vi mặc định). Hệ quả:
  - Trang công khai: **tiếng Anh ở `/…` và là `x-default`; tiếng Việt ở `/vi/…`**. Các URL vi đang được index từ
    2026-10-20 (`/`, `/games/<id>`…) đổi sang nội dung tiếng Anh tại chỗ, có `hreflang` trỏ sang `/vi/…` — không cần 301.
  - "Phát hiện user đặt vi": trình duyệt có `vi` thì trang công khai **gợi ý** "Xem bằng tiếng Việt →" (không tự chuyển,
    theo Google); bấm một lần thì nhớ, lần sau `/` đưa thẳng sang `/vi/`. Đây là lựa chọn của người dùng nên không trái
    hướng dẫn.
  - App: cài đặt → ngôn ngữ của trang vừa đi qua → trình duyệt có `vi` thì vi → còn lại **en** (hôm nay ngược lại: không
    phải `en` thì vi).
  - Thẻ xem trước của link mời: vẫn theo ngôn ngữ người tạo link.
- **Q2 = tên game tiếng Anh, bắt buộc, hiển thị mặc định**; tên theo ngôn ngữ khác là **tuỳ chọn**, có thì hiện theo
  ngôn ngữ người chơi. Đổi Game Contract (ADR, docs, conformance): `name` (và `description`) là tiếng Anh; thêm trường
  tuỳ chọn như `names: { "vi": "Ghép Khối" }`. Bốn game hôm nay: Ghép Khối → *Merge Blocks* (`vi`: Ghép Khối), Chạm Ghép →
  *Tap Merge* (`vi`: Chạm Ghép), Tiến Lên → *Tiến Lên* (tên riêng của trò chơi), Chạm Chấm (`hello`) → tên tiếng Anh do
  agent đề xuất trong ADR — owner duyệt.
- **Q3 chờ owner** — agent gợi ý ở *Discussion* 2026-10-22.

## Discussion

**agent** (2026-10-22): scout đề xuất cho ngôn ngữ vào URL cả trong app (A). Agent chọn B, vì vùng Chơi không được index và
một link mời gửi cho cả nhà phải mở đúng ngôn ngữ của từng người nhận.

**agent** (2026-10-22, Q3): **Luật Bảo vệ quyền lợi người tiêu dùng 2023, Điều 23 khoản 2** (theo các trang tổng hợp
văn bản, chưa đối chiếu Công báo): hợp đồng với người tiêu dùng, hợp đồng theo mẫu và điều kiện giao dịch chung **phải
có tiếng Việt**, được thêm tiếng nước ngoài; **khi các bản khác nhau, áp dụng bản có lợi hơn cho người tiêu dùng** —
https://hethongphapluat.com/luat-bao-ve-quyen-loi-nguoi-tieu-dung-2023/dieu-23,
https://luatvietnam.vn/thuong-mai/luat-bao-ve-quyen-loi-nguoi-tieu-dung-2023-so-19-2023-qh15-259732-d1.html.
Luật Bảo vệ dữ liệu cá nhân 2025 có hiệu lực từ 2026-01-01, thay Nghị định 13/2023 (nguồn thứ cấp) —
https://luatvietan.vn/nhung-diem-moi-cua-luat-bao-ve-du-lieu-ca-nhan-2025-so-voi-nghi-dinh-13-2023-nd-cp.html.
Gợi ý (không phải tư vấn pháp lý): **bản tiếng Việt là bản gốc** — viết trước, owner duyệt bằng tiếng mẹ đẻ; bản tiếng
Anh là bản dịch đi kèm, và trang ghi theo đúng luật "khi hai bản khác nhau, áp dụng bản có lợi hơn cho người dùng" thay
vì tự nhận một bản thắng. Để dễ kiểm sau này: mỗi điều khoản có cùng mã ở hai bản, một test bắt hai bản phải đủ cùng các
điều, và mỗi lần sửa bản vi thì bản en sửa trong cùng PR.
