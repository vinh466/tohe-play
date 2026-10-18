# E-07 — Quyền riêng tư, xoá account và hồ sơ, kiểm duyệt tên

- Status: **decided** (2026-10-18, chat) — theo đề xuất: Q1 chờ 7 ngày, Q2 xoá hẳn, Q3 nhật ký admin giữ một năm, Q4 có
  bộ lọc (owner duyệt danh sách), Q5 5 lần mỗi ngày, Q6 báo cáo vi phạm để sau; **Q7 (pháp lý) vẫn là việc của owner**
- Kind: enhancement — xoá dữ liệu xuyên module, một ngoại lệ có kiểm soát cho các bảng chỉ ghi thêm (ADR khi xây)
- Blocks: E-10 (checklist ra mắt) · Blocked by: D-01, D-06, D-17
- Decided: 2026-10-18 — F1a (xoá), F1b (kiểm duyệt tên)

## Vì sao

Mở cho người lạ thì ba việc phải có câu trả lời: người dùng xoá được dữ liệu của mình (và bố mẹ xoá được hồ sơ của con —
R-07: rút lại sự đồng ý thì phải ngừng xử lý), tên hồ sơ — tự do và công khai — không thành chỗ chửi bới, và văn bản
điều khoản, quyền riêng tư nói đúng điều Tò He làm.

## Hiện trạng

Sự thật (2026-10-18):
- **Xoá hồ sơ** (`DELETE /api/profiles/{id}`, sau cổng phụ huynh): chỉ xoá dòng `identity.profiles` (lịch sử tên đi
  theo). Ván đã lưu, điểm, kết quả trong `integrity`, ghế và kết quả trong `rooms`, run xếp hạng **vẫn còn** — không ai
  thấy nữa (bảng nối tên qua Identity), nhưng chưa bị xoá.
- **Xoá account**: chưa có. Bản nháp chính sách (`apps/hub/src/legal/documents.ts`) ghi "Muốn xoá cả tài khoản, hãy liên
  hệ người vận hành cho tới khi Tò He có nút xoá". Design §3.14 đã vẽ luồng: chờ 7 ngày, đăng nhập để huỷ, rồi xoá hẳn;
  E-02 đã có sẵn mẫu thư "account sắp bị xoá / đã huỷ xoá".
- **Bảng chỉ ghi thêm**: `integrity.decisions` và `admin.audit_log` có trigger từ chối `UPDATE`/`DELETE` (ADR 0029,
  0027) — xoá kết quả của một người phải qua một đường ngoại lệ có kiểm soát. Nhật ký admin còn chứa email trong cột
  đối tượng (ví dụ `user.suspend`).
- **Đã có thời hạn giữ**: mã xác nhận xoá sau một ngày; thư đã gửi giữ người nhận, loại thư, thời gian 30 ngày;
  telemetry chi tiết 30 ngày, cộng theo ngày một năm — khớp với bản nháp chính sách.
- **Kiểm duyệt tên**: đã có tên dành riêng (C1), admin đổi tên và lưu lịch sử tên (D3a), ẩn hồ sơ khỏi bảng công khai
  và khoá account (E3a, D3a). **Chưa có**: bộ lọc từ thô tục, giới hạn đổi tên (D-17 gợi ý khoảng 5 lần mỗi ngày), nút
  báo cáo vi phạm (D-09: làm sau).
- **Pháp lý** (R-07, thông tin chứ không phải tư vấn): Nghị định 13/2023 Điều 20 và Luật 91/2025 — xử lý dữ liệu của
  trẻ cần người đại diện đồng ý; rút lại đồng ý thì ngừng xử lý, xoá. Thời hạn xoá cụ thể theo văn bản gốc **chưa được
  kiểm**.

## Phương án và đề xuất

### Xoá account

| | Cách | Giá |
|---|---|---|
| **A** | **Chờ 7 ngày** như design §3.14: bấm xoá (xác thực lại mức 2) → account ngừng hoạt động ngay (phiên kết thúc, hồ sơ rời bảng và phòng), thư "sẽ bị xoá ngày X — đăng nhập để huỷ"; hết 7 ngày thì xoá hẳn. | Một job nền, hai mẫu thư (đã có ở E-02). Nhầm tay vẫn lấy lại được. |
| **B** | Xoá ngay. | Đơn giản hơn; bấm nhầm là mất hết. |
| **C** | Chờ 30 ngày. | An toàn hơn cho người bấm nhầm; giữ dữ liệu lâu hơn sau khi người ta đã muốn xoá. |

**Đề xuất: A.** Thời hạn có thể cần chỉnh theo văn bản luật (Q7).

### Xoá hồ sơ

**Đề xuất:** xoá hồ sơ thì xoá luôn dữ liệu của hồ sơ đó ở mọi module, ngay lập tức — vì người bấm là chủ account đã qua
cổng phụ huynh, và với hồ sơ trẻ em đây chính là "rút lại sự đồng ý" (R-07). Xoá account làm đúng việc đó cho từng hồ sơ,
rồi xoá account.

### Xoá gì, giữ gì

| Dữ liệu | Đề xuất |
|---|---|
| Account, liên kết đăng nhập, hồ sơ, lịch sử tên | Xoá |
| Ván đã lưu, điểm, run xếp hạng (nước đi) | Xoá |
| Kết quả trên bảng (`integrity`) và nhật ký quyết định của chúng | Xoá, qua một đường ngoại lệ duy nhất cho trigger chỉ ghi thêm: chỉ job xoá dùng được, và chỉ cho kết quả của hồ sơ đã xoá — nhật ký vẫn không ai sửa được |
| Ghế và kết quả ở phòng (`rooms`) | Ván vẫn còn cho người cùng bàn xem lại, ghế hiện "Người chơi đã xoá" |
| ID hồ sơ | Không bao giờ cấp lại cho ai |
| Nhật ký admin | Giữ (hồ sơ an ninh), có thời hạn rồi xoá — Q3 |
| Thư đã gửi, telemetry | Như hiện nay (30 ngày; telemetry không gắn account) |

Phương án khác cho kết quả trên bảng: giữ lại với id không còn trỏ tới ai. Rẻ hơn, nhưng "xoá" khi đó không hẳn là xoá.

### Kiểm duyệt tên

| | Cách | Giá |
|---|---|---|
| **Bộ lọc** | Danh sách ngắn từ thô tục tiếng Việt và tiếng Anh, so **cả từ** sau khi bỏ dấu, hoa thường, ký tự xen giữa và kiểu viết lách (`0` thay `o`…); tên dính thì báo `name_inappropriate`. Owner duyệt danh sách. | Có thể chặn nhầm một tên vô hại; người tránh được bằng cách viết khác — admin vẫn đổi tên được. |
| **Giới hạn đổi tên** | 5 lần mỗi ngày mỗi hồ sơ, đếm từ lịch sử tên. | Chặn kiểu đổi tên chửi bới rồi đổi lại; người bình thường không chạm tới. |
| **Báo cáo vi phạm** | Nút "Báo cáo" trên thẻ hồ sơ (bảng công khai, ghế trong phòng) → hàng chờ trong console như E3a. | Việc lớn hơn; D-09 đã để sau. |

**Đề xuất:** bộ lọc và giới hạn đổi tên trước khi ra mắt; báo cáo vi phạm sau, như D-09.

### Tải dữ liệu của tôi

Xuất dữ liệu của account (hồ sơ, ván đã lưu, điểm, kết quả) thành một tệp JSON. **Đề xuất:** sau ra mắt, trừ khi văn bản
luật đòi phải có ngay (Q7).

### Văn bản

Khi có nút xoá, bản nháp chính sách đổi câu "liên hệ người vận hành" thành mô tả đúng luồng xoá và thời hạn (đổi
`TERMS_VERSION`). Owner vẫn duyệt toàn bộ văn bản (đang chờ ở #49 và #50).

## Câu hỏi cho owner

- **Q1** — Xoá account: chờ 7 ngày (đề xuất), xoá ngay, hay chờ 30 ngày?
- **Q2** — Kết quả trên bảng của người đã xoá: xoá hẳn (đề xuất) hay giữ với id không còn trỏ tới ai?
- **Q3** — Nhật ký admin giữ bao lâu: một năm rồi xoá, hay giữ mãi?
- **Q4** — Bộ lọc từ thô tục: làm (owner duyệt danh sách) hay không?
- **Q5** — Giới hạn đổi tên 5 lần mỗi ngày: đồng ý?
- **Q6** — Nút báo cáo vi phạm để sau ra mắt (như D-09): đồng ý?
- **Q7** — Pháp lý: thời hạn xoá, quyền xuất dữ liệu và nghĩa vụ với dữ liệu trẻ em theo văn bản gốc của Nghị định
  13/2023 và Luật 91/2025 — owner hoặc luật sư kiểm (R-07 còn giả định chưa kiểm).

## Quyết định

**owner** (2026-10-18, chat): "ok như bạn đề xuất, làm đi, và deploy uat tuần tự + kiểm tra, sau khi hoàn thành thì báo tôi verify" — nhận các đề xuất ở trên: Q1 **A** (chờ 7 ngày), Q2 xoá hẳn kết quả qua một ngoại lệ duy nhất cho các bảng chỉ
ghi thêm, Q3 nhật ký admin giữ **một năm** rồi xoá, Q4 có bộ lọc (danh sách để owner duyệt trong PR), Q5 5 lần đổi tên
mỗi ngày, Q6 báo cáo vi phạm sau ra mắt. Q7 không quyết được bằng câu này: thời hạn và nghĩa vụ theo văn bản gốc vẫn chờ
owner (hoặc luật sư) kiểm.

## Thảo luận

—
