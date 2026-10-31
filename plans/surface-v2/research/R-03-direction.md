# R-03 — Hướng đi: từ trang giới thiệu thành sạp game

- Date: 2026-10-31 · Feeds: D-01…D-08, design.md
- **Owner đã chốt 2026-10-31**: hướng A (sạp game), giữ Tò He/chất đồ chơi nặn tay, home như prototype, cửa giữ nhưng
  "Chơi ngay" trước, gia đình trong `Tôi` + `/family`, screenshot + khung tạm, tab "Sạp". Bức tranh cuối ở
  [design.md](../design.md); các câu hỏi ở §11 đã được trả lời.
- Đây là **brainstorm có đề xuất**, không phải spec. Mọi con số màu/typography phải qua test tương phản trước khi thành token.

## 1. Định vị

**Tò He là một sạp game nhỏ trên web.** Vài trò chơi làm kỹ, mở là chơi, không quảng cáo, không xu, không cần tài khoản.
Chơi một mình, hoặc rủ bạn qua một link. Có chế độ gia đình cho ai cần — nhưng đó là một lớp, không phải mặt tiền.

Câu một dòng:

> **Sạp game nhỏ. Chơi một ván. Rồi tính.**

Hoặc:

> **Năm trò chơi nhỏ, làm bằng tay. Mở là chơi.**

Từ "sạp" làm được ba việc:
- Nó Việt, cụ thể, không phải "platform"/"portal"/"hub".
- Nó cho phép ít game: một sạp không cần hàng trăm trò; sạp có gì chơi nấy, nhưng chọn kỹ.
- Nó mở ra ngôn ngữ hình ảnh: giấy, mực, vải, biển hiệu, tem dán, đồ nặn tay — khác hẳn gradient tím của game portal.

## 2. Ba hướng

| | **A — Sạp game** (đề xuất) | **B — Arcade gọn** | **C — Xưởng tò he** |
|---|---|---|---|
| Ý | Một sạp nhỏ, chọn kỹ, bày biện có chủ ý | Một arcade tối giản, hiệu quả, gần Miniblox/CrazyGames | Một xưởng đồ chơi nặn tay, chất liệu và màu dân gian |
| Hình | Ảnh bìa game + tem giấy + đường mực; mascot là người bán | Ảnh bìa + lưới dày + dark mode; ít trang trí | Ảnh bìa vẽ tay, texture bột gạo, màu gấc/nghệ/lá |
| Màu | Giấy, mực, đỏ gấc, nghệ, lá | Nền tối, trắng, một accent | Đỏ son, vàng, đen, giấy dó |
| Chữ | Be Vietnam Pro + wordmark vẽ tay | Be Vietnam Pro, tiêu đề đậm | Display có dấu Việt + thư pháp |
| Giá | Vừa (ảnh bìa + CSS system) | Thấp (gần hiện tại, chỉnh lưới/màu) | Cao (minh hoạ, texture, font) |
| Rủi ro | Cần ảnh bìa đẹp; nếu không sẽ "nửa vời" | Vẫn có thể chung chung; khó tạo cảm xúc | Dễ thành "đồ Tết"/trẻ con; dark mode khó |
| Hợp 16+ | Cao: lạ, có gu, không trẻ con | Cao: quen, nhanh | Trung bình: đẹp nhưng dễ bị đọc là cho trẻ |

**Đề xuất: A + nền của B + chi tiết của C.** Lấy cấu trúc và mật độ của B (lưới, search, shelf, hiệu năng), lấy chất liệu
và sự chăm chút của C ở một vài chỗ (wordmark, tem, empty state, 404), nhưng mặt tiền là A: **sạp game có ảnh bìa, có
editorial, có nhịp**.

Lý do không chọn B thuần: với 5 game, một arcade tối giản sẽ trông như app launcher — đúng cái đang có. Lý do không chọn
C thuần: brand hiện tại đã đủ "tò he"; thêm chất liệu dân gian nữa sẽ đẩy sản phẩm về phía trẻ em/hoài cổ, ngược mục tiêu
16+.

## 3. Ngôn ngữ thiết kế

### 3.1 Màu

Mục tiêu: bỏ dải cam Tailwind, giữ ấm, thêm tương phản, đủ chất "sạp" mà vẫn hiện đại.

| Vai | Gợi ý | Ghi chú |
|---|---|---|
| `page` | giấy ấm `#F6EFE3` | không trắng tinh, không kem quá vàng |
| `surface` | `#FFFDF8` | card game, sheet |
| `ink` | `#201A16` | mực, không đen tuyệt đối |
| `ink-soft` | `#6B5A4E` | chữ phụ |
| `brand` | đỏ gấc `#C8402A` | nút chính, con dấu, tem |
| `brand-strong` | `#A62F1F` | pressed |
| `accent` | nghệ `#D99A2B` | highlight, "mới", badge |
| `leaf` | `#3E6B4F` | "đang mở", "online", thành công |
| `line` | `#E4D5C3` | viền mảnh |
| `line-strong` | `#201A16` | viền 1.5–2px cho card/sticker |
| dark `page` | `#171310` | than ấm |
| dark `surface` | `#221C18` | |
| dark `brand` | `#E26045` | kiểm tương phản |

Quy tắc:
- **Màu để nói, không để trang trí.** Đỏ gấc = hành động; nghệ = mới/đang chú ý; lá = đang mở/online; mực = chữ.
- **Không gradient.** Không glow. Không shadow mờ rộng. Dùng **offset shadow 2–3px** màu mực nhạt hoặc viền mực.
- **Dark mode**: ảnh bìa giữ nguyên, thêm viền 1px `line`; không dùng pure black; không đổi màu ảnh.

### 3.2 Chữ

- **UI**: Be Vietnam Pro (giữ) — đã có dấu Việt chuẩn, self-host.
- **Display**: Be Vietnam Pro 800/900, tracking âm nhẹ, chữ thường (sentence case), không Title Case.
- **Wordmark**: vẽ tay/lettering "Tò He" một lần, dùng ở header/footer; không dùng font lạ chưa kiểm dấu.
- **Số liệu**: dùng tabular numbers cho điểm, thời gian, số người.
- **Cỡ**: mobile H1 28–32, H2 22–24, body 16; desktop H1 44–56, H2 28–32, body 16–18. Đừng để mọi heading cùng một cỡ.

### 3.3 Hình khối

- Card game: bán kính **10–14px**, viền **1.5px ink**, ảnh bìa tràn viền trên, tên ở dưới, **không** bo 24–32px.
- Nút chính: nền `brand`, chữ trắng, bán kính 10–12px, **offset shadow 3px 3px 0 ink/20%**, pressed thì dịch xuống 1px.
- Tem/sticker: nhãn nhỏ, xoay nhẹ 1–2°, dùng cho "Mới", "2–4 người", "Offline".
- Đường kẻ mực 1px thay cho card khi nhóm nội dung không phải một vật click.
- Empty state: một hình vẽ tay nhỏ + một câu + một nút; không dùng icon to giữa màn.

### 3.4 Ảnh

- **Ảnh bìa 16:9** cho mọi game, là đơn vị chính của catalog/home.
- **3 ảnh chụp** hoặc **1 clip 6–10 giây** cho trang game.
- **Một hệ chung**: crop, viền, góc, tên game đặt cùng một vị trí; ảnh game có thể khác phong cách, nhưng khung thì thống nhất.
- **Không dùng icon làm ảnh bìa**. Icon 1:1 chỉ dùng ở header game, favicon, PWA.
- Nếu chưa có ảnh: chụp màn hình game, crop 16:9, thêm một lớp giấy/tem; đừng để icon vuông.

### 3.5 Chuyển động

- Chỉ dùng cho phản hồi: card nhấc lên 2px khi hover, ảnh zoom 1.02, nút dịch xuống khi press, shelf snap.
- Bỏ `animate-pop-in` delay 40ms cho từng card — đây là dấu hiệu template.
- Tôn trọng `prefers-reduced-motion`.
- Không autoplay âm thanh; clip autoplay muted.

### 3.6 Giọng

Hai register, cùng một người nói:

**Mặc định (16+)** — như một người bạn cùng bàn, câu ngắn, khô, có duyên:

| Đừng | Dùng |
|---|---|
| "Chào mừng đến Tò He" | "Sạp mở rồi." |
| "Mấy trò chơi nhỏ cho cả nhà" | "Năm trò nhỏ. Chơi một ván rồi tính." |
| "Chơi thử trên máy này" | "Chơi luôn, không cần tài khoản." |
| "Đăng nhập để giữ tiến độ chơi trên mọi máy" | "Đăng nhập nếu muốn giữ điểm." |
| "Bố mẹ hay hỏi" | "Phụ huynh" (trong `/family`) |
| "Từ 3 tuổi" trên card | "Giải đố · 5 phút" |

**Gia đình (phụ huynh)** — ấm, rõ, kiên nhẫn, như hiện tại:

- "Bé chơi an toàn: không quảng cáo, không chat với người lạ, bố mẹ giữ PIN."
- "Mỗi bé một hồ sơ. Đổi sang người lớn cần PIN."
- "Dữ liệu ở lại máy này. Đăng nhập mới đi theo tài khoản."

Quy tắc: **không dùng "cả nhà", "bé", "bố mẹ" ở mặt tiền**; những từ đó thuộc `/family` và màn quản lý hồ sơ.

## 4. Kiến trúc thông tin

### 4.1 Trang công khai

```
/                 Sạp: hero game + shelf + tất cả game + dải tin
/games/           Tất cả game + lọc/tag (giữ cho SEO và link trực tiếp)
/games/<id>/      Trang store của game: ảnh, chơi, ảnh chụp, facts, cách chơi
/family/          Phụ huynh: an toàn, hồ sơ, PIN, dữ liệu
/about/           Tò He là gì, ai làm, vì sao
/faq/ + /guides/  Hỏi đáp, cài app, liên hệ
/terms/ /privacy/ Giấy tờ
```

Header công khai: logo · **Sạp** · **Chơi cùng** · **Về** · tìm kiếm · **Đăng nhập**.
Bỏ "Hướng dẫn", "Hỏi đáp" khỏi header; đưa xuống footer, `/faq/` và `/guides/`.

### 4.2 Trong app

```
/play             Sạp: chơi tiếp, bàn đang ngồi, gần đây, tất cả + tìm/lọc
/together         Chơi cùng: tạo bàn, nhập mã, bàn của bạn, lời mời, link đã gửi
/account          Bạn: hồ sơ, tiến độ, cài đặt, gia đình, giúp, giấy tờ
/account/family   Quản lý hồ sơ/PIN/thời gian (sau cổng PIN)
```

Nav:
- **Mobile**: thanh dưới 3 mục **Sạp · Chơi cùng · Bạn**; tìm kiếm là icon trên header, không phải tab.
- **Tablet/desktop**: rail trái 240px, logo trên, 3 mục, tag game ở dưới; search ở top bar.
- **Đang chơi**: không nav, chỉ một nút thoát/thu nhỏ.

Tên tab: "Sạp" thay "Trò chơi" — ngắn, Việt, đúng ẩn dụ. Nếu owner thấy quá lạ, giữ "Trò chơi" nhưng vẫn dùng từ "sạp" trong copy.

## 5. Bố cục từng màn

### 5.1 `/` — Sạp (công khai)

**Mục đích:** thấy game, hiểu sản phẩm trong 5 giây, chơi trong 10 giây.

```
┌──────────────────────────────────────────────────────────────┐
│ logo   Trò chơi   Chơi cùng   Về        [tìm]   Đăng nhập    │
├──────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────┐  ┌───────────────────────┐ │
│ │ ẢNH BÌA GAME CHỦ ĐẠO 16:9     │  │ Đang mở               │ │
│ │                               │  │ 01 [cover] Tên game   │ │
│ │ Tên game                      │  │ 02 [cover] Tên game   │ │
│ │ Một câu hook                  │  │ 03 [cover] Tên game   │ │
│ │ [ Chơi ngay ]  [ Rủ bạn ]     │  │                       │ │
│ └───────────────────────────────┘  └───────────────────────┘ │
│ Không quảng cáo · Không cần tài khoản · Lưu trên máy này     │
├──────────────────────────────────────────────────────────────┤
│ Chơi tiếp                                        [xem tất cả]│
│ [cover] Tên game · ván đang dở          [ Tiếp tục ]         │
├──────────────────────────────────────────────────────────────┤
│ Mới tuần này                                                 │
│ [cover] [cover] [cover] [cover]                              │
├──────────────────────────────────────────────────────────────┤
│ Rủ bạn chơi                                                  │
│ Mở bàn, gửi link. Không cần tài khoản.                       │
│ [ Tạo bàn ]  [ Nhập mã ]                                     │
├──────────────────────────────────────────────────────────────┤
│ Tất cả trò chơi                    [Giải đố] [Bài] [Phản xạ] │
│ [cover] [cover] [cover] [cover] [cover]                      │
├──────────────────────────────────────────────────────────────┤
│ footer: Về · Phụ huynh · Giúp · Giấy tờ · Làm game?          │
└──────────────────────────────────────────────────────────────┘
```

- Hero dùng **game chủ đạo**, không dùng logo. Ảnh bìa là hình gameplay/illustration, có tên game và hook.
- "Đang mở" là danh sách 3 game, có thể là "Mới" hoặc "Nhiều người chơi" — số thật, không bịa.
- Dải tin một dòng, không phải 3 card.
- "Chơi tiếp" chỉ hiện khi máy đã chơi; nếu không, hero là điểm bắt đầu.
- Trên mobile: hero full-bleed, hook 2 dòng, nút Chơi to; các shelf cuộn ngang; "Tất cả" 2 cột.

**Bỏ khỏi `/`:** "Tò He có gì", "Chơi thế nào", "Cho bé và bố mẹ", "Cài như một app", "Bố mẹ hay hỏi", banner CTA cuối.
Chuyển sang `/about`, `/family`, `/faq/`, `/guides/`.

### 5.2 `/play` — Sạp (trong app)

```
┌──────────────────────────────────────────────────────────────┐
│ [avatar] An · Trên máy này            [tìm]   [Nhập mã]      │
├──────────────────────────────────────────────────────────────┤
│ Chơi tiếp                                                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [cover lớn]  Ghép Khối · ván đang dở        [ Tiếp tục ] │ │
│ └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Bàn đang ngồi (nếu có)                                       │
│ Tiến Lên · bàn của Bố · 3/4 chỗ              [ Vào lại ]     │
├──────────────────────────────────────────────────────────────┤
│ Gần đây                                                      │
│ [cover] [cover] [cover]                                      │
├──────────────────────────────────────────────────────────────┤
│ Tất cả trò chơi           [Giải đố] [Bài] [Phản xạ] [2–4 ng] │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                 │
│ │ cover  │ │ cover  │ │ cover  │ │ cover  │                 │
│ │ Tên    │ │ Tên    │ │ Tên    │ │ Tên    │                 │
│ │ 1 dòng │ │ 1 dòng │ │ 1 dòng │ │ 1 dòng │                 │
│ │ [Chơi] │ │ [Chơi] │ │ [Chơi] │ │ [Chơi] │                 │
│ └────────┘ └────────┘ └────────┘ └────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

- **Mỗi card có "Chơi" hiện rõ**, không chỉ "Rủ bạn". Cả card click được; "Rủ bạn" là icon phụ.
- Card có ảnh bìa, tên, một dòng tag ("Giải đố · 5 phút"), không có tuổi.
- Desktop: 4–6 cột, max card 280px, không kéo giãn 5 card thành 5 ô 300px.
- Mobile: 2 cột; ảnh bìa 16:9; nút Chơi toàn chiều rộng card hoặc overlay ở góc.
- Empty state: "Sạp mở rồi. Chọn một trò." + 3 cover.

### 5.3 `/games/<id>/` — Trang store

```
┌──────────────────────────────────────────────────────────────┐
│ ← Tất cả trò chơi                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ẢNH BÌA LỚN 16:9 (hoặc clip muted)                       │ │
│ │ Tên game                                                 │ │
│ │ Một câu hook                                             │ │
│ │ [ Chơi ngay ]  [ Rủ bạn ]                                │ │
│ └──────────────────────────────────────────────────────────┘ │
│ [1 người] [5 phút] [Offline] [Không quảng cáo]               │
├──────────────────────────────────────────────────────────────┤
│ Ảnh chụp                                                     │
│ [shot 1] [shot 2] [shot 3]                                   │
├──────────────────────────────────────────────────────────────┤
│ Cách chơi                                                    │
│ • Chạm cột để thả khối.                                      │
│ • Hai khối cùng số gộp thành khối lớn hơn.                   │
│ • Hết cột là hết ván.                                        │
├──────────────────────────────────────────────────────────────┤
│ Bảng xếp hạng (nếu có)        Trò khác                       │
│ 1. An 12.340                 [cover] [cover] [cover]         │
└──────────────────────────────────────────────────────────────┘
```

- **Nút Chơi dính đáy trên mobile** sau khi cuộn qua hero.
- Facts dạng chip, không phải bảng 6 dòng. Bảng đầy đủ vẫn giữ ở dưới cho ai muốn đọc.
- Tuổi chuyển xuống mục "Phù hợp" hoặc chỉ hiện trong `/family`; không đặt cạnh tên game.
- Ảnh chụp là điều kiện để trang này không còn là bài viết.

### 5.4 `/play/<id>` — Đang chơi

- Full-bleed, không nav, không footer.
- Top bar mỏng, tự ẩn sau 3 giây: ← thoát, tên game, âm thanh, toàn màn hình, menu.
- ESC/back: hỏi "Thoát ván?" nếu game đang chạy; "Về Tò He" trong menu của game.
- Mobile: hỗ trợ dọc/ngang theo game; không khoá màn.
- Không hiện "Đang tải…" chữ; dùng khung skeleton đúng tỉ lệ game.

### 5.5 `/together` — Chơi cùng

```
┌──────────────────────────────────────────────────────────────┐
│ Chơi cùng                                                    │
│ Mở bàn, gửi link. Mỗi người một máy. Không cần tài khoản.    │
│ [ Tạo bàn ]   [ Nhập mã ]                                    │
├──────────────────────────────────────────────────────────────┤
│ Bàn đang ngồi                                                │
│ [cover] Tiến Lên · bàn của Bố · 3/4 chỗ        [ Vào lại ]   │
├──────────────────────────────────────────────────────────────┤
│ Lời mời tới bạn                                              │
│ [cover] Ghép Khối · An mời · 2 phút trước      [ Vào ]       │
├──────────────────────────────────────────────────────────────┤
│ Link đã gửi                                                  │
│ [cover] Tiến Lên · 3 người · hết hạn 2 ngày    [ Mở lại ]    │
└──────────────────────────────────────────────────────────────┘
```

- "Tạo bàn" là nút chính, to; "Nhập mã" là nút phụ.
- Empty state: "Chưa có bàn nào. Mở bàn trước, gửi link sau." + nút.
- Không cần giải thích dài; 1 câu + 1 hành động.

### 5.6 `/account` — Bạn

```
┌──────────────────────────────────────────────────────────────┐
│ [avatar] An                     [ Đổi ]                     │
│ Đang chơi trên máy này · Đăng nhập để giữ điểm               │
├──────────────────────────────────────────────────────────────┤
│ Tiến độ                                                      │
│ Ghép Khối · kỷ lục 12.340 · 8 ván                            │
│ Tiến Lên · 3 ván                                             │
├──────────────────────────────────────────────────────────────┤
│ Gia đình (nếu có hồ sơ trẻ)                                  │
│ [ Quản lý hồ sơ ] [ PIN ] [ Thời gian chơi ]                 │
├──────────────────────────────────────────────────────────────┤
│ Cài đặt                                                      │
│ Ngôn ngữ · Giao diện · Âm thanh · Cài app                    │
├──────────────────────────────────────────────────────────────┤
│ Giúp · Giấy tờ · Đăng xuất                                   │
└──────────────────────────────────────────────────────────────┘
```

- Bỏ SHA khỏi mặt tiền; đưa vào `?debug=1` hoặc trang `Dữ liệu kỹ thuật` riêng.
- "Tiến độ" là phần mới, làm trang Tôi có lý do quay lại.
- "Gia đình" chỉ hiện khi có hồ sơ trẻ hoặc người dùng mở.

### 5.7 `/account/sign-in` — Cửa

- **Không thanh tab dưới.** Đây là cửa, không phải tab.
- Thứ tự:
  1. **Chơi ngay** (nút chính, to) — vào sạp với hồ sơ máy.
  2. "Đăng nhập" (nút phụ) — Google, email.
  3. "Tạo tài khoản" (link).
- Câu: "Chơi không cần tài khoản. Đăng nhập nếu muốn giữ điểm trên mọi máy."
- Không "Dữ liệu kỹ thuật" trên màn chính; để ở footer.
- Google button dùng style chuẩn (trắng, logo Google) để tăng tin cậy.

### 5.8 `/family` — Phụ huynh

- Trang công khai, không cần đăng nhập: Tò He an toàn thế nào, hồ sơ, PIN, dữ liệu, thời gian chơi, câu hỏi.
- Từ app: `Tôi → Gia đình` (sau PIN) quản lý hồ sơ, giới hạn, nội dung.
- Giọng ấm, rõ; đây là nơi duy nhất dùng "bé", "bố mẹ", "cả nhà".
- Không đặt link "Gia đình" to trên header; để trong `Tôi` và footer.

### 5.9 Lần đầu và hồ sơ

- **Không có màn "Bạn là ai?" trước khi chơi.** Vào sạp, chơi luôn với hồ sơ máy; tên gợi ý chỉ hiện trong chip.
- Sau game đầu, một card nhỏ, bỏ qua được: "Giữ điểm trên máy khác? Đăng nhập." Không chặn, không lặp lại mỗi lần mở.
- Đổi tên/hình: một sheet "Tên hiển thị" + lưới avatar; avatar là tuỳ chọn, không bắt buộc; tên gợi ý và hình phải khớp.
- Link bàn `/r/…`: giữ tên + hình + đồng ý, nút "Vào chơi" dính đáy; đây là màn rõ nhất hiện tại, chỉ cần bớt chữ.
- Cài app: hỏi sau game thứ 2 hoặc trong `Tôi`; không hiện trên lần đầu.

### 5.10 Trạng thái

- **Loading**: skeleton đúng tỉ lệ cover/game, không chữ "Đang tải…" đơn độc.
- **404**: "Trò này không có trên sạp." + 3 cover + "Về sạp".
- **Mất mạng**: "Đang mất mạng. Trò đã mở trước đó vẫn chơi được." + danh sách offline.
- **Hết phiên**: "Phiên đã hết. Đăng nhập lại, hoặc chơi tiếp trên máy này."

## 6. Nội dung

### 6.1 Metadata mỗi game

| Trường | Dùng ở đâu | Ghi chú |
|---|---|---|
| `name` | mọi nơi | đã có |
| `hook` (≤ 60 ký tự) | card, hero, game page | mới; thay `kind` dài |
| `cover` (16:9) | card, hero, og | mới; `page/cover.png` |
| `icon` (1:1) | header game, PWA | đã có |
| `shots` (3) | game page | đã có `pictures`; cần ảnh |
| `tags` (2–3) | lọc, card | Giải đố, Bài, Phản xạ, Chơi cùng |
| `players` | chip | 1 người / 2–4 người |
| `round` | chip | 5 phút / 20 giây |
| `offline` | chip | có/không |
| `age` | `/family`, facts | **không** trên card mặt tiền |
| `leaderboard` | game page | đã có |

### 6.2 Editorial

- "Mới tuần này": 1–3 game, có ngày thật.
- "Sạp chọn": 1 game + 1–2 câu vì sao (do người viết, không do máy).
- "Chơi cùng": game có bàn + link.
- Không dùng "HOT", "Trending", "Top 10" nếu không có dữ liệu thật.

### 6.3 Câu chữ mẫu

- Hero: "Năm trò nhỏ. Chơi một ván rồi tính."
- Nút: "Chơi ngay" / "Chơi tiếp" / "Rủ bạn" / "Tạo bàn".
- Dải tin: "Không quảng cáo. Không xu. Không cần tài khoản."
- Game card: "Ghép Khối — 2048 nhưng có combo. 5 phút."
- Empty: "Sạp mở rồi. Chọn một trò."
- Auth: "Chơi không cần tài khoản. Đăng nhập nếu muốn giữ điểm."
- Family: "Bé chơi an toàn: không quảng cáo, không chat với người lạ, bố mẹ giữ PIN."

## 7. Đa thiết bị

| | Điện thoại 360–430 | Tablet 768–1024 | Máy tính 1280–1440 |
|---|---|---|---|
| Header | 56px, logo + search + avatar | 64px, logo + search + avatar | 72px, logo + nav + search + avatar |
| Nav | bottom 3 mục, 64px + safe area | rail 80px | rail 240px |
| Lưới game | 2 cột, gap 12 | 3–4 cột | 4–6 cột, card 220–280 |
| Hero | full-bleed, 4:3 hoặc 16:9 | 2 cột: hero + list | 2/3 hero + 1/3 list |
| Shelf | cuộn ngang, snap | cuộn ngang hoặc wrap | wrap |
| Game page | 1 cột, nút dính đáy | 2 cột: media + facts | 2 cột, max 1200 |
| Player | full-bleed, dọc/ngang | full-bleed | full-bleed, có thể cửa sổ |
| Bàn phím | — | — | `/` search, `Esc` thoát, `F` fullscreen |

Quy tắc:
- **Max width 1440**, content 1200; không để cột 660 lệch trái.
- **Không kéo giãn card** để lấp hàng; dùng `auto-fill` với max width, hoặc thêm shelf.
- **Ảnh bìa luôn 16:9**, không méo; `object-fit: cover`.
- **Safe area** cho bottom nav và nút dính đáy.
- **Landscape phone**: home 4 cột, header 48px; game full-bleed.

## 8. Nên bắt đầu từ đâu

### P0 — 1–2 tuần, rẻ, thấy ngay

1. **Card game có "Chơi"**: overlay play + nút; cả card click; hover/focus; bỏ "Rủ bạn" làm hành động chính.
2. **Bỏ tuổi khỏi card mặt tiền**; thay bằng tag + thời lượng.
3. **Bỏ SHA khỏi Tôi**; chuyển "Dữ liệu kỹ thuật" khỏi màn đăng nhập.
4. **Đổi thứ tự cửa**: "Chơi ngay" chính, "Đăng nhập" phụ; bỏ bottom nav ở màn auth.
5. **"Chơi tiếp" có ảnh bìa** và tên game, không phải banner chung.
6. **Empty state** cho Chơi cùng và Tôi.
7. **Desktop catalog**: max card width, 4–6 cột, không kéo 5 card thành 5 ô to.

### P1 — 3–6 tuần, thay bề mặt

1. **Trang chủ mới**: hero game + shelf + tất cả + dải tin; chuyển câu chuyện sang `/about`.
2. **Trang game store**: cover, shots, facts chip, cách chơi, game khác.
3. **Catalog mới**: cover, search, tag, shelf, editorial.
4. **Brand refresh**: token mới, viền/offset shadow, wordmark, cover system; test tương phản.
5. **Family area**: `/family` + `Tôi → Gia đình`; tách giọng.
6. **Layout system**: grid, rail, max width, breakpoints.

### P2 — sau

1. Bạn bè, người chơi gần đây, chat/emote trong bàn (có kiểm duyệt).
2. Gợi ý cá nhân hoá, thử thách ngày/tuần.
3. Thêm game, thể loại, bộ sưu tập.
4. A/B test, analytics chi tiết.

## 9. Đo

- **TTFP** (time to first play input): từ `home_view` đến lần chạm đầu trong game; mục tiêu p50 < 10s, p75 < 20s.
- **% người mới chơi trong 30s**.
- **Số game/phiên**, **số phiên/tuần**, **D1/D7**.
- **Đăng nhập sau game đầu** (không phải trước).
- **Cài app sau game thứ 2**.
- **Search/tag usage**; **game page → play**.
- **Bounce `/`**; **lỗi tải**; **LCP**.
- Chất lượng: 5–8 buổi thử 5 giây với người 16–24; first-click test; axe; 360/768/1440.

## 10. Rủi ro

| Rủi ro | Vì sao | Cách giảm |
|---|---|---|
| Mất người dùng gia đình hiện tại | Đổi giọng mặc định sang 16+ | Giữ `/family`, PIN, promise; copy rõ "vẫn an toàn cho bé" |
| 5 game không đủ giữ 16+ | Bề mặt tốt không sửa game yếu | Song song roadmap game; đừng hứa "nhiều game" |
| Ảnh bìa tốn thời gian/tiền | Cần vẽ/chụp | Dùng screenshot + khung chung trước; thuê vẽ sau |
| Contract/API phải đổi cho cover | `GameSummary` chỉ có `iconUrl` | Convention `page/cover.png` + API `coverUrl`; ADR nhỏ |
| SEO tụt vì `/` không còn bài giới thiệu | Google đang index nội dung home | Giữ `/about`, `/family`, `/games/` với nội dung thật; JSON-LD |
| Dark mode ảnh bìa chói | Ảnh sáng trên nền tối | Viền + giảm nhẹ brightness; không đổi màu ảnh |
| "Sạp" quá lạ | Người dùng chưa quen | Dùng "sạp" trong copy, giữ "Trò chơi" ở nav nếu cần |

## 11. Câu hỏi cho owner

1. **Tên/chất**: giữ Tò He + "đồ chơi nặn tay", hay đẩy mạnh sang "sạp game"?
2. **Trang chủ**: sạp game (danh mục + editorial) hay giới thiệu ngắn + danh mục?
3. **Cửa**: bỏ hẳn màn hỏi đăng nhập, hay giữ nhưng "Chơi ngay" lên trước?
4. **Gia đình**: trong `Tôi` + `/family`, hay tách khu riêng?
5. **Ảnh bìa**: đầu tư ngay (vẽ/chụp) hay dùng screenshot + khung tạm?
6. **Tab**: đổi "Trò chơi" thành "Sạp" hay giữ?

## Prototype

- [`prototype/home.html`](../prototype/home.html) — sạp công khai: hero, "Đang mở", "Chơi tiếp", "Mới", band "Rủ bạn",
  "Tất cả" + tag.
- [`prototype/game.html`](../prototype/game.html) — trang store: cover, facts chip, ảnh chụp, cách chơi, trò khác, nút
  Chơi dính đáy trên mobile.
- [`prototype/door.html`](../prototype/door.html) — cửa vào: "Chơi ngay" trước, "Đăng nhập" sau; máy đã chơi thấy
  "Chơi tiếp"; gợi ý "Giữ điểm này?" sau ván đầu.
- Ảnh bìa là hình tạm; câu chữ là mẫu; đây là concept để tranh luận, không phải spec.
