# D-01 — Định vị và giọng: 16+ mặc định, gia đình là lớp phụ

- Status: **decided** — owner, 2026-10-31, chat: "1. dong y nha" · "6. Sạp đi"
- Kind: decision
- Blocks: D-02, D-03, D-05, D-06, D-07 · Blocked by: —
- Decided: owner, 2026-10-31

## Why it matters

Mọi câu chữ, màu, bố cục và thứ tự hành động đều phụ thuộc vào việc sản phẩm nói với ai trước. Hiện tại nó nói với
"cả nhà", nên người 16+ thấy mình không thuộc về đây.

## Decision

- **Giữ tên Tò He** và chất "đồ chơi nặn tay"; không đổi tên, không làm lại thương hiệu từ đầu.
- **"Sạp" là mặt tiền**: ẩn dụ về một sạp game nhỏ, chọn kỹ, bày có chủ ý. Tab trong app đổi thành **Sạp**.
- **Register mặc định là 16+**: câu ngắn, như người bạn cùng bàn, không "cả nhà", "bé", "bố mẹ" ở mặt tiền.
- **Gia đình là register thứ hai**, chỉ ở `/family` và màn quản lý hồ sơ: ấm, rõ, kiên nhẫn, dùng "bé", "bố mẹ".
- Giữ lời hứa: không quảng cáo, không xu, không cần tài khoản, không dark pattern.

## Consequences

- Sửa `docs/conventions/voice-and-look.md` (đang nói "Tò He is for children and their parents") + ADR 0049/0055.
- Cần một ADR mới (0057) cho định vị "sạp game cho 16+, gia đình là lớp phụ".
- Copy của home, auth, catalog, account, together viết lại; `/family` giữ giọng cũ.
- Không đổi tên game, không đổi luật chơi.

## Discussion

**owner** (2026-10-31): "1. dong y nha" · "6. Sạp đi"
