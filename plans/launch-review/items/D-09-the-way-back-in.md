# D-09 — Người quay lại gõ domain: vào hub bằng một chạm thế nào cho êm, và có cần đổi domain/path?

- Status: **decided** — A + D, giữ domain/path ([ADR 0055](../../../docs/decisions/0055-front-page-explains-greets-and-the-app-asks-once.md))
- Kind: decision
- Blocks: E-08 · Blocked by: — · Mở lại một phần: [D-04](D-04-coming-back.md) (ADR 0046, cửa ở `/`);
  [D-05](D-05-hosts-and-paths.md) (ADR 0042) **giữ nguyên** theo đề xuất
- Decided: owner, 2026-10-25, chat: "duyet r nha" (đề xuất ở #166, owner merge)

## Why it matters

Owner, 2026-10-24: "về user cũ cần vào game mà nhập domain vào đây cũng đáng quan tâm là làm sao để họ nhấn thêm 1 nút để
vào hub 1 cách thoải mái đi, research cho tôi 1 ý tưởng làm UIUX chỗ này thật sự mượt va hiệu quả k làm user khó chịu lẫn
hoang mang chuyện gì xảy ra đi (tôi đang nghi do bố cục domain/path ta k ổn quá, nói chung là khảo sát thử)".

## What is true today

Máy đã mở game thấy ở `/` một nút *Chơi tiếp* rộng màn, trên H1, không tên hồ sơ, không game — trông như quảng cáo
(R-11 điểm đau 4). `/` và hub cùng origin, nên script tĩnh của `/` đọc được `localStorage` của hub (hôm nay chỉ đọc
`tohe:returning`). App đã cài mở `/play`. ADR 0046 bỏ redirect ở `/` (owner 2026-10-22). Người đã đăng nhập ở trình
duyệt mới không có phiên ở đó, nên với Tò He họ là máy mới.

## Có phải do domain/path?

**Không, theo khảo sát.** Ba trường hợp người quay lại:

| Người quay lại | Hôm nay | Đổi path có giúp? | Cái giúp thật |
|---|---|---|---|
| Đã chơi trên trình duyệt này | Nút *Chơi tiếp* không ngữ cảnh | Không: `/play` ở đâu thì vẫn cần một cửa | Cửa có tên, hình, game (A) |
| Đã đăng nhập ở máy khác, trình duyệt mới | Trang của người mới, chỉ có *Chơi ngay* | Không: trình duyệt mới không có phiên ở bất kỳ path nào | Nút "Tôi đã có tài khoản" ở hero ([D-08](D-08-landing-introduces.md)) |
| Dùng app đã cài | Mở `/play`, không qua `/` | — | Mời cài rõ hơn (D) |

Tách trang giới thiệu ở `/` và app ở path riêng là cách của Duolingo, Chess.com, Discord, GitHub (R-12); chỗ khác là cửa
của họ *nhận ra* người quen. Bố cục ADR 0042 giữ nguyên.

## Options

### A — Thẻ chào ở hero của `/` cho máy quen (giữ ADR 0042, sửa ADR 0046 phần cửa)

Hub ghi một khoá nhỏ `tohe:greeting` (tên và hình của hồ sơ chơi gần nhất, game gần nhất) ở chỗ nó ghi `tohe:returning`
hôm nay. Script tĩnh của `/` đọc nó trước lần vẽ đầu (như `returning.js`), nên không chớp; thẻ thay hai nút của hero:

- nút chính **"Chơi tiếp Ghép Khối"** → `/play/<game>`;
- nút phụ **"Vào Tò He"** → `/play`;
- link nhỏ **"Không phải An?"** → `/play`, mở "Ai đang chơi?".

H1 và phần giới thiệu giữ nguyên ở dưới, nên link `/` vẫn đọc được. Bot không có `localStorage`, thấy đúng trang của
người mới — không phải cloaking (R-12). Máy chỉ có `tohe:returning` (bản cũ) thì thẻ không tên: "Chơi tiếp". Giá: nhỏ —
script `apps/web` + một chỗ ghi ở hub + test; một câu trong ADR 0046.

### B — Mở thẳng app cho máy quen (sửa ADR 0046)

B1: một giây "Đang mở Tò He của An… · Xem trang giới thiệu" rồi chuyển. B2: `/` đổi nội dung thành màn đầu của app (như
GitHub). Bớt một chạm, nhưng chính là điều owner bỏ ngày 2026-10-22 ("triệt để bỏ đi"), làm người quay lại không đọc được
giới thiệu từ link `/`, và tự chuyển trang là chỗ dễ "hoang mang chuyện gì xảy ra". B2 cần đưa app shell và service worker
lên `/`.

### C — Đổi bố cục path (sửa ADR 0042, 0046, 0047)

`/` là app, giới thiệu ở path riêng; hoặc app ở host riêng. Không giải quyết hai trường hợp trên (bảng), đụng SEO,
sitemap, service worker, link đã chia sẻ, chứng chỉ và Caddy.

### D — Người quay lại dùng icon thay vì gõ domain

Section "Cài như một app" ở trang chủ (D-08), lời mời cài trong hub (G5 đã có "Đã cài app?"). Bổ trợ A.

## Recommendation

**A + D, giữ domain/path.** Đúng chữ của owner — "nhấn thêm 1 nút … thoải mái": một chạm, nút nói rõ đi đâu, với ai.
Cái giá chấp nhận: vẫn một chạm (B bớt được), và tên hồ sơ gần nhất hiện ở trang công khai trên máy dùng chung — như "Ai
đang chơi?" của hub đã hiện, có "Không phải An?".

**Wireframe điện thoại, máy quen** (câu chữ nháp):

```text
┌──────────────────────────────┐
│ [icon] Tò He   VI EN [Chơi tiếp]
│                              │
│   Trò chơi nhỏ cho cả nhà    │  H1 giữ nguyên
│ ┌──────────────────────────┐ │
│ │  (hình An)  Chào lại, An │ │
│ │ ┌──────────────────────┐ │ │
│ │ │ Chơi tiếp Ghép Khối  │ │ │  nút chính → /play/merge-block
│ │ └──────────────────────┘ │ │
│ │ ┌──────────────────────┐ │ │
│ │ │      Vào Tò He       │ │ │  nút phụ → /play
│ │ └──────────────────────┘ │ │
│ │      Không phải An?      │ │  → /play, "Ai đang chơi?"
│ └──────────────────────────┘ │
│ Tò He có gì …  (như D-08)    │
└──────────────────────────────┘
```

## Decision

**A + D, domain và path giữ nguyên** — owner, 2026-10-25: "duyet r nha", sau khi merge #166. Ghi ở ADR 0055; thẻ chào
build ở V1, khoá `tohe:greeting` ở V2.
