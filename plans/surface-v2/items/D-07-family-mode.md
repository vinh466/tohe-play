# D-07 — Chế độ gia đình: `/family` + `Tôi → Gia đình`

- Status: **decided** — owner, 2026-10-31, chat: "4. đòng ý"
- Kind: decision
- Blocks: E-04 · Blocked by: D-01
- Decided: owner, 2026-10-31

## Why it matters

Gia đình vẫn là người dùng thật (phụ huynh quản lý con), nhưng không được là mặt tiền. Cần một chỗ rõ ràng cho họ mà
người 16+ không phải đi qua.

## Decision

- **`/family`** — trang công khai, không cần đăng nhập: Tò He an toàn thế nào, hồ sơ trẻ, PIN, dữ liệu, thời gian chơi,
  câu hỏi. Giọng ấm, rõ; đây là nơi dùng "bé", "bố mẹ", "cả nhà".
- **`Tôi → Gia đình`** — quản lý hồ sơ, PIN, giới hạn nội dung/thời gian; sau cổng PIN.
- **Không** đặt link "Gia đình" to trên header; chỉ trong `Tôi` và footer.
- Hồ sơ trẻ vẫn có age band, catalog lọc theo tuổi, PIN khi đổi sang người lớn/link ra ngoài.
- Nếu chỉ có hồ sơ người lớn, mục "Gia đình" ẩn hoặc chỉ là một dòng "Thêm hồ sơ cho bé".

## Consequences

- Route mới: `/family` (apps/web) + `/account/family` (hub) — phải vào `packages/routes` trước (ADR 0042).
- `AccountPage` thêm mục Gia đình; `ProfilesPage`/`ParentGate` tái dùng.
- Copy family tách khỏi copy 16+; test voice-and-look.
- Không tách app/domain mới.

## Discussion

**owner** (2026-10-31): "4. đòng ý"
