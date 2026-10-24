# D-08 — Trang chủ giới thiệu: những section nào để người mới cuộn xuống là hiểu Tò He?

- Status: **decided** — A ([ADR 0055](../../../docs/decisions/0055-front-page-explains-greets-and-the-app-asks-once.md))
- Kind: decision
- Blocks: E-08 · Blocked by: — · Mở lại một phần: [D-06](D-06-introduction-surface.md) ("trang chủ danh mục trước", ADR 0047)
- Decided: owner, 2026-10-25, chat: "duyet r nha" (đề xuất ở #166, owner merge)

## Why it matters

Owner, 2026-10-24: "landing page làm cho nó giới thiệu 1 chút có các section và căn giữa các nút phù hợp hơn đi, chủ yếu
là các văn ở đây, chúng ta có page game list đồ r thì k cần list game ở đây lặp, tôi thấy trang đầu tiên cho user mới
cuộn xuống có thể đọc hiểu sản phẩm ok".

## What is true today

`/` và `/en/` (`apps/web/src/pages/index.astro`): H1 + một câu, lưới 4 game (trùng `/games/` và `/play`), hộp "Chơi
cùng", 3 câu Hỏi đáp, footer. Hero không có nút; *Chơi ngay* chỉ ở góc header; máy tính là một cột hẹp. Điểm đau 2, 3, 5,
7 của R-11.

## Options

### A — Trang giới thiệu theo section, khuôn của Duolingo; danh sách game ở `/games/`

Hero căn giữa có hai nút → sáu section, mỗi section một ý, một hình hoặc icon, vài câu → lời mời cuối trang. Không lưới
game: một thẻ "Xem 4 trò chơi" dẫn tới `/games/`.

1. **Hero**: hình (icon app hôm nay, tò he ở S3), H1, một câu; **Chơi ngay** (nút chính) và **Tôi đã có tài khoản**
   (nút phụ, tới `/account/sign-in`). Máy quen: thẻ chào của [D-09](D-09-the-way-back-in.md) thay hai nút.
2. **Tò He có gì** — ba ý: mở là chơi, không cần cài; cả nhà chơi cùng qua một link; không quảng cáo, không mua trong app.
3. **Chơi thế nào** — ba bước: chọn trò → chơi trên máy này hoặc đăng nhập để giữ tiến độ mọi máy → gửi link rủ cả nhà.
4. **Chơi cùng cả nhà** — bàn Tiến Lên mở bằng link Zalo, mã bàn; nút "Thử Tiến Lên". Thẻ "Xem 4 trò chơi".
5. **Cho bé, cho bố mẹ** — hồ sơ riêng cho bé, mã PIN của bố mẹ, link ra ngoài hỏi bố mẹ, `/promise/`.
6. **Cài như một app** — hai dòng cho Android và iPhone, link tới hướng dẫn.
7. **Bố mẹ hay hỏi** — 3–4 câu mở ngay tại chỗ (`<details>`), link "Xem tất cả câu hỏi".
8. **Lời mời cuối** — "Sẵn sàng chơi?" và *Chơi ngay*, căn giữa.

Giá: một PR `apps/web` (vi + en), câu chữ mới, sửa ADR 0047 và `surfaces.md`. Giữ: header có *Chơi ngay* trên mọi
trang (ADR 0046). SEO: trang game vẫn có link từ header, `/games/`, sitemap; trang chủ có nhiều chữ trả lời "Tò He là
gì" hơn cho GEO.

### B — Như A, thêm một dải icon game (không mô tả) ở section 4

Người mới thấy ngay có gì chơi; thêm 4 link nội bộ. Trái lời owner "k cần list game ở đây lặp".

### C — Giữ danh mục trước, thêm section bên dưới

Ít thay đổi nhất; người mới vẫn phải cuộn qua lưới game mới tới phần giải thích — đúng điều owner không muốn.

## Recommendation

**A.** Đúng ý owner và đúng khuôn của các sản phẩm cần giải thích (R-12 §1); danh mục làm trang chủ là kiểu của cổng game.
Cái giá chấp nhận: trang chủ dài hơn (ước 6–8 màn điện thoại), câu chữ viết lại cả hai thứ tiếng.

**Wireframe điện thoại** (câu chữ nháp):

```text
┌──────────────────────────────┐
│ [icon] Tò He   VI EN [Chơi ngay]
│                              │
│            [ hình ]          │
│   Trò chơi nhỏ cho cả nhà    │  H1, căn giữa
│ Mở là chơi, không quảng cáo. │
│ ┌──────────────────────────┐ │
│ │        Chơi ngay         │ │  nút chính
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │   Tôi đã có tài khoản    │ │  nút phụ, viền
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Tò He có gì        (3 ý)     │
│ Chơi thế nào       (1 → 2 → 3)
│ Chơi cùng cả nhà   [Thử Tiến Lên]
│ [ Xem 4 trò chơi           → ]
│ Cho bé, cho bố mẹ            │
│ Cài như một app              │
│ Bố mẹ hay hỏi      (mở tại chỗ)
│       Sẵn sàng chơi?         │
│     [    Chơi ngay     ]     │
│ footer                       │
└──────────────────────────────┘
```

**Wireframe máy tính**: hero căn giữa, hai nút cạnh nhau; "Tò He có gì" ba cột; các section sau hai cột, chữ và hình
xen kẽ trái phải; khổ nội dung ~1 100 px thay vì một cột 930 px căn trái.

```text
┌────────────────────────────────────────────────────────────────┐
│ [icon] Tò He   Trò chơi  Hướng dẫn  Hỏi đáp      VI EN [Chơi ngay]
│                          [ hình ]                              │
│                 Trò chơi nhỏ cho cả nhà                        │
│              Mở là chơi, không quảng cáo.                      │
│          [   Chơi ngay   ]  [ Tôi đã có tài khoản ]            │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│   │ Mở là chơi   │  │ Cả nhà cùng  │  │ Không quảng  │         │
│   └──────────────┘  └──────────────┘  └──────────────┘         │
│   Chơi cùng cả nhà ............  │  [ hình bàn Tiến Lên ]      │
│   [ hình hồ sơ của bé ]          │  Cho bé, cho bố mẹ .......  │
└────────────────────────────────────────────────────────────────┘
```

## Decision

**A** — owner, 2026-10-25: "duyet r nha", sau khi merge #166. Ghi ở ADR 0055; build ở V1.

## Discussion

**agent** (2026-10-24): câu chữ do agent viết theo voice-and-look, owner soát (như S1). Hình minh hoạ chờ S3; trước đó
dùng icon SVG có nhãn.
