# Plan — Asset Studio: nguyên liệu cho game nhiều content

- Goal: agent (chủ yếu) và người tạo, duyệt và quản lý asset tập trung trong một Studio của Tò He. Game khai báo pack,
  version và chế độ tải mình dùng; nền tảng cung cấp và giữ rào. Một slice farming dựng trên Studio để chứng minh.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)). Map và bốn
  item đã chốt có sẵn, vì owner đã chốt chúng trong chat trước khi plan mở.
- Started: 2026-10-22 · Branch: `plan/asset-studio` · PR: [#113](https://github.com/vinh466/tohe-play/pull/113) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** · Log: [log.md](log.md)
- Research: [R-01 AI tạo asset, tiền lệ](research/R-01-ai-assets-and-prior-art.md) ·
  [R-02 nguồn luật chơi, cơ chế](research/R-02-rules-and-mechanics-sources.md)

## Next — one item

**Owner xác nhận [brief.md](brief.md).** Sau đó làm **D-07** (license) trước, vì không asset nào được vào repo public
khi chưa có chính sách; song song là **D-05** (mô hình pack), vì nó chặn D-06, D-09 và D-12. Cả hai đã ở mức `proposed`.

## Waiting on the owner

1. **Brief**: ý định, ràng buộc, *Done when* và *Not this plan* đã đúng chưa?
2. **D-07**: danh sách license (CC0, CC-BY, OFL, MIT; CC-BY-SA tính sao?); asset Tò He tự làm phát hành dưới license nào?
3. **D-05**: pack (B) làm đơn vị phát hành?
4. **D-06**: P0 trong monorepo bằng git thường có giới hạn, P1 chuyển sang object storage?
5. **D-08** (sớm thôi): một style Tò He chung, hay mỗi game hoặc mỗi pack một style?
6. **D-10** (không gấp): ngân sách cho generator trả phí. P0 chạy được không cần.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | [Game khai báo, nền tảng giữ rào](items/D-01-declare-dependencies.md) | decision | **decided** | — |
| D-02 | [Studio là nguồn · 3 chế độ tải · rào](items/D-02-studio-source-and-delivery.md) | decision | **decided** | D-01 |
| D-03 | [Content dạng data trong build](items/D-03-content-as-data.md) | decision | **decided** (tạm) | — |
| D-04 | [Game quyết bố cục](items/D-04-layout-is-the-games-call.md) | decision | **decided** (tạm) | — |
| D-05 | [Asset và pack](items/D-05-asset-and-pack-model.md) | decision | proposed — B (pack) | D-02 |
| D-06 | [Studio P0 lưu ở đâu](items/D-06-where-studio-lives.md) | decision | proposed — A → D | D-05 |
| D-07 | [License và nguồn gốc](items/D-07-licence-and-provenance.md) | decision | proposed — B | — |
| D-08 | Art bible: style chung hay theo game | decision | open | — |
| D-09 | Cổng duyệt + kiểm tra asset | decision | open | D-05, D-07, D-08 |
| D-10 | Công cụ cho AI: generator, hậu xử lý, MCP | decision | open | D-07, D-08 |
| D-11 | Studio cho người: ở đâu, ai vào | decision | open | D-06, D-09 |
| D-12 | Contract `assets` + lock + key có type | decision | open | D-01, D-02, D-05 |
| D-13 | Phục vụ `precache` / `on-demand` | decision | open | D-02, E-06 |
| E-01 | Game Contract + conformance cho `assets` | enhancement | open | D-12 |
| E-02 | Build: resolve · đóng gói · lock | enhancement | open | D-06, D-12 |
| E-03 | Kit: nạp asset + `content` | enhancement | open | D-03, D-12 |
| E-04 | Kit + conformance: bố cục (gồm spike S3) | enhancement | open | D-04 |
| E-05 | Quy trình agent: `/new-game`, `/new-asset` | enhancement | open | E-01, D-09 |
| E-06 | Spike S1 + hạn mức lưu trữ | enhancement | open | — |
| E-07 | Pilot: slice Vườn Rau trên Studio P0 | enhancement | open | E-01, E-02, E-03, E-04, D-09 |

## Graduation list

Điền ở phase 4 (Converge). Lộ trình dự kiến P0 → P1 → P2 ở [design.md §4](design.md#4-lộ-trình-dự-kiến-chưa-phải-graduation-list).
Dự kiến có ít nhất hai ADR: nguyên tắc khai báo (D-01) và asset trong Game Contract (D-02, D-12).
