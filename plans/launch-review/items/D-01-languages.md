# D-01 — Hai ngôn ngữ, vi và en: URL, SEO và cách chọn ngôn ngữ thế nào?

- Status: **decided** (owner, 2026-10-22 → đổi lại 2026-10-23, chat) — tiếng Việt là mặt chính, tiếng Anh hỗ trợ
- Kind: decision
- Blocks: E-04, E-05, PB-12 (console) · Blocked by: — · Đi cùng: [D-02](D-02-layout.md), [D-06](D-06-introduction-surface.md)
- Decided: owner, chat — xem [Decision](#decision)

## Kết luận

| Phần | Quyết định |
|---|---|
| **Mặt chính** | **Tiếng Việt**, nhắm người dùng Việt; tiếng Anh là hỗ trợ cho người nước ngoài |
| **Trang công khai** | tiếng Việt ở `/…` (giữ nguyên URL đã index); tiếng Anh ở `/en/…`; **`x-default` → `/en/`** (người không đọc vi cũng không đọc en dễ đọc tiếng Anh hơn) |
| **SEO cho hai ngôn ngữ** | `hreflang` chỉ khai trong `sitemap.xml` (sinh lúc build); mỗi trang có `<html lang>`, `og:locale` + bản thay thế, `canonical` về chính nó, JSON-LD theo ngôn ngữ; build hỏng nếu thiếu cặp |
| **Đổi ngôn ngữ trên trang công khai** | nút **VI \| EN** ở header; trình duyệt không phải `vi` mở trang vi thì **gợi ý** "View in English →", không tự chuyển; bấm thì nhớ |
| **App** | ngôn ngữ là **một cài đặt** (Tôi → Ngôn ngữ), không nằm trong URL. Thứ tự chọn: cài đặt → ngôn ngữ của lối vào (trang vừa đi qua; người tạo link mời; người mở bàn) → trình duyệt (`vi` → vi, ngôn ngữ khác → en) → vi |
| **Link mời, mã bàn** | không mang ngôn ngữ; **thẻ xem trước** theo ngôn ngữ người tạo link (hub gửi, API lưu thêm một cột); thẻ của bàn theo người mở bàn |
| **Tên riêng, thuật ngữ** | giữ tiếng Anh ngay trong giao diện tiếng Việt khi đó là cách chính xác (tên game, "combo", "ranked"…) — không dịch ép |
| **Tên game** | `name` trong `game.json` là **tên chuẩn** (tiếng Anh, hay tên riêng như Tiến Lên), bắt buộc, hiện mặc định; **`names.<ngôn ngữ>` tuỳ chọn**, có thì hiện — đổi Game Contract (ADR + docs + conformance). Đề xuất: Ghép Khối → *Merge Blocks* (`vi`: Ghép Khối), Chạm Ghép → *Tap Merge* (`vi`: Chạm Ghép), Tiến Lên → *Tiến Lên*, Chạm Chấm (`hello`) → owner duyệt tên trong ADR |
| **Game** | nhận `init.locale` như hôm nay; game tự thêm ngôn ngữ thứ ba được, hub chỉ vi + en |
| **Điều khoản + Quyền riêng tư** | **bản tiếng Việt là bản gốc**, bản tiếng Anh là bản dịch; trang ghi "khi hai bản khác nhau, áp dụng bản có lợi hơn cho người dùng" (Luật BVQLNTD 2023, Điều 23); mỗi điều cùng mã ở hai bản, test bắt đủ cặp; một `TERMS_VERSION` |
| **Console** | toàn tiếng Anh, chữ viết thẳng (backlog PB-12) |
| **Docs** | tiếng Anh |

## What is true today

| Phần | Hôm nay | Nguồn |
|---|---|---|
| Hub | vi + en; `en*` → en, còn lại vi; không có nút đổi | `apps/hub/src/i18n.ts:1607-1609` |
| Game | `init.locale` (chuỗi tự do); bốn game có `strings.ts` vi + en | `packages/contract/src/protocol.ts:325` |
| Tên và mô tả game | một `name` (≤ 40), một `description`, đang là tiếng Việt | `packages/contract/src/manifest.ts:160,163` |
| Trang công khai | chỉ vi; Astro 7.3.8 có i18n routing sẵn | `apps/web/src/layouts/Page.astro:34,45` |
| Điều khoản + Quyền riêng tư | chỉ vi, `TERMS_VERSION 2026-10-18.4` | `apps/hub/src/legal/documents.ts` |
| Thẻ xem trước `/s`, `/r` | chỉ vi | `services/api/src/Tohe.Api/Modules/Links/LinkPreviews.cs:54-130` |
| Console | tiếng Việt viết thẳng | `apps/console/src/pages/Shell.tsx:10-72` |

Google ([R-02](../research/R-02-layout-prior-art.md) §4): mỗi ngôn ngữ một URL; thư mục con `/en/`; không tự chuyển theo
ngôn ngữ hay IP; `hreflang` hai chiều, khai một cách; có nút đổi ngôn ngữ.

## Options (đã xét)

- **A — ngôn ngữ trong URL ở mọi chỗ** (`/en/play`, `/en/s/…`): nhân đôi route của app; link mời ép một ngôn ngữ cho cả
  nhóm; app không được index nên không lợi SEO. **Không chọn.**
- **B — URL theo ngôn ngữ cho trang công khai, cài đặt trong app.** **Chọn.**

## Decision

1. Owner, 2026-10-22, chat (gõ không dấu): "duy tri tieng anh va tieng viet th (game sau nay muon them van dc) trang gioi
   thieu cung 2 ngon ngu nha (nho toi uu ve SEO) trang console thi chot la chi dung english nha … dieu khoan va quyen cung
   2 ngin ngu luon" — phạm vi.
2. Owner, 2026-10-22, chat: "D-01 Q1 theo đề xuất, Q2 chốt tên game chính là tiếng anh hết nhé (bắt buộc và là default
   hiển thị) hỗ trợ optional thêm locate cho tên game (nếu có thì hiện), mà những tên k quá cần tiếng việt thì cứ tiếng
   anh đi cho chuẩn tại gamer viet nam cũng pro lắm haha … Q4 tiếng Anh là mặc định, nếu có phát hiện user đặt vi thì hỗ
   trợ vào đó" — Q1 = B; Q2 = tên game; Q4 = tiếng Anh mặc định (**đã thay bởi 3**).
3. Owner, 2026-10-23, chat: "Q3 hợp lý nha, từ đây tôi muốn suy nghĩa lại cho bộ mặt sản phẩm sang default là tiếng việt
   và đánh vào user việt, en là hỗ trợ thêm cần thiết cho user nước ngoài tiếp cận, các nội dung cần tiếng anh thì nên giữ
   trên tiếng việt cũng được tạo sự chính xác (name, thuật ngũ, tên riêng ,....)" — Q3 = bản vi gốc; mặt chính tiếng Việt.
4. Owner, 2026-10-23, chat: "D-01 tam chot v nhe" — `x-default` → `/en/` và phần còn lại như *Kết luận*.

## Discussion

**agent** (2026-10-22): scout đề xuất cho ngôn ngữ vào URL cả trong app (A). Agent chọn B: vùng Chơi không được index, và
một link mời gửi cho cả nhà phải mở đúng ngôn ngữ của từng người nhận.

**agent** (2026-10-22, Q3): Luật Bảo vệ quyền lợi người tiêu dùng 2023, Điều 23 khoản 2 (theo trang tổng hợp văn bản,
chưa đối chiếu Công báo): hợp đồng theo mẫu và điều kiện giao dịch chung với người tiêu dùng **phải có tiếng Việt**; khi các
bản khác nhau, **áp dụng bản có lợi hơn cho người tiêu dùng** —
https://hethongphapluat.com/luat-bao-ve-quyen-loi-nguoi-tieu-dung-2023/dieu-23. Luật Bảo vệ dữ liệu cá nhân 2025 có hiệu
lực từ 2026-01-01, thay Nghị định 13/2023 (nguồn thứ cấp) —
https://luatvietan.vn/nhung-diem-moi-cua-luat-bao-ve-du-lieu-ca-nhan-2025-so-voi-nghi-dinh-13-2023-nd-cp.html. Không phải
tư vấn pháp lý; nên đọc văn bản gốc trước launch.

**agent** (2026-10-23, gom gọn): item viết lại với *Kết luận* ở đầu; lần chốt "tiếng Anh mặc định" (2) đã được owner thay
bằng (3), chi tiết của nó còn ở `log.md` 2026-10-23.
