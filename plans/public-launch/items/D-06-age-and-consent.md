# D-06 — Cổng tuổi và đồng ý điều khoản khi tự đăng ký

- Status: **proposed** — chờ owner kiểm tra mốc tuổi theo pháp luật
- Kind: decision
- Blocks: T2 spec (bước "Hoàn tất đăng ký"), E-07 · Blocked by: D-01
- Decided: —

## Vì sao cần chốt

Mở đăng ký cho mọi người thì trẻ em cũng có thể tự đăng ký. Theo D-01, trẻ em nên là **hồ sơ do người lớn tạo** —
cách này cũng là lời đồng ý của người lớn. Cần một bước nhỏ ở lúc đăng ký để giữ đúng điều đó, cộng với việc người dùng
đồng ý Điều khoản và Chính sách quyền riêng tư (E-07).

Hôm nay: không hỏi tuổi khi đăng ký (chỉ người lớn trong VPN dùng); hồ sơ trẻ em có `AgeBand` để lọc game.

## Phương án

### A — Tự xác nhận (agent đề xuất)
Ô đánh dấu "Tôi từ **N** tuổi trở lên và đồng ý Điều khoản & Chính sách quyền riêng tư". Lưu phiên bản điều khoản và
thời điểm đồng ý; điều khoản đổi thì hỏi lại. Chưa đủ tuổi: hướng dẫn "Nhờ bố mẹ tạo hồ sơ cho con trong tài khoản
của bố mẹ". Thu ít dữ liệu nhất.

### B — Hỏi ngày sinh
Chính xác hơn trên giấy, nhưng ngày sinh là dữ liệu cá nhân phải bảo vệ, và người khai sai vẫn khai sai.

### C — Không hỏi
Không có căn cứ nào khi một đứa trẻ tự đăng ký.

## Đề xuất của agent

**A.** Mốc **N** là câu hỏi pháp lý: luật bảo vệ dữ liệu cá nhân của Việt Nam có quy định riêng cho dữ liệu trẻ em.
Agent không tư vấn pháp lý — owner kiểm tra rồi chọn N. Áp dụng như nhau cho đăng ký email và đăng ký qua OAuth (bước
"Hoàn tất đăng ký" — design §3.2, §3.6).

## Câu hỏi cho owner

- **Q1** Đồng ý cách A? **N** bằng bao nhiêu sau khi bạn kiểm tra?

## Decision

—
