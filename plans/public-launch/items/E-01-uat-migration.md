# E-01 — Chuyển dữ liệu UAT sang mô hình mới (household → account, username → email)

- Status: **decided** (2026-10-18, chat: "theo đề xuất … impl toàn bộ") — cách chuyển như bảng dưới
- Kind: enhancement
- Blocks: deploy T2 lên UAT · Blocked by: D-01, D-02, D-17
- Decided: hướng — owner, 2026-10-17, chat ("còn lại các dề xuất của bạn ổn nha", chấp nhận khuyến nghị "migrate
  tài khoản username → bắt thêm email ở lần đăng nhập kế")

## Vì sao

UAT giữ dữ liệu thật của gia đình và không được wipe (`docs/guides/uat.md`, ADR 0010). Migration chạy khi API khởi
động; không ai chạy migration tay trên UAT.

## Cách chuyển (đề xuất, theo D-01 phương án A)

| Hôm nay | Sau khi chuyển |
|---|---|
| Household có adult A1 (tạo sớm nhất) … Ak, các hồ sơ trẻ em | Mỗi adult là một account riêng; **hồ sơ trẻ em thuộc A1**; hồ sơ adult thuộc account của chính người đó |
| Đăng nhập bằng username | Còn dùng được tới khi account thêm email; lần đăng nhập kế bắt buộc màn "Thêm email" (mã xác minh) rồi chỉ đăng nhập bằng email |
| Tên hồ sơ | Giữ nguyên làm tên (D-17 — không cần duy nhất); mỗi hồ sơ được cấp một ID 12 số |
| Bàn "chỉ trong nhà", `RoomHistory.HouseholdId` | Bàn "chỉ trong account"; lịch sử gắn với account sở hữu hồ sơ |
| `Household.TelemetryEnabled` | Copy sang từng account của household |
| Mã mời adult thứ hai | Bỏ |

Hệ quả owner đã chấp nhận (D-01 Q4): adult thứ hai trong một household không quản lý hồ sơ trẻ em nữa (chúng thuộc
A1); gia đình dùng chung account của A1 trên máy gia đình, đồng sở hữu làm sau.

## Kiểm chứng trước khi lên UAT

Khôi phục bản dump UAT mới nhất (`~/backups/tohe-uat/`) vào một database dev riêng, chạy migration, kiểm tra từng
household bằng tay, rồi mới deploy bằng `deploy/uat/deploy.sh` (script tự backup trước). Username bị bỏ hẳn khi mọi
account trên UAT đã có email.
