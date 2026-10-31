# Plan — Cách agent opencode làm việc trong Tò He

- Goal: một quy trình có kiểm soát cho agent opencode (DeepSeek V4.1 Flash) — research, spec, slice, build, verify,
  review, merge/deploy theo lời owner — với luật và gate đo được, để spec và code không lệch và không sinh PR rác.
- Phase: **Graduate** — 10/10 quyết định đã chốt 2026-10-31; Phase A (docs + config) là PR kế tiếp.
- Started: 2026-10-31 · Branch: `plan/agent-workflow-locked` · PR: [#180](https://github.com/vinh466/tohe-play/pull/180) (Phase A)
- Proposal: [proposal.md](proposal.md) · Log: [log.md](log.md)
- Trạng thái: luật đã khoá; chưa sửa `docs/`, `AGENTS.md`, `.claude/` hay thêm `.opencode/`.

## Next — one item

**Phase B — pilot** sau khi [#180](https://github.com/vinh466/tohe-play/pull/180) merge: một PR T1 nhỏ chạy đúng luật
mới, đo 6 chỉ số, rồi báo owner.

## Waiting on the owner

1. Review + merge [#180](https://github.com/vinh466/tohe-play/pull/180) (Phase A).
2. Chọn PR pilot cho Phase B (một việc T1 nhỏ).

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| L-01 | Phạm vi: luật chung cho mọi agent, adapter theo tool | decision | **decided** | — |
| L-02 | Model & effort: bỏ bảng gắn cứng Claude, ghi rõ thực tế một model | decision | **decided** | — |
| L-03 | Review độc lập: fresh context + checklist + owner ở T3 | decision | **decided** | L-02 |
| L-04 | Quyền merge/tag/deploy: `ask` cho merge/tag/deploy, `deny` cho phá hủy | decision | **decided** | — |
| L-05 | Kích thước PR: ≤ 12 file / ≤ 400 dòng (trừ generated) | decision | **decided** | — |
| L-06 | Research: R2 bắt buộc cho T3 và dependency mới | decision | **decided** | — |
| L-07 | Khi nào mở plan space, khi nào chỉ doc/ADR + packet | decision | **decided** | — |
| L-08 | Claims: một worker/PR, hot zone tuần tự, `claims check` trước commit | decision | **decided** | — |
| L-09 | Docs drift: mỗi PR một dòng "Docs:", audit mỗi 10 PR | decision | **decided** | — |
| L-10 | Deploy: chỉ theo lời, `release:check` trước, `check:*` sau | decision | **decided** | — |
| E-01 | Phase A: docs + ADR 0056 + `.opencode/` config, không code sản phẩm | enhancement | **in review** — #180 | — |
| E-02 | Pilot một PR nhỏ dưới luật mới, đo 6 chỉ số | enhancement | open | E-01 |
| E-03 | Plugin claims-guard cho opencode (chỉ nếu pilot lộ lỗi) | enhancement | open | E-02 |
| E-04 | Baseline `pnpm verify` trên máy này trước khi nhận việc | enhancement | done | — |

## Graduation list

Filled in after the owner locks the decisions: ADR 0056 (agent workflow is tool-neutral), the new
`docs/guides/opencode-workflow.md`, the edit to `docs/guides/working-with-agents.md`, the short block in `AGENTS.md`,
and `.opencode/` (config + four agents). Phase A is one PR; the pilot is Phase B; the plugin is Phase C.
