# D-17 — Tên hồ sơ đặt thoải mái, định danh bằng ID `xxxx xxxx xxxx`

- Status: **decided** (2026-10-17, chat) — phương án A với mọi chi tiết như đề xuất
- Kind: decision
- Blocks: T2 spec, D-09 (bảng hiển thị gì), E-01, E-07 · Blocked by: D-01
- Decided: owner, 2026-10-17, chat — xem *Decision*

## Vì sao cần chốt

D-01 (agent) đề xuất hai tên: `@handle` duy nhất với luật chặt + tên hiển thị tự do. Owner muốn tên "đặt thoải mái tý
cho vui", và thêm "định danh cho profile bởi id xxxx xxxx xxxx … để mời đích danh profile". Khi đã có ID duy nhất,
@handle không còn việc gì để làm.

## Phương án

### A — Tên tự do (không duy nhất) + ID 12 số (duy nhất) — agent đề xuất, bỏ hẳn @handle

Mỗi hồ sơ có đúng hai thứ người khác thấy: **tên** (đặt thoải mái) và **ID** (hệ thống cấp). Giống friend code của
Nintendo Switch — đúng định dạng 12 số owner nghĩ ra ([R-04](../research/R-04-profiles-handles.md)).

- Được: không ai bị "tên đã có người dùng"; không phải xử lý chuẩn hoá Unicode, hoa thường, ký tự trông giống nhau
  cho một tên duy nhất; ít trường hơn @handle + tên hiển thị.
- Mất: tìm người bằng tên không chính xác (nhiều "Bé Na") — nên v1 chỉ tìm bằng ID.

### B — Tên duy nhất nhưng thoải mái (có dấu, hoa thường, khoảng trắng) + ID

Hai định danh duy nhất. Tên duy nhất có dấu kéo theo việc gộp các cách viết giống nhau ("Bé Na" và "be na" là một?),
chặn ký tự trông giống nhau giữa các bảng chữ, và tên đẹp bị chiếm sớm. Chi phí cao mà không thêm gì ID chưa làm được.

### C — Giữ @handle chặt như D-01 bản đầu
Trái với "đặt thoải mái cho vui".

## Đề xuất của agent: A

**ID hồ sơ**
- 12 chữ số, hiển thị `1234 5678 9012`; ô nhập chấp nhận khoảng trắng hoặc gạch ngang.
- 11 số đầu **ngẫu nhiên** (không tăng dần — không lộ số lượng người dùng, khó dò lần lượt); chữ số đầu khác 0 (để
  bảng tính và ô số không nuốt mất số 0); **chữ số cuối là Damm** — ô nhập báo "ID không đúng" ngay khi gõ nhầm một số
  hay đảo hai số liền nhau, trước khi gọi server.
- Cấp khi tạo hồ sơ, **không bao giờ đổi**, duy nhất toàn hệ thống. Không phải bí mật: là địa chỉ, không phải mật khẩu.
- Có nút sao chép, link `https://<hub>/p/<id>` và mã QR (hub đã có QR cho link mời vào phòng).

**Tên hồ sơ — thoải mái, có rào an toàn**
- 1–24 ký tự (tính theo ký tự người nhìn thấy, không theo byte); chữ có dấu, mọi bảng chữ, số, khoảng trắng, emoji, vài
  dấu câu thường gặp.
- Chặn ký tự điều khiển và ký tự định dạng (đảo chiều chữ, ký tự vô hình), chặn xếp chồng quá nhiều dấu lên một chữ;
  chuẩn hoá NFC; gộp khoảng trắng thừa.
- Không được trùng (bỏ dấu, không phân biệt hoa thường) với tên dành riêng: "Admin", "Tò He", "Hệ thống", "Quản
  trị", "Moderator"…; qua bộ lọc từ thô tục tiếng Việt + tiếng Anh.
- Đổi thoải mái nhưng có giới hạn (ví dụ 5 lần mỗi ngày); admin xem được lịch sử tên để kiểm duyệt (E-07).
- Game hiện tên phải cắt bớt bằng dấu "…" khi quá dài — nên để kit (`@tohe/game-kit`) lo một chỗ cho mọi game.

**Hồ sơ mặc định** (owner: "1 account tạo ra là có 1 profile mặc định rồi á")
- Tạo cùng lúc với account, trong cùng một giao dịch. Bước "Hoàn tất đăng ký" gợi ý sẵn một **tên vui ngẫu nhiên**
  (ví dụ "Mèo Vui", "Cá Heo Nhanh") — không lấy từ email hay tên thật của Google, vì tên hồ sơ là công khai.
- Account luôn có ít nhất một hồ sơ: không xoá được hồ sơ cuối cùng.

**Mời đích danh bằng ID**
- Trong phòng: "Mời bằng ID" → nhập 12 số → server tìm hồ sơ → kiểm tra cài đặt của người được mời → gửi lời mời (cơ
  chế lời mời 10 phút đang có của rooms, mở rộng ra ngoài account).
- Cài đặt mới của từng hồ sơ — **ai được mời tôi:** mọi người · người từng chơi cùng · chỉ trong account. Mẫu "Hồ sơ
  trẻ em" là *chỉ trong account*.
- **Tra một ID của hồ sơ trẻ em từ ngoài account thì trả "không tìm thấy"** — không lộ là có một đứa trẻ ở đó.
- Rate limit: mỗi người gửi tối đa khoảng 20 lời mời mỗi giờ; mỗi người nhận tối đa 10 lời mời đang chờ.

Hệ quả cho chỗ khác: D-01 bỏ @handle; bảng xếp hạng và phòng hiện tên + avatar, thẻ hồ sơ hiện ID (D-09); admin tìm
người theo email hoặc ID (D-07); E-01 cấp ID cho hồ sơ cũ thay vì sinh handle.

## Câu hỏi cho owner (đã trả lời 2026-10-17)

- **Q1** Bỏ @handle, tên **không cần duy nhất**, ID là định danh duy nhất — *đồng ý*.
- **Q2** Tên cho phép emoji — *có*, như đề xuất.
- **Q3** Tên vui ngẫu nhiên cho hồ sơ mặc định — *có*.
- **Q4** Ba mức "ai được mời tôi" — *đủ*.

## Decision

**owner** (2026-10-17, chat): "ok ngu de xuat cua ban on nba" (ok, những đề xuất của bạn ổn nha) — chấp nhận phương án
A và mọi chi tiết đề xuất ở trên.

## Discussion

**owner** (2026-10-17, chat): "1.1 tôi đồng ý username cho đặt thoải mái tý cho vui haha, mà ta thêm định danh cho
profile thêm bởi id xxxx xxxx xxxx được k, để mời đích dang profile luôn chẳng hạn (1 account tạo ra là có 1 profile
mặc định r á)".

**agent** (2026-10-17): ID làm được việc của @handle tốt hơn (không bao giờ đổi, không ai bị chiếm tên), nên tên thoát
khỏi mọi luật duy nhất — đúng "thoải mái cho vui". Thêm chữ số Damm vì mời đích danh nghĩa là gõ 12 số bằng tay.
