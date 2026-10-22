# Bản đồ route đầy đủ — để owner duyệt (điểm 2: bỏ redirect ở `/`)

Viết 2026-10-22 từ `packages/routes/src/map.ts` (sau G1, `main` 6828358), ADR 0042, 0046, 0047. **Hôm nay** là cái đang
chạy; **sau đợt 1** là cái các PR G2a…G6 đã quyết sẽ làm. Chưa có trang nào bị đổi URL: URL tiếng Việt đã index giữ nguyên.

## Host (mặt phẳng)

| Host | Mặt phẳng | Hôm nay | Sau đợt 1 |
|---|---|---|---|
| `toheplay.io.vn` | Người chơi: trang công khai + app + `/api` | chạy | thêm `/en/…`, `/promise/`, `/together` |
| `www.toheplay.io.vn` | — | chuyển về gốc | như cũ |
| `games.toheplay.io.vn` | Game (L1, code không tin cậy) | chạy: `/<id>/<version>/…`, `/catalog.json` | như cũ |
| `console.toheplay.io.vn` | Vận hành | chạy, **Cloudflare Access** rồi đăng nhập riêng | như cũ |
| `docs.toheplay.io.vn` | Nhà phát triển (en) | chạy | như cũ |
| `status.toheplay.io.vn` | Edge | chưa có DNS | Better Stack (#114) |
| `notify.toheplay.io.vn` | Edge, chỉ gửi mail | chưa có record Resend | Resend (bước của owner) |
| `api.` `account.` `studio.` `media.` `uat.` | — | giữ chỗ, không DNS | như cũ |

## `toheplay.io.vn` — vùng **Khám phá** (được index, tĩnh, `apps/web`)

| Path (vi) | Bản en | Là gì | Hôm nay | Sau đợt 1 | PR |
|---|---|---|---|---|---|
| `/` | `/en/` | Trang chủ | giới thiệu; **máy đã chơi bị chuyển sang `/play` trước khi trang hiện** | **danh mục trước**, giới thiệu sau; máy đã chơi thấy nút **Chơi tiếp**; **không redirect** *(điểm 2, chờ owner)* | G2a (en), G2b |
| `/games/` | `/en/games/` | Danh mục tĩnh | có | như cũ + hai ngôn ngữ | G2a |
| `/games/<id>/` | `/en/games/<id>/` | Trang của một game | có, chữ ở `apps/web` | **Chơi** · **Chơi với bạn** ở đầu; bảng sự thật; cách chơi; nội dung từ `games/<id>/page/` | G2a, G2b |
| `/games/<id>/og.png` | `/en/games/<id>/og.png` | Ảnh xem trước từng game | — (một `og.png` chung) | mới | G2b |
| `/promise/` | `/en/promise/` | Lời hứa: không quảng cáo, không theo dõi, không mua bán | — | mới | G2b |
| `/games/c/<slug>/` | `/en/games/c/<slug>/` | Bộ sưu tập | — | khi có khoảng 8 game | sau |
| `/guides/`, `/guides/install/` | `/en/guides/…` | Hướng dẫn | có | hai ngôn ngữ | G2a |
| `/guides/<slug>/` | `/en/guides/<slug>/` | Trang cho một tìm kiếm | — | chỉ khi có ≥ 3 game hợp và có bài viết | sau |
| `/faq/`, `/about/` | `/en/faq/`, `/en/about/` | Hỏi đáp, giới thiệu | có | hai ngôn ngữ | G2a |
| `/terms/`, `/privacy/` | `/en/terms/`, `/en/privacy/` | Điều khoản, Quyền riêng tư | chỉ vi | **vẫn chỉ vi** tới E-05 (đợt 2), rồi có bản en | E-05 |

Tệp của vùng này: `/og.png`, `/llms.txt` (một tệp, hai ngôn ngữ), `/_web/…` (script, style), `/robots.txt`,
`/sitemap.xml` (có `hreflang`, `x-default` → bản en), `/.well-known/security.txt`.

## `toheplay.io.vn` — vùng **Chơi** (app, không index)

| Path | Tab / là gì | Hôm nay | Sau đợt 1 | PR |
|---|---|---|---|---|
| `/play` | **Trò chơi** | danh mục | màn đầu: ai đang chơi, ô nhập mã, bàn đang ngồi, lời mời, **Chơi tiếp**, gần đây, mọi game | G4, G5 |
| `/play/<id>` | game đang chơi | toàn màn | như cũ, không khung; nút back của Android lùi từng tầng | G4 |
| `/play/<id>/rooms`, `…/rooms/<roomId>`, `…/replay/<hand>` | bàn online, ván chơi lại | có | như cũ | — |
| `/together` | **Chơi cùng** | — | mới: ô mã, bàn của tôi, lời mời, link đã gửi | G4 |
| `/account` | **Tôi** | trang tài khoản | hồ sơ, cài đặt (ngôn ngữ, giao diện, âm thanh), cài app, trợ giúp, góp ý, giấy tờ, tài khoản | G4 |
| `/account/sign-in` (`/continue`), `/register` (`/confirm`), `/password/forgot`, `/password/reset`, `/profiles`, `/data`, `/transfer`, `/links`, `/email` | trang con của Tôi | có | như cũ | — |
| `/r/<code>` | link bàn | có; bot xem trước nhận thẻ của API | như cũ; thẻ theo ngôn ngữ người mở bàn | G6 |
| `/s/<code>` | link chia sẻ | có; như trên | như cũ; thẻ theo ngôn ngữ người tạo link | G6 |

Tệp của app: `/assets/…`, `/index.html`, `/manifest.webmanifest`, `/sw.js`, `/registerSW.js`, `/workbox-…`,
`/theme-init.js`, icon, `/screenshots/…`. API: `/api/…` (không cho bot vào).

**Đường cũ, trả 301** (giữ cho link trong mail và bookmark): `/welcome`, `/sign-in…`, `/register…`, `/password…`,
`/profiles`, `/data`, `/legal/terms`, `/legal/privacy`, `/rooms/<gameId>`.

## `console.toheplay.io.vn`

`/` Tổng quan · `/games` · `/health` · `/system` · `/users` (`/users/<id>`) · `/review` (`/review/<id>`) · `/communities` ·
`/links` · `/settings` · `/audit` · `/security` · `/setup` · `/api/admin/…`. Mọi path khác 404. Không đổi trong đợt 1
(chữ tiếng Anh là PB-12).

## Điểm 2 — bỏ redirect ở `/`: owner cần quyết

| | Giữ redirect (hôm nay) | **Bỏ redirect, thêm *Chơi tiếp*** (đề xuất) |
|---|---|---|
| Người cũ gõ `toheplay.io.vn` | vào thẳng `/play` | thấy danh mục + nút **Chơi tiếp** ở đầu: thêm **một chạm** |
| App đã cài | mở `/play` | mở `/play` (như cũ) |
| Link `/` gửi cho người đã từng chơi | không bao giờ thấy trang giới thiệu, FAQ từ link đó | luôn thấy đúng trang `/` |
| Đi từ app ra trang công khai | `/` đá ngược lại `/play` | đi được (Tôi → Trợ giúp và giới thiệu) |
| SEO | Google có vẻ cho phép (bot không có storage) | sạch, không phụ thuộc cách đọc chính sách |
