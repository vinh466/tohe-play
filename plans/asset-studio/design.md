# Design — Asset Studio: thiết kế đích (v1, đang thành hình)

Trang này **ghép** các item thành một bức tranh và không tự quyết điều gì. Mỗi khẳng định trỏ về item quyết nó;
*(proposed)* là item chưa `decided`. Item nào được quyết khác đi thì sửa trang này trong cùng phiên. Ngày: 2026-10-22.

## Trả lời ngắn: đã đủ tới đâu?

- **Đã chốt** (owner, 2026-10-22):
  - Nguyên tắc "game khai báo mức phụ thuộc, nền tảng cung cấp và giữ rào" (D-01).
  - Studio là nguồn; game khoá version lúc build; ba chế độ tải theo pack; bốn rào (D-02).
  - Content nằm trong build của game (D-03).
  - Game tự quyết bố cục (D-04).
- **Đã đề xuất, chờ owner:** mô hình pack (D-05), nơi lưu P0 → P1 (D-06), license và nguồn gốc (D-07).
- **Còn mở:** art bible (D-08), cổng duyệt (D-09), công cụ cho AI và ngân sách (D-10), UI cho người (D-11), hình dạng
  contract (D-12), phục vụ lúc chạy (D-13).
- **Chưa có số đo nào**: kích thước, FPS, save, hạn mức storage trên iOS đều chờ E-06 và E-07.

## 1. Bức tranh

```mermaid
flowchart LR
  subgraph src[Nguồn]
    ai[AI agent<br/>generator, MCP]
    hu[Người<br/>upload]
    cc[Pack CC0 / CC-BY]
    co[Vẽ bằng code]
  end
  subgraph st[Tò He Studio]
    bible[Art bible · D-08]
    post[Hậu xử lý cố định · D-10]
    chk[Kiểm tra asset · D-09]
    rev{{Người duyệt · D-09}}
    lib[(Pack@version<br/>hash · nguồn gốc · license<br/>D-05 · D-06 · D-07)]
  end
  subgraph gm["games/&lt;id&gt;"]
    decl[game.json: assets<br/>pack@version + delivery · D-12]
    lock[assets.lock.json]
    build[Build bất biến · E-02]
  end
  subgraph run[Lúc chạy · games.toheplay.io.vn]
    b[bundle: trong /&lt;id&gt;/&lt;version&gt;/]
    p["precache / on-demand:<br/>/assets/&lt;hash&gt; · D-13 (sau S1)"]
  end
  ai --> post
  hu --> post
  cc --> post
  co --> post
  bible -.-> ai
  bible -.-> chk
  post --> chk --> rev --> lib
  lib --> decl --> lock --> build
  build --> b
  lib --> p
```

## 2. Các khối, chuẩn đứng sau, và nơi ở

| Khối | Làm gì | Chuẩn / tiền lệ | Ở đâu | Item |
|---|---|---|---|---|
| Nguyên tắc khai báo | Game chọn trong những gì nền tảng mở; nền tảng giữ rào; conformance kiểm điều đã khai báo | `capabilities`, `identity` (ADR 0045) | ADR mới | D-01 |
| Pack | Bộ asset cùng style, semver, mỗi file một sha256 | Pack Kenney; npm/semver *(proposed)* | `packages/studio` (schema) *(proposed)* | D-05 |
| Kho | P0: git trong monorepo, có giới hạn; P1: object storage + module Studio *(proposed)* | Content-addressed storage | `assets/<pack>/` → R2 hoặc MinIO | D-06 |
| License và nguồn gốc | Danh sách license cho phép (SPDX); `source` bắt buộc; asset AI có đủ nguồn gốc; credits sinh từ lock *(proposed)* | SPDX; USCO Part 2 | `pack.json`; màn credits trong kit | D-07 |
| Art bible | Palette, cỡ tile, góc nhìn, outline, ảnh mẫu; là đầu vào của generator và của máy kiểm | Style model của Scenario (R-01) | `assets/_bible/<style>/` | D-08 |
| Hậu xử lý | Ép palette, căn lưới pixel, cắt viền, kiểm tile liền mép, đóng atlas, nén | — | `packages/studio` CLI | D-10 |
| Kiểm tra asset | Kích thước, palette, nền trong suốt, mép tile, license, semver | Conformance của game | CI + `pnpm verify` | D-09 |
| Cổng duyệt | AI chỉ tạo được `draft`; người chuyển sang `approved`; P0 duyệt bằng PR | Roblox moderation (R-01) | PR → P1 console | D-09 |
| Công cụ cho AI | Adapter generator (đổi được vendor); MCP `tohe-studio` (search, generate, submit, pack) | PixelLab MCP (R-01) | P0 script → P2 MCP | D-10 |
| UI cho người | Upload, xem, duyệt | ADR 0042: `studio.` hay console | P1 | D-11 |
| Contract `assets` | `pack@version` + `delivery` theo pack; lock; key có type | `pnpm-lock` | `@tohe/contract` + ADR | D-12, E-01 |
| Build | Resolve, chỉ đóng gói file game dùng, ghi lock, tính `sizeBudgetKb` | — | `tools/games-host` hoặc plugin Vite | E-02 |
| Kit | Nạp asset theo key; `content` (Zod, loader, kiểm tham chiếu); helper bố cục | Phaser loader | `@tohe/game-kit` | E-03, E-04 |
| Phục vụ lúc chạy | `/assets/<hash>` immutable trên games origin, qua Cloudflare; service worker; nhãn "cần mạng" của hub | ADR 0005, 0007 | Caddy games + hub | D-13 |

## 3. Các luồng chính

**A. Agent làm một pack mới (P0)**

1. Đọc art bible (D-08).
2. Lấy từ pack CC0, gọi generator, hoặc vẽ bằng code (D-10).
3. Chạy hậu xử lý, rồi kiểm tra asset (D-09).
4. Mở PR với `pack.json`, ở trạng thái `draft` và đủ `source` (D-07).
5. Owner xem gallery trong PR (ảnh preview do CI sinh) và merge. Pack chuyển sang `approved`, `farm-crops@1.0.0` được
   publish (D-05, D-06).

**B. Game chọn nguyên liệu**

1. `/new-game` tìm trong thư viện theo tag và style (E-05).
2. Game khai báo trong `game.json`: `"assets": { "farm-crops": { "version": "1.0.0", "delivery": "bundle" } }` (D-12).
3. Build resolve, chỉ đóng gói file được dùng, ghi `assets.lock.json` (E-02).
4. Conformance kiểm lock, license, budget và chế độ tải (E-01).
5. Ra build bất biến `/<id>/<version>/`.

**C. Studio sửa một asset**

1. `farm-crops@1.0.1` được publish.
2. Game đang chạy **không đổi** (D-02, rào 2).
3. Game muốn dùng bản mới thì một PR nâng version, ra version game mới. Bản `1.0.0` vẫn còn (rào 3).

**D. (Sau S1) Game có chương 2 để `precache`**

1. Pack `farm-ch2` khai báo `delivery: precache`.
2. File ở `/assets/<hash>`; service worker của games origin tải về khi người chơi mở khoá chương.
3. Conformance tải xong rồi cắt mạng, game vẫn phải chạy (D-13, E-06).

## 4. Lộ trình (dự kiến, chưa phải graduation list)

| Bậc | Có gì | Mở khoá cho |
|---|---|---|
| **P0 — Studio as code** | `assets/` trong repo; schema pack; hậu xử lý và kiểm tra; duyệt bằng PR; contract `assets` chỉ với `bundle`; build và lock; kit nạp asset + `content`; credits | Pilot E-07 |
| **P1 — Studio có kho và UI** | Object storage theo hash; module Studio trong API; upload và duyệt (D-11); `precache` (sau E-06) | Asset lớn (nhạc); người upload |
| **P2 — Studio cho agent** | MCP `tohe-studio`; adapter generator (ngân sách theo D-10); `on-demand` khi có game cần | Agent tự làm asset là chính |

## 5. Còn mở

D-05, D-06, D-07 *(proposed)*; D-08 đến D-13 *(open)*. Thứ tự giải quyết theo [map.md](map.md).

## 6. Rủi ro chưa có lời đáp

| Rủi ro | Trả lời ở đâu |
|---|---|
| Style AI không đồng bộ, pack trông lệch nhau | D-08 art bible, D-10 hậu xử lý cố định, D-09 người duyệt |
| Ngân sách generator trả phí | D-10 (owner). P0 chạy được không cần trả phí: CC0 + vẽ bằng code |
| Ảnh AI không phù hợp trẻ em | D-09: bắt buộc người duyệt |
| Sai license trên repo public | D-07 danh sách cho phép + máy kiểm |
| Repo phình to | D-06: giới hạn P0, P1 dùng object storage |
| Studio thành phụ thuộc lúc chạy (homelab từng sập) | D-13: chỉ phục vụ file hash qua Cloudflare `immutable`; mặc định là `bundle` |
| iOS dọn storage, service worker trong iframe | E-06 (spike S1) |
| Xây Studio trước khi có game cần | E-07: pilot kéo P0, chỉ xây những gì pilot dùng |
