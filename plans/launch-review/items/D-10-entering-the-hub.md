# D-10 — Vào hub khi chưa đăng nhập: hỏi đăng nhập, hay chơi ngay bằng hồ sơ máy?

- Status: **proposed** — A ([R-11](../research/R-11-surface-today-and-evaluation.md), [R-12](../research/R-12-peers-front-door-and-first-run.md)); Q1 chờ owner
- Kind: decision
- Blocks: E-08 · Blocked by: — · Đụng: ADR 0043 (hồ sơ máy: thêm bước hỏi), ADR 0046 (màn đầu của khung); B mở lại
  brief của `product-surface` ("chơi ngay không cần tài khoản")
- Decided: —

## Why it matters

Owner, 2026-10-24: "luồng khi vào hub thì cũng nên hỏi user cần đăng nhập nếu chưa đăng nhập đi, tôi test thấy vào thẳng
với profile tạm nó hơi làm user k biết chuyện gì đang xảy ra".

## What is true today

- Khách chưa có phiên vào bất kỳ màn nào của khung là `RequireSession` **tự bật** chế độ hồ sơ máy (khoá `tohe:guest`)
  và tạo một hồ sơ tên ngẫu nhiên ("Thỏ Hiền Khô") — không hỏi, không giải thích (`apps/hub/src/session/session.ts`;
  R-11 điểm đau 1).
- **Màn chọn đã có** ở `/account/sign-in`: *Tiếp tục với Google*, "Tạo tài khoản", **"Chơi luôn, không cần tài khoản"**
  (bật cùng khoá đó) — nhưng người mới không bao giờ được đưa tới. Nó mở đầu bằng "Đăng nhập bằng email và mật khẩu đang
  tạm tắt." (R-11 điểm đau 6).
- **Bước "bạn là ai" đã có** ở link mời: tên gợi ý, 16 hình, "Mọi người ở bàn sẽ thấy tên và hình này".
- Hồ sơ máy chỉ ở máy cho tới khi ngồi bàn, chuyển máy hay gộp vào account; câu đồng ý hỏi lúc đó (ADR 0043, 0025).

## Options

### A — Màn chào lần đầu: hỏi đăng nhập, cho chọn chơi thử

Khách chưa có phiên **và chưa từng chọn** (chưa có `tohe:guest`) vào khung thì gặp màn chào (màn chọn ở
`/account/sign-in`, viết lại) thay vì hồ sơ im lặng:

1. Nút chính **Tiếp tục với Google** (và email khi bật) — "một tài khoản cho cả nhà: tiến độ theo bạn sang mọi máy, bé
   có hồ sơ riêng".
2. Nút phụ **Chơi thử trên máy này** — "tiến độ chỉ ở máy này, đăng nhập sau vẫn giữ" → bước **"Bạn là ai?"** (tên gợi ý +
   hình, dùng lại component của link mời, không hỏi đồng ý vì chưa có gì lên server) → danh mục.
3. Chip hồ sơ ở danh mục nói rõ: "An · trên máy này"; Tôi có "Đăng nhập để giữ tiến độ trên mọi máy".

Không gặp màn chào: link mời `/r/…`, `/s/…` (đã có bước riêng); máy đã ở chế độ hồ sơ máy (người chơi cũ không bị chặn
lại); người đã đăng nhập. Câu "đang tạm tắt" bỏ: chỉ hiện cách đang bật. Giá: một PR hub (đổi `RequireSession`, viết lại
màn chọn, bước "Bạn là ai?", chip), e2e smoke đổi bước đầu; sửa ADR 0046, ghi chú ở ADR 0043.

### B — Bắt đăng nhập trước khi chơi

Không có lựa chọn chơi thử. Trái brief của `product-surface` và ADR 0043; NN/g khuyên không chặn ở lần đầu; Baymard:
19% bỏ đi khi bị bắt tạo tài khoản (bối cảnh mua hàng); trẻ không có email, ông bà mở link Zalo sẽ kẹt. Cần ADR mới.

### C — Giữ vào thẳng, nói rõ hơn

Không có màn chào; hồ sơ hiện "Khách trên máy này" kèm một dải giải thích và nhắc đăng nhập sau ván đầu. Rẻ nhất, nhưng
không "hỏi" như owner muốn.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | "Hỏi đăng nhập" là bắt buộc (B) hay hỏi và cho chọn (A)? | **A** — hỏi ở lần đầu, chơi thử là nút phụ |
| Q2 | Người chơi cũ (đã có hồ sơ máy) có gặp màn chào một lần không? | Không; họ thấy chip "trên máy này" và lời mời đăng nhập ở Tôi |

## Recommendation

**A.** Làm đúng điều owner thấy thiếu (hỏi, nói rõ chuyện gì xảy ra) mà không chặn trẻ và người được mời; giống cách sản
phẩm cho trẻ làm ở lần đầu (YouTube Kids, Khan Academy Kids: hỏi người lớn, giải thích) — R-12 §3. Hai mảnh chính đã có
trong hub. Cái giá chấp nhận: người mới thêm một màn và một bước tên trước ván đầu (hôm nay là 0).

**Wireframe điện thoại** (câu chữ nháp):

```text
┌──────────────────────────────┐      ┌──────────────────────────────┐
│          [icon Tò He]        │      │ ← Quay lại                   │
│     Chào mừng đến Tò He      │      │ Bạn là ai?                   │
│  Một tài khoản cho cả nhà:   │      │ Tên và hình này ở trên máy   │
│  tiến độ theo bạn sang mọi   │      │ này thôi.                    │
│  máy, bé có hồ sơ riêng.     │      │ Tên  [ Hổ Mê Ngủ         ]   │
│ ┌──────────────────────────┐ │      │ Hình (16 hình, chọn 1)       │
│ │   Tiếp tục với Google    │ │      │                              │
│ └──────────────────────────┘ │ ───▶ │ ┌──────────────────────────┐ │
│ ─────────── hoặc ─────────── │      │ │        Vào chơi          │ │
│ ┌──────────────────────────┐ │      │ └──────────────────────────┘ │
│ │  Chơi thử trên máy này   │ │      └──────────────────────────────┘
│ └──────────────────────────┘ │
│ Tiến độ chỉ ở máy này;       │
│ đăng nhập sau vẫn giữ.       │
└──────────────────────────────┘
```

## Decision

—
