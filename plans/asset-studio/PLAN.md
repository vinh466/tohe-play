# Plan — Asset Studio: nguyên liệu cho game nhiều content

- Goal: agent (chủ yếu) và người tạo, duyệt và quản lý asset tập trung trong một Studio của Tò He. Game khai báo pack,
  version và chế độ tải mình dùng; nền tảng cung cấp và giữ rào. Một slice farming dựng trên Studio để chứng minh.
- Phase: **Map** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)). Brief đã được
  xác nhận ("đúng ý r", 2026-10-22). Map chờ owner xác nhận không thiếu gì. Resolve chạy song song: 9 trên 15 quyết
  định đã chốt.
- Started: 2026-10-22 · Branch: `plan/asset-studio` · PR: [#113](https://github.com/vinh466/tohe-play/pull/113) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** · Log: [log.md](log.md)
- Research: [R-01 AI tạo asset, tiền lệ](research/R-01-ai-assets-and-prior-art.md) ·
  [R-02 nguồn luật chơi, cơ chế](research/R-02-rules-and-mechanics-sources.md)

## Next — one item

**[D-14](items/D-14-studio-is-its-own-app.md) + [D-15](items/D-15-agent-tokens.md): Studio là app độc lập, và token
cho agent dùng chung.** Cả hai đã `proposed`. Hai item này quyết P0 có thêm `apps/studio` và host `studio.` hay không,
và token của agent trông thế nào để plan "agent cùng vận hành" sau này dùng lại được. Song song, agent làm **D-12**
(hình dạng contract) và **D-09** (kiểm tra asset), vì cả hai đã hết bị chặn.

## Waiting on the owner

1. **D-14**: Studio là app riêng ở `studio.` (session và studio role riêng; chung API và DB; console cấp quyền) chứ
   không nằm trong console?
2. **D-15**: một cơ chế token có scope cho mọi agent, scope nhạy cảm bị cấm trong code, `studio.draft` là scope đầu
   tiên?
3. **Map**: [map.md](map.md) có thiếu item nào không?
4. **D-07 (còn lại)**: asset Tò He tự làm phát hành dưới license nào? Nên chọn cùng LICENSE của code.
5. **D-10** (không gấp): ngân sách cho generator trả phí. P0 chạy được không cần.
6. **R2** (lúc graduate): tạo bucket, đưa credential vào Infisical. Đó là việc của owner và `platform-infra`.

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
| D-14 | [Studio là app độc lập ở `studio.`](items/D-14-studio-is-its-own-app.md) | decision | proposed — B | D-11 |
| D-15 | [Token cho agent dùng chung](items/D-15-agent-tokens.md) | decision | proposed — B | D-11 |
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
