# D-05 — Asset và pack là gì: đơn vị phát hành, loại, metadata, version, hash?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-06, D-09, D-12 · Blocked by: D-02
- Decided: owner, chat 2026-10-22: "D-05 on"

## Why it matters

Contract (D-12), kho lưu (D-06), cổng duyệt (D-09) và công cụ cho AI (D-10) đều nói về "một asset" và "một version".
Chưa chốt mô hình thì mỗi phần sẽ tự hiểu một kiểu.

## What is true today

- Không có asset raster nào. Mọi hình đều vẽ bằng code (`packages/game-kit/src/phaser/textures.ts`), chỉ có `icon.svg`
  trong `games/*/public/`.
- Phaser 4.2 nạp sẵn được image, spritesheet, atlas (JSON), tilemap (Tiled JSON), audio và bitmap font. ADR 0012 chọn
  Phaser một phần vì lý do này.
- Pack CC0 phổ biến được phát hành theo **bộ** cùng style, ví dụ Kenney Tiny Farm có khoảng 130 file 16×16 (R-01).

## Options

### A — Mỗi asset có version riêng

Linh hoạt nhất. Nhưng một game farm sẽ khoá hàng trăm version, và một bộ tile cùng style có thể bị trộn bản cũ với bản
mới.

### B — Pack: một bộ asset cùng style, cùng mục đích, phát hành chung một version

- **Pack** (`farm-tiles`, `farm-crops`, `ui-icons`) có `pack.json` (schema Zod) và semver.
- **Version:** patch = sửa pixel, không đổi kích thước hay số frame; minor = thêm asset; major = xoá, đổi tên hoặc đổi
  kích thước. Game tự nâng version qua PR.
- **Mỗi file đánh hash** (sha256) để tải theo hash (D-02 rào 2) và để chia cache giữa các game.
- **Loại v1:** `image`, `spritesheet` (frame + animation), `tileset` (kích thước tile, luật autotile/Wang là tuỳ chọn),
  `audio`, `font`, `palette`. Map (Tiled) là content của game (D-03), map trỏ tới tileset.
- **Metadata mỗi asset:** id, loại, kích thước/frame, tag; `source` (`pack` / `upload` / `ai` / `code`, tác giả, license
  SPDX, URL; nếu là AI thì vendor, model, prompt, seed, ngày, theo D-07); `style` (art bible, D-08); `status`
  (`draft` → `approved` → `deprecated`) và ai duyệt, khi nào (D-09).

### C — Một thư viện lớn, chung một version

Đơn giản, nhưng sửa một icon là mọi game phải nâng version.

## Recommendation

**B.** Pack khớp với cách pack CC0 được phát hành và với cách style đồng bộ (một pack theo một art bible). Game chỉ
khoá vài pack.

Chi phí chấp nhận:

- Cần luật semver cho asset, và một máy kiểm luật đó (đổi kích thước mà chỉ tăng patch thì báo lỗi).
- Muốn lấy một asset từ pack khác thì phải khoá cả pack đó. Chỉ những file game thật sự dùng mới được đóng gói (E-02).

## Decision

**B: pack.** Owner: "D-05 on" (2026-10-22).

**Hệ quả:**

- D-12 khoá theo `pack@version`.
- Lock ghi sha256 từng file.
- Kiểm tra asset (D-09) có máy kiểm semver.
- `style` của pack trỏ tới art bible mà pack chọn (D-08).

## Discussion

**agent** (2026-10-22): schema của pack thuộc Studio, không thuộc `@tohe/contract`. Contract chỉ cần biết
`pack@version` và hash (D-12). Đề xuất đặt ở một package mới, ví dụ `packages/studio`, cùng với các công cụ (D-10).
