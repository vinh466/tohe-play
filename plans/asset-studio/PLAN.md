# Plan — Asset Studio: nguyên liệu cho game nhiều content

- Goal: agent (chủ yếu) và người tạo, duyệt và quản lý asset tập trung trong một Studio của Tò He. Game khai báo pack,
  version và chế độ tải mình dùng; nền tảng cung cấp và giữ rào. Một slice farming dựng trên Studio để chứng minh.
- Phase: **Graduate** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)). 14 trên 15
  quyết định đã chốt, 1 để sau (D-13). Danh sách graduate **[delivery.md](delivery.md)** được duyệt: owner, chat
  2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn, bạn hãy theo đề xuất làm việc đi".
- **Quyền owner giao** (2026-10-24): "bạn đc merge PRs và deploy prod giúp tôi nhé, có 1 phiên Claude khác đang làm việc
  về surface nên bạn cũng cẩn thận làm song song với bên đó nha". Agent merge PR của plan này và đưa lên UAT rồi prod theo
  [Environments and releases](../../docs/guides/environments.md). Trước mỗi lần tag thì báo phiên `launch-review`.
- Started: 2026-10-22 · Branch: `plan/asset-studio` · PR: [#113](https://github.com/vinh466/tohe-play/pull/113) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** ·
  **Delivery: [delivery.md](delivery.md)** · Log: [log.md](log.md)
- Research: [R-01 AI tạo asset, tiền lệ](research/R-01-ai-assets-and-prior-art.md) ·
  [R-02 nguồn luật chơi, cơ chế](research/R-02-rules-and-mechanics-sources.md)

## Next — one item

**N1–N3** (lane Nền, chỉ docs): ADR 0049 nguyên tắc khai báo, ADR 0050 Asset Studio (sửa hàng *Developers* của ADR 0046:
`studio.` có session riêng), ADR 0051 token cho agent. Sau đó B1, K2, K3 chạy song song theo claims.

## Waiting on the owner

1. **S2, hạ tầng** (cần trước khi Studio chạy trên prod, và trước V1): bucket R2 (phần đã duyệt cho đọc công khai) và
   credential trong Infisical; DNS `studio.toheplay.io.vn`. Agent mở PR `platform-infra` cho ingress khi tới S1.
2. Không gì khác: D-13, ngân sách D-10 và license asset Tò He đã để sau theo lời owner.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| D-01 | [Game khai báo, nền tảng giữ rào](items/D-01-declare-dependencies.md) | decision | **decided** | — |
| D-02 | [Studio là nguồn · 3 chế độ tải · rào](items/D-02-studio-source-and-delivery.md) | decision | **decided** | D-01 |
| D-03 | [Content dạng data trong build](items/D-03-content-as-data.md) | decision | **decided** (tạm) | — |
| D-04 | [Game quyết bố cục](items/D-04-layout-is-the-games-call.md) | decision | **decided** (tạm) | — |
| D-05 | [Asset và pack](items/D-05-asset-and-pack-model.md) | decision | **decided** — B (pack) | D-02 |
| D-06 | [Lưu: object storage + DB, build có cache](items/D-06-where-studio-lives.md) | decision | **decided** — D | D-05 |
| D-07 | [License và nguồn gốc](items/D-07-licence-and-provenance.md) | decision | **decided** — B (license asset Tò He để sau) | — |
| D-08 | [Style do game chọn](items/D-08-styles-are-the-games-call.md) | decision | **decided** — B | — |
| D-09 | [Tiêu chí duyệt + máy kiểm](items/D-09-review-and-checks.md) | decision | **decided** — B | D-05, D-07, D-08 |
| D-10 | [Công cụ cho agent: CLI, MCP, generator](items/D-10-tools-for-agents.md) | decision | **decided** — B · ngân sách **deferred** | D-07, D-08 |
| D-11 | [Studio chạy ở đâu · ai được làm gì](items/D-11-where-studio-runs-and-who-writes.md) | decision | **decided** — A | D-06 |
| D-12 | [Contract `assets` + lock + key có type](items/D-12-assets-in-the-contract.md) | decision | **decided** — B | D-01, D-02, D-05 |
| D-13 | [Phục vụ `precache` / `on-demand`](items/D-13-runtime-delivery.md) | decision | **deferred** (sau S1 + game cần) | D-02, E-06 |
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

**[delivery.md](delivery.md)**, owner duyệt 2026-10-24. 17 PR trong 8 lane: **N** nền (N1–N3) · **B** backend (B1–B4) ·
**C** contract (C1) · **S** Studio (S1, cùng S2 hạ tầng của owner) · **T** công cụ (T1–T2) · **K** kit (K1–K3) · **W** quy
trình (W1) · **V** pilot Vườn Rau (V1–V2). Bốn ADR mới: nguyên tắc khai báo (N1), Asset Studio kèm host `studio.` (N2),
token cho agent và danh sách scope cấm (N3), asset trong Game Contract (C1).
