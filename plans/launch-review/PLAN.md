# Plan — Review trước launch

- Goal: Tò He hoàn chỉnh về mọi mặt trước khi launch chính thức — mọi màn và luồng đã rà, câu chữ và Điều khoản + Quyền
  riêng tư đã chốt, những tính năng owner coi là thiếu đã có, và Cổng trước người ngoài đã qua.
- Phase: **Frame** (Frame → Map → Resolve → Converge → Graduate → Close — [process](../README.md#phases)) — brief là bản
  nháp, chờ owner.
- Started: 2026-10-21 · Branch: `plan/launch-review` · PR: (draft, mở cùng phiên này)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · Design: [design.md](design.md) · Log: [log.md](log.md)
- Trước đó: [`product-surface`](../product-surface/PLAN.md) (Phase 1, Close 2026-10-21)

## Next — one item

**Owner chốt brief** ([brief.md](brief.md)): trả lời Q1–Q5, sửa *Xong khi* và *Không thuộc plan này*, rồi xác nhận.
Q1 (phạm vi so với Phase 2/3) quyết định map lớn hay nhỏ, nên chốt trước tiên. Sau đó là **Map**: các item nháp ở
[map.md](map.md) thành danh sách owner đồng ý là đủ.

## Waiting on the owner

1. **Brief**: Q1–Q5 và xác nhận ([brief.md](brief.md#câu-hỏi-cho-owner-trước-khi-chốt)).
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
