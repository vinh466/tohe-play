# Plan — Review trước launch

- Goal: Tò He hoàn chỉnh về mọi mặt trước khi launch chính thức — mọi màn và luồng đã rà, câu chữ và Điều khoản + Quyền
  riêng tư đã chốt, những tính năng owner coi là thiếu đã có, và Cổng trước người ngoài đã qua.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)) — brief là bản
  nháp; owner đã trả lời Q1, Q4, Q5 (2026-10-22), còn Q2, Q3 và lời xác nhận.
- Started: 2026-10-21 · Branch: `plan/launch-review` · PR: [tohe-play#109](https://github.com/vinh466/tohe-play/pull/109) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)
- Research: [R-01 bản đồ trang và lối vào](research/R-01-pages-and-ways-in.md)
- Trước đó: [`product-surface`](../product-surface/PLAN.md) (Phase 1, Close 2026-10-21)

## Next — one item

**Owner chốt brief** ([brief.md](brief.md)): Q2 (tính năng thiếu), Q3 (cách rà màn), xem *Xong khi* 7–8 mới (hai ngôn
ngữ, bố cục), rồi xác nhận. Sau đó là **Map** ([map.md](map.md), 9 item nháp); item đầu tiên là **D-02 bố cục** — câu
hỏi "trang giới thiệu vào từ đâu" đã có câu trả lời bằng sự thật ở [R-01](research/R-01-pages-and-ways-in.md).

## Waiting on the owner

1. **Brief**: Q2, Q3 và xác nhận ([brief.md](brief.md#câu-hỏi-cho-owner-trước-khi-chốt)).
2. Chuyển từ `product-surface`, đều thuộc Cổng ([E-01](items/E-01-gate-before-outsiders.md)):
   - **Alertmanager trên prod** (Telegram): tạo bot ở @BotFather, đưa token vào Infisical `platform/prod` `/monitoring`
     khoá `telegram-bot-token`, gửi chat id — agent mở PR `platform-infra` (cả cluster, owner merge).
   - Cloudflare: AI Crawl Control — Search cho phép; Bot Fight Mode / Under Attack / WAF challenge tắt; chọn dịch vụ
     `status.`.
   - Việc tay: thư thử tới `hello@`, `security@`; Resend `notify.` ([guide](../../docs/guides/mail-and-status.md)).
   - Khi chốt ngày launch: thử khôi phục bản sao lưu DB prod một lần (owner 2026-10-20: "để tôi thử sau").
   - *Tuỳ chọn:* Cloudflare Access cho `console.toheplay.io.vn` (owner 2026-10-20: MFA đủ cho lúc này).
3. Merge bằng `! gh pr merge <n> --repo vinh466/tohe-play --merge` khi agent báo "sẵn sàng" — PR draft là chưa sẵn sàng.

## Board

| ID | Item | Kind | Status | Blocked by |
|---|---|---|---|---|
| E-01 | [Cổng trước khi mời người ngoài](items/E-01-gate-before-outsiders.md) (từ `product-surface` E-05) | enhancement | open | — |

Các item khác nằm ở [map.md](map.md) dưới dạng nháp; lên board khi owner đồng ý map.

## Graduation list

Điền ở phase 4 (Converge): mỗi ADR, thay đổi docs và PR, theo thứ tự, kèm item nó đến từ.
