# D-06 — Cổng tuổi và đồng ý điều khoản khi tự đăng ký

- Status: **proposed** — cách A (tự xác nhận) được chấp nhận 2026-10-17 ("ok ngu de xuat cua ban on nba"); **còn chờ owner chọn N**
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

**A.** Áp dụng như nhau cho đăng ký email và đăng ký qua OAuth (bước "Hoàn tất đăng ký" — design §3.2, §3.6).

### Mốc N — thông tin để owner chọn ([R-07](../research/R-07-children-data-law.md); không phải tư vấn pháp lý)

- Luật Trẻ em 2016: **trẻ em là người dưới 16 tuổi**.
- Nghị định 13/2023 (Điều 20) và Luật Bảo vệ dữ liệu cá nhân 2025 (hiệu lực 01/01/2026, Điều 24 theo bài tóm tắt):
  quyền của trẻ do **người đại diện theo pháp luật** (cha mẹ, người giám hộ) thực hiện; xử lý để **công bố** thông tin
  riêng tư của trẻ **từ đủ 7 tuổi** cần sự đồng ý của **cả trẻ và người đại diện**.

Agent đề xuất **N = 16**: khớp đúng định nghĩa trẻ em của luật Việt Nam. Dưới 16 thì không tự đăng ký account mà chơi
bằng một hồ sơ do bố mẹ tạo trong account của bố mẹ (D-01) — bố mẹ tạo hồ sơ chính là người đại diện đồng ý. Kèm theo:
khi bố mẹ bật cho hồ sơ của con hiện trên bảng công khai (mặc định tắt), màn bật có dòng "Tôi đã hỏi ý bé" — ứng với
điều kiện đồng ý của trẻ từ 7 tuổi khi công bố.

Câu chữ của luật 2025 chưa được đối chiếu văn bản gốc; nếu cần chắc chắn, owner nên đọc Công báo hoặc hỏi luật sư.

## Câu hỏi cho owner

- **Q1** Chọn **N = 16** như đề xuất?

## Decision

—
