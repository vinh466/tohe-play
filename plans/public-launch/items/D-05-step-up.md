# D-05 — Xác thực lại (step-up): khi nào, bằng gì?

- Status: **proposed**
- Kind: decision
- Blocks: T2 spec (luồng quản lý hồ sơ và cài đặt account), D-07 (thao tác nhạy cảm của admin) · Blocked by: D-01
- Decided: —

## Vì sao cần chốt

Owner muốn "1 lớp auth lại khi config profile". Hôm nay lớp đó là *parent gate*: nhập lại mật khẩu, mở khoá 10 phút
(`docs/architecture/identity.md`, bảng Rules; `POST /api/session/parent-gate`). Sau D-04, **một account có thể không
có mật khẩu** (chỉ Google/GitHub), nên "nhập lại mật khẩu" không còn đủ.

Có hai mối đe doạ khác nhau:
- **Trẻ em trên máy dùng chung** đổi cài đặt hồ sơ của mình hay của anh chị em. Cần nhanh và dễ với người lớn.
- **Kẻ có được phiên đăng nhập** (máy bị mượn, cookie bị lộ) đổi email, mật khẩu, liên kết hay xoá account. Cần
  bằng chứng mạnh.

## Phương án

### A — Một mức: luôn xác thực lại đầy đủ (mật khẩu, hoặc mã gửi email)
An toàn và đơn giản để spec, nhưng mỗi lần sửa hồ sơ của con phải mở email lấy mã — chậm trên máy gia đình.

### B — Hai mức (agent đề xuất)
- **Mức 1 — mã quản lý:** một PIN 6 số của chủ account, đặt một lần. Mở khoá việc quản lý hồ sơ trên thiết bị đó
  trong 10 phút. Sai 5 lần thì khoá 5 phút (cùng cơ chế với PIN hồ sơ hiện có).
- **Mức 2 — xác thực lại thật:** mật khẩu, *hoặc* mã gửi email (dùng được cho account chỉ có OAuth), còn hiệu lực
  10 phút. Dùng cho: đổi email, đổi/đặt mật khẩu, liên kết/gỡ liên kết, xoá account, **đặt hoặc đổi mã quản lý**,
  và thao tác nhạy cảm của admin (admin còn phải có 2FA — D-07).

Netflix làm đúng kiểu này: đặt PIN khoá hồ sơ thì phải nhập mật khẩu account, sau đó PIN là thứ dùng hằng ngày
([R-04](../research/R-04-profiles-handles.md)).

### C — Xác thực lại qua provider (Google `prompt=login` / `max_age`)
Google hỗ trợ, GitHub không có cách ép đăng nhập lại tương đương. Mỗi provider mỗi khác, và OAuth chỉ có ở prod
(D-04) nên UAT không test được. Không chọn làm cơ chế chính.

## Đề xuất của agent

**B.** Mức 1 giữ đúng trải nghiệm parent gate mà gia đình đang quen. Mức 2 không phụ thuộc mật khẩu nên chạy cho mọi
account. Chi phí: thêm một bí mật (mã quản lý) cần luồng đặt lại — đặt lại chính là một thao tác mức 2.

Quy tắc phụ:
- Phiên mở khoá mức 1 và mức 2 gắn với **phiên đăng nhập trên thiết bị đó** (claim trong cookie như parent gate
  hôm nay), không áp cho thiết bị khác.
- Mã gửi email cho mức 2 theo cùng luật với mọi mã một lần (design §3.3: 6 số, 15 phút, 5 lần thử, gắn với một
  attempt).

## Decision

—

## Discussion

**agent** (2026-10-17): tách hai mức vì hai mối đe doạ khác nhau. Gộp làm một thì hoặc quá chậm cho gia đình
(phương án A), hoặc quá yếu cho thao tác bảo mật (chỉ có PIN).
