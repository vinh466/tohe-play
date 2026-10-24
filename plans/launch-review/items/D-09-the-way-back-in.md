# D-09 — Người quay lại gõ domain: vào hub bằng một chạm thế nào cho êm, và có cần đổi domain/path?

- Status: **researching** ([R-10](../research/R-10-surface-round-2-plan.md) Q-B)
- Kind: decision
- Blocks: E-08 · Blocked by: — · Mở lại một phần: [D-04](D-04-coming-back.md) (ADR 0046, không redirect ở `/`); có thể
  [D-05](D-05-hosts-and-paths.md) (ADR 0042)
- Decided: —

## Why it matters

Owner, 2026-10-24: "về user cũ cần vào game mà nhập domain vào đây cũng đáng quan tâm là làm sao để họ nhấn thêm 1 nút để
vào hub 1 cách thoải mái đi, research cho tôi 1 ý tưởng làm UIUX chỗ này thật sự mượt va hiệu quả k làm user khó chịu lẫn
hoang mang chuyện gì xảy ra đi (tôi đang nghi do bố cục domain/path ta k ổn quá, nói chung là khảo sát thử)".

## What is true today

Máy đã mở game thấy ở `/` một nút *Chơi tiếp* rộng cả màn, không nói hồ sơ nào, game gì. Người đã đăng nhập trên trình
duyệt mới thấy như người mới (trang tĩnh không biết phiên). App đã cài mở `/play`. ADR 0046 bỏ redirect ở `/`
(owner 2026-10-22). Chi tiết: R-10.

## Options

Sơ bộ, chưa đánh giá:

- **A — Thẻ "chào lại" có ngữ cảnh ở đầu `/`** (giữ ADR 0042, 0046): avatar và tên hồ sơ lần trước, game chơi gần nhất,
  một nút chính căn giữa ("Chơi tiếp Ghép Khối"), một nút phụ "Vào Tò He", một link nhỏ "Không phải An?". Vẽ ngay từ
  `localStorage`, không chớp; phần giới thiệu ở dưới.
- **B — Mở thẳng app cho máy quen** (sửa ADR 0046): B1 chuyển tiếp nhìn thấy được, một giây "Đang mở Tò He của An… ·
  Xem trang giới thiệu"; B2 cùng URL `/`, nội dung đổi theo máy (như GitHub với người đã đăng nhập).
- **C — Đổi bố cục path** (sửa ADR 0042, 0046, 0047): `/` là app cho mọi người, giới thiệu ở một path riêng; hoặc app ở
  host riêng. Đụng SEO, sitemap, service worker, link đã chia sẻ.
- **D — Dựa vào app đã cài**: mời cài rõ hơn để người quay lại mở icon chứ không gõ domain. Bổ trợ, không thay.

Tiêu chí so: số chạm và thời gian tới ô game; người dùng biết mình đang đi đâu; link `/` vẫn ra giới thiệu; không
cloaking; phiên đăng nhập có nhận ra được không; ADR nào phải sửa.

## Recommendation

None yet. **Giả thuyết ban đầu của agent** (2026-10-24, để research kiểm): A + D — chỗ hoang mang đến từ nút không ngữ
cảnh và hồ sơ tạm im lặng (D-10) nhiều hơn từ path; A giữ được link `/` cho người cần đọc. B1 là phương án dự phòng nếu
tiền lệ cho thấy người quay lại muốn vào thẳng.

## Decision

—
