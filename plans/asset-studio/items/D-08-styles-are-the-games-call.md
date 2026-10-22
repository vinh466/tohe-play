# D-08 — Một style Tò He chung, hay mỗi game, mỗi pack một style?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-09, D-10 · Blocked by: —
- Decided: owner, chat 2026-10-22

## Why it matters

Đồng bộ style là điểm yếu nhất của AI tạo ảnh (R-01). Máy kiểm và generator cần biết đối chiếu với style nào. Nếu ép
một style chung thì mọi game trông giống nhau, và Tò He không đổi style được nếu không vẽ lại tất cả.

## What is true today

- Game hiện vẽ bằng code, theo token màu của Tò He (`packages/design-tokens`, ADR 0013). Không có art bible nào.
- Ba game thật đã có palette riêng (`games/merge-block/src/palette.ts`, `games/tap-merge/src/palette.ts`,
  `games/tien-len/src/palette.ts`).

## Options

### A — Một style Tò He chung cho mọi game

### B — Game tự chọn style; style Tò He là một lựa chọn mặc định, không bắt buộc

## Recommendation

B.

## Decision

**B**, owner:

> "tự do, game thích theo ToHe thì theo (nếu chưa có ý tưởng thì dựa vào cũng được), game cần đánh giá và tự chốt style
> phù hợp với lối của game để thu hút hơn k cần phụ thuộc chặt vào ToHe style (nhìu khi sau này ToHE còn đôi style nếu
> thích cơ haha)"

**Hệ quả:**

- **Nhiều art bible.** Mỗi style là một bản ghi trong Studio: palette, cỡ tile, góc nhìn, outline, ảnh mẫu. Style Tò He
  là một trong số đó, dùng khi game chưa có ý tưởng.
- **Pack khai báo style của nó** (D-05). Máy kiểm (D-09) và generator (D-10) đối chiếu với style của pack, không phải
  của Tò He.
- **Tò He đổi style thì game không bị kéo theo.** Game khoá pack theo version (D-02), và style Tò He mới là một art
  bible mới.
- **SPEC của game ghi style đã chọn và lý do** (E-05: `/new-game` có bước "chốt style": dùng style có sẵn hay tạo style
  mới).
- Đây là một trường hợp nữa của D-01: game khai báo, nền tảng cung cấp.
