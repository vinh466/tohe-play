# D-05 — Host và path: giữ bố cục của ADR 0042, hay đổi gì trước launch?

- Status: **proposed** (agent, 2026-10-22)
- Kind: decision
- Blocks: — · Blocked by: — · Đi cùng: [D-01](D-01-languages.md), [D-02](D-02-layout.md)
- Decided: —

## Why it matters

Owner (2026-10-22): "quay lai bai toan bo cuc chia trang xep sap subdomain hay path da hop ly chua, ban co the reseach hoc
hoi de review xem ta da toi uu chua". Đổi host trước khi có người ngoài là rẻ nhất.

## What is true today

Xem [R-04](../research/R-04-hosts-and-paths-review.md).

- Mọi quyết định lớn của ADR 0042 đều khớp cách các sản phẩm lớn làm và khớp hướng dẫn của Google: host theo ranh giới tin
  cậy, app cùng gốc, `docs.` riêng, `/en/` là thư mục con, một PWA.
- Điểm duy nhất lệch khỏi cách được khuyên là **game ở `games.`, cùng site với gốc và với `console.`** (vì `io.vn` nằm trong
  PSL). Hiện điểm này được che bởi sandbox, CSP của game, `SameOriginGuard` và cookie `__Host-`.
- Owner đã chọn một domain (ADR 0040, 2026-10-18).
- `console.` chưa bật Cloudflare Access (owner 2026-10-20: tuỳ chọn).

## Options

### A — Giữ bố cục; thêm namespace của D-01, D-02; mở lại câu domain của game khi có điều kiện *(đề xuất)*

- **Thêm vào ADR 0042**: namespace `/together`, `/en/…`, và luật bỏ redirect ở `/` (D-02).
- **Điều kiện mở lại**: Tò He nhận một game **không do repo này viết** thì game chuyển sang **domain riêng**, trước khi game
  đó lên. Ghi điều kiện này vào ADR.
- **Bật Cloudflare Access cho `console.`** là một dòng của Cổng (E-01, dòng 13).
- **Cái giá**: gần như không, vì đi cùng ADR của D-02.

### B — Chuyển game sang domain riêng ngay bây giờ

- **Làm gì**: một domain mới (ví dụ `toheplay-games.io.vn`, hoặc một gTLD rẻ) cùng zone Cloudflare; đổi giá trị chart ở
  `platform-infra`; `frame-src`, `img-src` của hub; một ADR sửa ADR 0040.
- **Được**: game khác site với hub và console; zone của hub được tự do chặn bot (ADR 0040 đã nêu).
- **Cái giá**: một PR, việc DNS của owner, một domain phải giữ.
- **Vì sao không vội**: URL của game không được index và không ai chia sẻ, nên chuyển sau không đắt hơn bao nhiêu.

## Recommendation

**A.** Bố cục hôm nay đã gần tối ưu. Cái đáng làm trước launch là bật Access cho console và ghi điều kiện mở lại câu domain
của game. Nếu owner muốn phòng thủ chiều sâu ngay (vì "gia rat re"), B cũng hợp lý. Đây là lựa chọn về độ chắc tay, không
phải sửa một lỗi.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | A hay B? | A |
| Q2 | Bật Cloudflare Access cho `console.` trước launch? | Có |

## Decision

—

## Discussion

**agent** (2026-10-22): scout xếp `games.` cùng site là rủi ro "cao". Agent kiểm code và thấy phần lớn các việc scout đề
xuất đã có sẵn (`SameOriginGuard`, `__Host-`, `form-action 'none'`, `connect-src 'self'`). Phần còn lại là chiều sâu,
nên agent hạ xuống "chấp nhận được với game của Tò He".
