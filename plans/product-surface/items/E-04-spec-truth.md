# E-04 — Spec nói đúng Tò He hôm nay

- Status: **proposed** (2026-10-19)
- Kind: enhancement — docs
- Blocks: E-02, E-03 (agent đọc spec trước khi xây) · Blocked by: phần (b) chờ D-03
- Decided: —

## Vì sao

`docs/` là spec cho cả agent lẫn owner, và site đăng nó kèm `llms.txt`. Sau `public-launch`, vài trang nói ngược hẳn với
những gì đang chạy ([R-01](../research/R-01-backlog-review.md) mục C) — agent đọc chúng sẽ xây sai hướng.

## Đề xuất

**(a) Sửa sự thật — làm ngay, cùng PR docs của E-01:**

| Trang | Sửa |
|---|---|
| `docs/guides/uat.md` | bỏ "There is no production environment yet"; UAT là nơi thử đúng image sẽ lên prod; link `environments.md` |
| `docs/index.md` | hình hệ thống có prod, ba host; bỏ "built for one family" ở câu mở đầu (lời mới lấy từ (b)) |
| `docs/roadmap/walking-skeleton.md` | Production không còn "Later"; "Known gaps in M0" cập nhật; thêm mốc *Public launch* (xong, ADR 0021–0040) và *Product surface* (plan này, chưa xong) |
| `AGENTS.md` | một dòng luật production (E-01 §1); bảng Map thêm `deploy/` (chart, Caddy, UAT) |

**(b) Viết lại `docs/vision.md` — sau D-03, owner duyệt từng câu:** *Who it is for* có cộng đồng nhỏ; bỏ "public
community is not a goal", "public leaderboards" khỏi non-goals (đã có ADR 0029–0031); "anti-cheat beyond replays" thay
bằng engine độ tin; "scale beyond a few dozen" thay bằng giới hạn thật (một API instance, ADR 0016). Giữ nguyên: không quảng
cáo, không mua trong app, không chat tự do, không app native — trừ khi owner nói khác.

## Chi phí

Một PR docs nhỏ cho (a); một PR cho (b) sau D-03.
