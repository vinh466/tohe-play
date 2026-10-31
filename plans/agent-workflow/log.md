# Log — Cách agent opencode làm việc

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, cái gì đang chờ ai. Tối đa 5 dòng mỗi mục.

## 2026-10-31 — agent

- Owner chốt toàn bộ L-01…L-10 ("chốt nha"); proposal chuyển từ draft sang locked.
- ADR kế tiếp là **0056**: 0055 đã dùng cho front page (launch-review), không dùng lại.
- Báo cáo repo: baseline Phase 0 (git, CI, plan, `pnpm verify`) trong phiên này.
- Baseline: 56/57 task xanh; `@tohe/api#test` đỏ 20/609 vì host hết inotify instance (128), không phải code; chạy
  riêng 19/19 `StudioLibraryTests` xanh. Cần owner nâng `fs.inotify.max_user_instances`.
- Plan space vào repo (PR này); Phase A PR [#180](https://github.com/vinh466/tohe-play/pull/180) mở, CI xanh; chờ
  owner merge, rồi Phase B.
