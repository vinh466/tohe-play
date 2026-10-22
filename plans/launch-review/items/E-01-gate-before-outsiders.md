# E-01 — Cổng trước khi mời người ngoài vào production

- Status: **open** — danh sách, chi tiết hoá ở phase Map
- Kind: enhancement — chuyển từ `plans/product-surface` E-05 (2026-10-21, Phase 1 đóng), vốn tiếp nhận E-10 ("Checklist
  ra mắt") của `plans/public-launch`
- Blocks: việc mời người ngoài đầu tiên, launch chính thức · Blocked by: — (Phase 1 đã xong)
- Decided: —

## Vì sao

Owner đang tự dùng prod ("tôi sẽ test 1 mình chứ chưa mời ai 1 thời gian", 2026-10-19). Ngày mời người ngoài là quyết
định của owner; trước ngày đó những việc dưới đây phải xong. Không chặn Phase 0/1.

## Danh sách (nguồn: [product-surface R-01](../../product-surface/research/R-01-backlog-review.md))

Mã item trong bảng (D-0x, E-0x) là của **plan cũ** — `product-surface` hoặc `public-launch`, ghi rõ ở từng dòng — không
phải item của plan này.

| # | Việc | Ai |
|---|---|---|
| 1 | Thử khôi phục backup prod (CNPG/R2) vào một DB tạm — khi owner báo launch "chín" (2026-10-22) | agent, owner cho phép |
| 2 | Load test phòng chơi (một API instance, ADR 0016) | agent, owner cho phép |
| 3 | `/security-review` toàn bộ bề mặt công khai (gồm trang mới của Phase 1 và của đợt 1 plan này) | agent |
| 4 | Thư tới Gmail / Outlook / Yahoo vào hộp chính (sau khi sửa DMARC) | agent + owner |
| 5 | Điều khoản + Quyền riêng tư đã duyệt (plan này E-05: bản vi gốc + en) — **cập nhật cho** hồ sơ máy trên server, link chia sẻ, đăng nhập Google, câu tuổi/đồng ý (`product-surface` D-06 Q6); liên hệ người vận hành (`hello@`, `product-surface` D-01 Q4). Owner 2026-10-21: chốt trong phase review, trước khi mở hẳn — không cập nhật theo từng tính năng | owner (agent soạn) |
| 6 | Alertmanager của prod có người nhận (E-08 Q2 của `public-launch`): Telegram, `telegram-bot-token` + `telegram-chat-id` ở Infisical `/monitoring`, rồi PR `platform-infra` | owner, `platform-infra` |
| 7 | Thời hạn xoá theo văn bản (`public-launch` E-07 Q7) | owner |
| 8 | Chế độ đăng ký + đường vào nhanh (`product-surface` D-05); proof-of-work bật | owner |
| 9 | ~~Domain lâu dài đã chốt (`product-surface` D-02)~~ — xong: `toheplay.io.vn` duy nhất (2026-10-19) | owner |
| 10 | Telemetry prod đọc được (`/health-report` với operator token) | owner (token) + agent |
| 11 | Gia đình ở UAT hay lên prod (`product-surface` E-01 Q4); mở lại `public-launch` D-15 (UAT có HTTPS) | owner |
| 12 | Cộng đồng đầu tiên + mã mời | owner |
| 13 | ~~Console ở `console.` sau Cloudflare Access, phiên riêng~~ — xong: owner bật Access (2026-10-22), kiểm từ ngoài: 302 sang `vinh466.cloudflareaccess.com` | agent + owner |
| 14 | Trang trạng thái `status.` có người theo dõi (`product-surface` D-01 Q11): Better Stack, gói miễn phí (#114) — owner làm bốn bước, agent đổi host sang `serving` | owner + agent |
