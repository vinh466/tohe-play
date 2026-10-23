# D-10 — Agent làm asset bằng công cụ gì?

- Status: **decided** phần kỹ thuật · ngân sách **deferred** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: — · Blocked by: D-07, D-08
- Decided: phần kỹ thuật B (owner, chat 2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn"); ngân sách để sau tới P2 (owner, chat 2026-10-23)

## Why it matters

Owner: "ta sẽ xây các công cụ cho AI làm ra asset là chính". Agent cần làm được trọn một pack (lấy hoặc tạo, chỉnh vào
khuôn, kiểm, gửi) mà không cần người làm thay bước nào.

## What is true today

- Claude không tạo được ảnh raster, nhưng viết được code vẽ hình (R-01). Kit đã vẽ bằng Canvas 2D
  (`packages/game-kit/src/phaser/textures.ts`).
- PixelLab có MCP. Scenario có API và model giữ style (R-01). Điều khoản của các vendor chưa được tra.
- Kiểm tra có hiệu lực nằm phía server (D-09). Token có scope `studio.draft` (D-15).

## Options

### A — Chỉ có API; agent tự viết script mỗi lần

Mỗi agent làm một kiểu, kết quả không đều.

### B — Một CLI `tohe-studio` trong `packages/studio`; MCP về sau bọc đúng CLI đó

| Lệnh | Làm gì | Bậc |
|---|---|---|
| `style list` / `style show` | Đọc art bible: palette, cỡ tile, ảnh mẫu (D-08) | P0 |
| `pack init` | Tạo khung `pack.json` theo schema (sinh từ OpenAPI của module Studio) | P0 |
| `import` | Lấy từ pack CC0 hoặc CC-BY đã biết (vd. Kenney Tiny Farm), tự điền nguồn gốc và license | P0 |
| `draw` | Chạy một script vẽ bằng code (Canvas qua `@napi-rs/canvas`) ra PNG. Script được lưu kèm bản nháp, nên `source: code` tái lập được | P0 |
| `prepare` | Hậu xử lý cố định: ép về palette của style, căn lưới pixel, cắt viền, xoá metadata, đổi định dạng | P0 |
| `check --dry-run` | Gửi lên server kiểm (D-09), không lưu | P0 |
| `submit` / `status` | Gửi bản nháp, xem kết quả duyệt và lý do từ chối | P0 |
| `generate --vendor …` | Adapter cho generator, đổi được vendor; chỉ những vendor đã được tra điều khoản (D-07) | P2, sau khi có ngân sách |

- **MCP `tohe-studio`** (P2) dùng chung lõi với CLI và cùng token. Agent nào không có shell vẫn dùng được.
- **Đóng atlas và nén theo game** nằm ở build (E-02), không nằm trong Studio. Pack giữ từng file lẻ.

### C — Viết MCP ngay từ đầu

Hợp với agent không có shell. Nhưng agent của Tò He đều chạy trong repo có shell, nên CLI đủ cho P0 và dễ test hơn.

## Recommendation

**B.** P0 gồm `import`, `draw`, `prepare`, `check`, `submit`: đủ cho pilot mà không tốn tiền generator. P2 thêm
`generate` và MCP.

Chi phí chấp nhận:

- Một package mới cùng hai thư viện ảnh native (`sharp` hoặc `@napi-rs/canvas`). Phải qua luật pnpm minimum release
  age.
- Schema sinh từ OpenAPI của module Studio, theo cùng cách console đang làm.

## Decision

- **Ngân sách generator:** để sau tới P2. Owner: "ok chốt theo đề xuất ổn" (2026-10-23).
- **Phần kỹ thuật:** B, owner, chat 2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn".
