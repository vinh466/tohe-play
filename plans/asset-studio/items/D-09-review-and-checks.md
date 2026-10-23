# D-09 — Duyệt asset theo tiêu chí gì, và máy kiểm những gì?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-05, E-07 · Blocked by: D-05, D-07, D-08
- Decided: owner, chat 2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn"

## Why it matters

Trẻ em chơi. AI chỉ tạo được bản nháp (D-11). Asset đã duyệt thì phát hành công khai và không bao giờ bị xoá (D-02, rào
3). Máy phải lọc trước để người chỉ phải xem những gì máy không xem được.

## What is true today

- Người duyệt là reviewer trong app Studio, bắt buộc 2FA (D-14). Agent không bao giờ duyệt (D-15).
- Danh sách license B (D-07); style do pack khai báo (D-08); pack theo semver (D-05).

## Options

### A — Chỉ người duyệt

Đơn giản, nhưng người phải soi pixel, license, semver. Dễ sót và tốn thời gian.

### B — Máy kiểm phía server là cổng cứng, người duyệt theo checklist, có đường rút khẩn cấp

**Máy kiểm.** Chạy mỗi lần tải bản nháp lên và chạy lại lúc duyệt. Server là nơi kiểm có hiệu lực; CLI gọi
`--dry-run` lên server để agent sửa trước khi gửi (D-10).

| Nhóm | Kiểm gì |
|---|---|
| File | Định dạng cho phép (P0: PNG, WebP; audio và font chốt khi graduate theo bảng hỗ trợ trình duyệt); magic bytes khớp đuôi file; xoá metadata (EXIF); chặn "bom" giải nén (giới hạn số pixel); giới hạn byte mỗi file và mỗi pack |
| Hình | Kích thước là bội của cỡ tile của style; lưới frame của spritesheet khớp metadata; nếu style là pixel art thì mọi pixel nằm trong palette và alpha chỉ là 0 hoặc 255; tileset có luật Wang thì mép các tile ghép được với nhau phải khớp |
| Metadata | id không trùng; style tồn tại; tag hợp lệ; `source` đủ trường |
| License | SPDX trong danh sách cho phép; CC-BY có tên tác giả để ghi công; asset AI phải có vendor đã được tra điều khoản |
| Semver | So với version trước: xoá, đổi tên hay đổi kích thước thì phải tăng major; thêm asset thì phải tăng minor |

**Người duyệt.** Checklist trong màn duyệt:

- Hợp với trẻ em: không bạo lực, máu me hay hình đáng sợ quá mức; không chữ, logo hay thương hiệu; không giống người
  thật.
- Không na ná một IP đã biết (nhân vật, game nổi tiếng).
- Hợp style: so trên cùng một màn với ảnh mẫu của style.
- Đọc rõ ở kích thước thật: preview 1× và 2× trên nền sáng và tối.
- Nguồn gốc hợp lý: link tới trang pack CC0, hay prompt của asset AI.

**Luật duyệt:**

- Duyệt theo **cả version của pack**, không duyệt lẻ từng file.
- Từ chối thì phải ghi lý do. Agent sửa rồi gửi lại thành một bản nháp mới.
- Bản nháp tự xoá sau 30 ngày không ai duyệt. Vùng nháp có hạn mức dung lượng.

**Đường rút khẩn cấp:** chỉ owner làm được, có 2FA và có lý do (ví dụ một yêu cầu gỡ vì bản quyền).

- Version bị đánh dấu `withdrawn` và file bị xoá khỏi bucket.
- Game đang khoá version đó sẽ build fail và báo rõ lý do; phải ra version game mới.
- Đây là **ngoại lệ có ghi nhật ký** của rào "không bao giờ xoá" (D-02).

### C — Máy kiểm chỉ chạy trong CLI phía agent

Nhanh, nhưng agent có thể bỏ qua. Cổng phải nằm phía server.

## Recommendation

**B.** Máy giữ những luật đo được; người giữ những luật cần mắt nhìn. Đường rút khẩn cấp là cái giá phải trả khi đã cho
phát hành công khai.

Chi phí chấp nhận:

- Kiểm ảnh phía server viết bằng .NET (SkiaSharp, MIT).
- Một bộ file mẫu tốt và xấu dùng chung để test.
- Thêm trạng thái `withdrawn` ngoài `draft`, `approved`, `deprecated` (D-05).

## Decision

**B**, owner (2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn").
