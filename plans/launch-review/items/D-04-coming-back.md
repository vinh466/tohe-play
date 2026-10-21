# D-04 — Mở lại app: người quay lại thấy gì, và máy dùng chung, cập nhật, link xử lý thế nào?

- Status: **decided** — B (owner, 2026-10-22, chat)
- Kind: decision
- Blocks: E-02 (rà màn), E-03 (luồng) · Blocked by: D-02 (khung app) · Đi cùng: [D-02](D-02-layout.md)
- Decided: owner, 2026-10-22, chat: "ok sửa rủi ro cập nhật trước đi, D-02 D-04 chọn B"

## Why it matters

Owner (2026-10-22, gõ không dấu): "flow khi app intalled hay user enter lai app UX ban thay on chu, ban co khao sat va
research nhu cau nay chua". Người đã cài app là người quan tâm nhất. Lần mở thứ hai trở đi quyết định họ có ở lại không.
Phase 1 mới làm lần mở đầu tiên.

## What is true today

Chi tiết ở [R-03](../research/R-03-coming-back.md).

- Màn đầu là danh mục, không có "chơi tiếp", không có "gần đây".
- Bàn đang ngồi không hiện ở đâu; `rooms.mine()` có sẵn mà không màn nào dùng.
- Lời mời chỉ hiện cho account; hồ sơ máy không thấy.
- Máy dùng chung: lần sau vẫn là người lần trước, không hỏi ai đang chơi.
- Phiên account hết hạn thì app lặng lẽ chuyển sang hồ sơ máy.
- Cập nhật: service worker mới chiếm quyền ngay, xoá cache cũ, và app không bắt lỗi nạp lười. Khả năng cao là màn lỗi khi
  chạm vào game ngay sau một lần deploy (**chưa tái hiện**).
- Bàn chơi tự nối lại khi app hiện lại (SignalR); giữ ghế 30 giây.

## Options

### A — Chỉ sửa rủi ro cập nhật, còn lại để sau launch

- **Cái giá**: nhỏ.
- **Không sửa**: màn đầu, máy dùng chung, phiên hết hạn, bàn đang ngồi.

### B — Màn đầu "đang dở", máy dùng chung có "Ai đang chơi?", cập nhật an toàn *(đề xuất)*

Chi tiết ở dưới.

## Recommendation

**B**, làm trong khung app của D-02.

1. **Màn đầu của mục Trò chơi, theo thứ tự**:
   - **Người đang chơi** ở đầu trang, gồm avatar và tên, kèm nút "Đổi".
   - **Bàn bạn đang ngồi** (từ `rooms/mine`), nếu có: "Tiến Lên · bàn 482113 — Vào lại".
   - **Lời mời tới bạn**, cho cả hồ sơ máy đã có tên, không chỉ account.
   - **Chơi tiếp**: game mở gần nhất của hồ sơ này, một ô to. Hub tự ghi "mở gần nhất" theo hồ sơ ở máy, không cần đổi Game
     Contract. Câu "ván đang dở" thì để game tự nói ở màn tiêu đề, như hôm nay.
   - **Gần đây**, rồi **mọi trò chơi**.
   - Không có chuỗi ngày (streak), không đếm ngược, không câu gây áy náy (ICO, chuẩn 5).
2. **"Ai đang chơi?" trên máy dùng chung**:
   - Máy chỉ có một hồ sơ thì không bao giờ hỏi.
   - Máy có nhiều hồ sơ thì hỏi nhẹ, một chạm, khi mở lạnh sau **30 phút** không dùng. Còn lại giữ người lần trước.
   - Chuyển từ hồ sơ trẻ sang hồ sơ người lớn hay sang tài khoản cần **mã quản lý** (PIN đã có). Chiều ngược lại không cần.
     Cần kiểm xem hôm nay picker đã đòi PIN chưa.
3. **Phiên hết hạn thì nói ra**: "Phiên đăng nhập đã hết — đăng nhập lại để chơi tiếp bằng tài khoản", và không lặng lẽ
   chuyển sang hồ sơ máy.
4. **Cập nhật an toàn** (sửa rủi ro đang có trên prod; nên làm **sớm, PR riêng**, không chờ bố cục):
   - Bỏ việc tự `skipWaiting`. Service worker mới **chờ**, rồi áp dụng ở lần mở lạnh sau. Trên iPhone gần như lần quay lại
     nào cũng là mở lạnh.
   - Nếu phiên dài: hiện "Có bản mới — Tải lại" chỉ ở các mục của khung, **không bao giờ** khi đang chơi hay đang ngồi bàn.
   - Bắt lỗi nạp lười (`vite:preloadError`): nạp lại trang một lần, sau khi game đã lưu.
   - Thêm một e2e: mở app, đổi bản build, chạm vào game, không có màn lỗi.
5. **Link khi đã cài app**:
   - Thêm `launch_handler: { client_mode: ["focus-existing", "auto"] }`. Chỉ Chrome và Edge có, nên cần kiểm tính năng.
   - Trên iPhone, link mở Safari, và Safari không chung lưu trữ với app. Trang lối vào hiện thêm một dòng: "Đã cài app Tò He?
     Mở app → Nhập mã ABCD-EFGH". Ô Nhập mã đã có sẵn.
6. **Giữ dữ liệu**: gọi `navigator.storage.persist()` khi app chạy như app đã cài, để trình duyệt không xoá tiến độ của hồ
   sơ máy.
7. **Đo, không theo dõi**: đếm theo ngày số lần quay lại trong trình duyệt, cạnh `standaloneOpen` đã có. Chỉ tổng số, như
   D-04 của Phase 1.
8. **Không làm bây giờ**:
   - Thông báo đẩy. Nếu có sau này thì người chơi tự bật, chỉ cho việc thật như "đến lượt bạn" ở bàn, không có dịch vụ bên
     thứ ba ngoài dịch vụ push của trình duyệt.
   - Badge trên biểu tượng app.

### Cái giá

| PR | Nội dung |
|---|---|
| sớm | Cập nhật an toàn (mục 4) cùng e2e, có thể làm ngay trước mọi thứ khác |
| trong PR 2 của D-02 | Màn đầu "đang dở", "Ai đang chơi?", lời mời cho hồ sơ máy, phiên hết hạn |
| nhỏ | `launch_handler`, dòng "Đã cài app?" trên trang lối vào, `persist()`, đếm lần quay lại |

Lời mời cho hồ sơ máy có thể cần API cho hồ sơ máy gọi `rooms/invites`. Cần kiểm trong PR.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Chọn A hay B? | B |
| Q2 | Sửa rủi ro cập nhật (mục 4) ngay bây giờ, trước cả bố cục? | Có — rủi ro đang có trên prod với người dùng thật |
| Q3 | "Ai đang chơi?" hỏi sau bao lâu không dùng? | 30 phút |
| Q4 | Thông báo đẩy "đến lượt bạn" cho bàn chơi: để sau launch? | Để sau |

## Decision

**B** — owner, 2026-10-22, chat: "ok sửa rủi ro cập nhật trước đi, D-02 D-04 chọn B". Q2 = có: sửa rủi ro cập nhật trước, PR riêng, tái hiện trước khi sửa. Q3 (30 phút), Q4 (thông báo đẩy để sau) chưa trả lời riêng — agent theo đề xuất, ghi trong PR để owner duyệt.

## Discussion

**agent** (2026-10-22): owner hỏi đã khảo sát nhu cầu quay lại chưa — chưa, ở lần đề xuất D-02. Lần này kiểm code (R-03)
và tiền lệ. Phát hiện quan trọng nhất là rủi ro khi cập nhật, không phải chuyện bố cục.
