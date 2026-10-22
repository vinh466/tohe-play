# D-04 — Mở lại app: người quay lại thấy gì, và máy dùng chung, cập nhật, link xử lý thế nào?

- Status: **decided** — B (owner, 2026-10-22, chat)
- Kind: decision
- Blocks: E-02 (rà màn), E-03 (luồng) · Blocked by: D-02 (khung app) · Đi cùng: [D-02](D-02-layout.md)
- Decided: owner, 2026-10-22, chat: "ok sửa rủi ro cập nhật trước đi, D-02 D-04 chọn B"


## Kết luận

- **Màn đầu của Trò chơi**: người đang chơi (+ Đổi) → bàn đang ngồi (`rooms/mine`) → lời mời (cả hồ sơ máy) → chơi tiếp →
  gần đây → mọi trò chơi. Không chuỗi ngày, không đếm ngược.
- **"Ai đang chơi?"**: máy một hồ sơ thì không hỏi; nhiều hồ sơ thì hỏi một chạm khi mở lạnh sau **30 phút**; trẻ → người
  lớn cần mã quản lý.
- **Phiên hết hạn thì nói ra**, không lặng lẽ đổi người chơi.
- **Cập nhật êm** *(proposed — rủi ro lỗi không có thật, nên chỉ còn lý do trải nghiệm)*: bản mới chờ tới lần mở lạnh;
  "Có bản mới — Tải lại" chỉ ngoài lúc chơi và ngồi bàn. Làm trong PR khung app; owner duyệt trong ADR.
- **Link khi đã cài**: `launch_handler` (Chrome/Edge); trang lối vào ghi "Đã cài app? Mở app → Nhập mã …" cho iPhone.
- **`persist()`** cho app đã cài; **đếm lần quay lại** (chỉ số tổng).
- **Để sau** (backlog): thông báo đẩy "đến lượt bạn" (PB-09), badge (PB-10).

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
- Cập nhật: service worker mới chiếm quyền ngay và xoá cache cũ, nhưng TanStack Router tự nạp lại trang một lần khi thiếu
  file màn. **Đã thử (2026-10-22, Chromium): không có màn lỗi**; tệ nhất là một lần tự nạp lại không báo lúc chuyển màn.
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
4. **Cập nhật êm** (không còn là sửa lỗi — xem *Discussion* 2026-10-22; làm trong PR 2 của D-02):
   - Service worker mới **chờ** và áp dụng ở lần mở lạnh sau, thay vì tự nạp lại trang lúc chuyển màn.
   - Phiên dài thì hiện "Có bản mới — Tải lại" ở các mục của khung, **không bao giờ** khi đang chơi hay đang ngồi bàn.
   - Giữ test hai bản build (`apps/hub/e2e/updates.ts`, builder viết 2026-10-22) làm hàng rào chống hồi quy; nâng nó lên
     "0 lần tự nạp lại" khi làm mục này.
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
| trong PR 2 của D-02 | Cập nhật êm (mục 4), cùng test hai bản build |
| trong PR 2 của D-02 | Màn đầu "đang dở", "Ai đang chơi?", lời mời cho hồ sơ máy, phiên hết hạn |
| nhỏ | `launch_handler`, dòng "Đã cài app?" trên trang lối vào, `persist()`, đếm lần quay lại |

Lời mời cho hồ sơ máy có thể cần API cho hồ sơ máy gọi `rooms/invites`. Cần kiểm trong PR.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Chọn A hay B? | B |
| Q2 | ~~Sửa rủi ro cập nhật ngay?~~ | Owner nói có (2026-10-22), nhưng thử lại thì rủi ro không có thật — mục 4 về lại *proposed*, làm trong PR 2 của D-02 |
| Q3 | "Ai đang chơi?" hỏi sau bao lâu không dùng? | 30 phút |
| Q4 | Thông báo đẩy "đến lượt bạn" cho bàn chơi: để sau launch? | Để sau |

## Decision

**B** — owner, 2026-10-22, chat: "ok sửa rủi ro cập nhật trước đi, D-02 D-04 chọn B". Q2 = có: sửa rủi ro cập nhật trước, PR riêng, tái hiện trước khi sửa. Q3 (30 phút), Q4 (thông báo đẩy để sau) chưa trả lời riêng — agent theo đề xuất, ghi trong PR để owner duyệt.

## Discussion

**agent** (2026-10-22): owner hỏi đã khảo sát nhu cầu quay lại chưa — chưa, ở lần đề xuất D-02. Lần này kiểm code (R-03)
và tiền lệ. Phát hiện quan trọng nhất là rủi ro khi cập nhật, không phải chuyện bố cục.

**agent** (2026-10-22, sau): **rủi ro khi cập nhật không có thật.** Builder viết test hai bản build (Chromium) trước khi sửa:
không có màn lỗi, vì file cũ còn trong HTTP cache, và khi cache bị xoá thì `lazyRouteComponent` của TanStack Router tự nạp
lại trang một lần. Agent đã nói "khả năng cao là màn lỗi" khi chưa đọc code của thư viện — sai. Owner quyết "sửa trước"
dựa trên tiền đề đó, nên mục 4 về lại *proposed* (chỉ còn lý do trải nghiệm) và không làm PR riêng. Safari/iOS chưa thử.
