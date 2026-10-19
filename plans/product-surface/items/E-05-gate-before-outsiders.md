# E-05 — Cổng trước khi mời người ngoài vào production

- Status: **open** — danh sách, chi tiết hoá khi P1 gần xong
- Kind: enhancement — tiếp nhận E-10 ("Checklist ra mắt") của `plans/public-launch`
- Blocks: việc mời người ngoài đầu tiên · Blocked by: D-05 (và P1 nên xong trước, không bắt buộc)
- Decided: —

## Vì sao

Owner đang tự dùng prod ("tôi sẽ test 1 mình chứ chưa mời ai 1 thời gian", 2026-10-19). Ngày mời người ngoài là quyết
định của owner; trước ngày đó những việc dưới đây phải xong. Không chặn Phase 0/1.

## Danh sách (nguồn: [R-01](../research/R-01-backlog-review.md))

| # | Việc | Ai |
|---|---|---|
| 1 | Thử khôi phục backup prod (CNPG/R2) vào một DB tạm | agent, owner cho phép |
| 2 | Load test phòng chơi (một API instance, ADR 0016) | agent, owner cho phép |
| 3 | `/security-review` toàn bộ bề mặt công khai (gồm trang mới của P1) | agent |
| 4 | Thư tới Gmail / Outlook / Yahoo vào hộp chính (sau khi sửa DMARC) | agent + owner |
| 5 | Điều khoản + Quyền riêng tư đã duyệt — **cập nhật cho** hồ sơ máy trên server, link chia sẻ, đăng nhập Google, câu tuổi/đồng ý (D-06 Q6); liên hệ người vận hành (`hello@`, D-01 Q4) | owner (agent soạn) |
| 6 | Alertmanager của prod có người nhận (E-08 Q2 của `public-launch`) | owner, `platform-infra` |
| 7 | Thời hạn xoá theo văn bản (E-07 Q7) | owner |
| 8 | Chế độ đăng ký + đường vào nhanh (D-05); proof-of-work bật | owner |
| 9 | ~~Domain lâu dài đã chốt (D-02)~~ — xong: `toheplay.io.vn` duy nhất (2026-10-19) | owner |
| 10 | Telemetry prod đọc được (`/health-report` với operator token) | owner (token) + agent |
| 11 | Gia đình ở UAT hay lên prod (E-01 Q4); mở lại D-15 (UAT có HTTPS) | owner |
| 12 | Cộng đồng đầu tiên + mã mời | owner |
