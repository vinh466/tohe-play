# Plan — Asset Studio: nguyên liệu cho game nhiều content

- Goal: agent (chủ yếu) và người tạo, duyệt và quản lý asset tập trung trong một Studio của Tò He. Game khai báo pack,
  version và chế độ tải mình dùng; nền tảng cung cấp và giữ rào. Một slice farming dựng trên Studio để chứng minh.
- Phase: **Resolve** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)). Brief:
  "đúng ý r" (2026-10-22). Map: "ổn đó" (2026-10-23), trả lời cho lời hỏi chốt D-14, D-15 và xác nhận map đủ. 11 trên
  15 quyết định đã chốt.
- Started: 2026-10-22 · Branch: `plan/asset-studio` · PR: [#113](https://github.com/vinh466/tohe-play/pull/113) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** · Log: [log.md](log.md)
- Research: [R-01 AI tạo asset, tiền lệ](research/R-01-ai-assets-and-prior-art.md) ·
  [R-02 nguồn luật chơi, cơ chế](research/R-02-rules-and-mechanics-sources.md)

## Next — one item

**D-12 (hình dạng contract `assets`, lock, key có type), agent đưa lên `proposed`.** Đây là phần còn lại lớn nhất về
kiến trúc, và nó chặn E-01, E-02, E-03. Cùng phiên đó: **D-09** (tiêu chí duyệt, kiểm tra tự động) và phần kỹ thuật của
**D-10** (hậu xử lý, CLI, MCP). Xong ba item này thì sang Converge: viết danh sách PR và ADR để graduate.

## Waiting on the owner

Ba lời "để sau" mà chỉ owner nói được (agent đề xuất `deferred`, kèm điều kiện mở lại):

1. **D-13** (`precache` / `on-demand`): để sau, mở lại khi spike S1 (E-06) có kết quả **và** có game đầu tiên cần.
   P0 chỉ có `bundle`.
2. **D-10, phần ngân sách**: để sau tới P2. P0 và pilot dùng pack CC0 và hình vẽ bằng code, không tốn tiền generator.
3. **D-07, license cho asset Tò He tự làm**: để sau tới khi chọn LICENSE cho code. Trong lúc chờ, metadata ghi
   `LicenseRef-Tohe-Internal` ("chỉ dùng trong game của Tò He").

Lúc graduate: **R2** (bucket, credential trong Infisical) và **DNS + ingress cho `studio.`** là việc của owner và
`platform-infra`.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | [Game khai báo, nền tảng giữ rào](items/D-01-declare-dependencies.md) | decision | **decided** | — |
| D-02 | [Studio là nguồn · 3 chế độ tải · rào](items/D-02-studio-source-and-delivery.md) | decision | **decided** | D-01 |
| D-03 | [Content dạng data trong build](items/D-03-content-as-data.md) | decision | **decided** (tạm) | — |
| D-04 | [Game quyết bố cục](items/D-04-layout-is-the-games-call.md) | decision | **decided** (tạm) | — |
| D-05 | [Asset và pack](items/D-05-asset-and-pack-model.md) | decision | **decided** — B (pack) | D-02 |
| D-06 | [Lưu: object storage + DB, build có cache](items/D-06-where-studio-lives.md) | decision | **decided** — D | D-05 |
| D-07 | [License và nguồn gốc](items/D-07-licence-and-provenance.md) | decision | **decided** — B (còn license asset Tò He) | — |
| D-08 | [Style do game chọn](items/D-08-styles-are-the-games-call.md) | decision | **decided** — B | — |
| D-09 | Cổng duyệt + kiểm tra asset | decision | open | D-05, D-07, D-08 |
| D-10 | Công cụ cho AI: generator, hậu xử lý, MCP | decision | open | D-07, D-08 |
| D-11 | [Studio chạy ở đâu · ai được làm gì](items/D-11-where-studio-runs-and-who-writes.md) | decision | **decided** — A | D-06 |
| D-12 | Contract `assets` + lock + key có type | decision | open | D-01, D-02, D-05 |
| D-13 | Phục vụ `precache` / `on-demand` | decision | open | D-02, E-06 |
| D-14 | [Studio là app độc lập ở `studio.`](items/D-14-studio-is-its-own-app.md) | decision | **decided** — B | D-11 |
| D-15 | [Token cho agent dùng chung](items/D-15-agent-tokens.md) | decision | **decided** — B | D-11 |
| E-01 | Game Contract + conformance cho `assets` | enhancement | open | D-12 |
| E-02 | Build: resolve · cache · đóng gói · lock | enhancement | open | D-06, D-12 |
| E-03 | Kit: nạp asset + `content` | enhancement | open | D-03, D-12 |
| E-04 | Kit + conformance: bố cục (gồm spike S3) | enhancement | open | D-04 |
| E-05 | Quy trình agent: `/new-game` (chốt style), `/new-asset` | enhancement | open | E-01, D-09, D-14, D-15 |
| E-06 | Spike S1 + hạn mức lưu trữ | enhancement | open | — |
| E-07 | Pilot: slice Vườn Rau trên Studio P0 | enhancement | open | E-01, E-02, E-03, E-04, D-09, D-14, D-15 |

## Graduation list

Điền ở phase 4 (Converge). Lộ trình dự kiến P0 → P1 → P2 ở [design.md §4](design.md#4-lộ-trình-dự-kiến-chưa-phải-graduation-list).
Dự kiến có ít nhất bốn ADR: nguyên tắc khai báo (D-01); asset trong Game Contract (D-02, D-12); host `studio.` (D-14,
đổi từ giữ chỗ sang dùng thật theo ADR 0042); token cho agent và danh sách cấm (D-15).
