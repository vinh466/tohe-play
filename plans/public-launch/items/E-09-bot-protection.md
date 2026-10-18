# E-09 — Chống bot đăng ký

- Status: **decided** (2026-10-18, chat) — Q1 **A** (ra mắt bằng mã mời), Q2 **C** (proof-of-work tự host, sau một công
  tắc trong console, tắt sẵn)
- Kind: enhancement — tuỳ phương án: không gì, một dịch vụ ngoài (ADR), hoặc một thư viện tự host (ADR)
- Blocks: E-10 (checklist ra mắt) · Blocked by: D-12
- Decided: 2026-10-18 — F3 ([#65](https://github.com/vinh466/tohe-play/pull/65), ADR 0037)

## Vì sao

Bot đăng ký hàng loạt có thể làm ba việc: tạo account rác (tên rác trên bảng công khai, lời mời rác), làm API gửi mã tới
địa chỉ của người khác (dội thư vào hộp thư của họ), và **đốt quota email** — với gói Resend Free, 100 thư mỗi ngày là
của chung cả account, gồm cả `platform` và Outline (E-02), nên một đêm bị dội có thể làm không ai đăng ký được nữa.

## Hiện trạng

Sự thật (2026-10-18):
- Chế độ đăng ký `open | invite | closed`, đổi được lúc chạy trong console (D-12, ADR 0028). Ở `invite` và `closed`,
  API kiểm mã mời **trước khi** gửi bất kỳ thư nào (`AuthEndpoints.cs`: `invites.RefusalAsync` chạy trước
  `attempts.StartAsync`) — bot không có mã thì không làm API gửi thư được.
- Giới hạn đang có: mỗi IP 10 request mỗi phút cho từng nhóm (đăng nhập hoặc xin mã, gõ mã, PIN); mỗi địa chỉ email 1 mã
  mỗi phút và 5 mã mỗi giờ (`Attempts`); account chỉ thành hình khi mã gửi về được gõ lại (C2).
- Quên mật khẩu với địa chỉ không có account chỉ tạo "attempt mồi", không gửi thư — không dò được ai có account.
- Google, GitHub, OIDC chỉ bật ở prod (D-04); bản thân họ đã chặn bot ở phía họ.
- Prod đứng sau Cloudflare (R-05).

## Phương án

| | Cách | Giá |
|---|---|---|
| **A** | **Không thêm gì; mở bằng mã mời.** Ra mắt với `invite`: bot không có mã thì không gửi được thư nào. Chỉ chuyển sang `open` khi đã có B hoặc C. | Không tốn gì. Người lạ chỉ vào được qua một cộng đồng có mã. |
| **B** | **Cloudflare Turnstile**, một công tắc trong console, tắt sẵn: widget trên trang đăng ký và quên mật khẩu, API kiểm token với Cloudflare (`siteverify`). | Dịch vụ ngoài (ADR); CSP của hub phải luôn cho `challenges.cloudflare.com` (`script-src`, `frame-src`) vì CSP nằm cố định trong Caddy, kể cả khi công tắc tắt; trang quyền riêng tư phải nhắc Cloudflare. Cloudflare vốn đã đứng trước prod. |
| **C** | **Proof-of-work tự host** (kiểu ALTCHA, MIT): máy người dùng giải một bài toán băm khoảng nửa giây trước khi xin mã; API kiểm bằng HMAC. | Không bên thứ ba, không đổi CSP; chặn được bot rẻ tiền, không chặn được kẻ có nhiều máy; tốn chút pin trên điện thoại yếu. |
| **D** | **Giới hạn ở edge**: rule rate limit của Cloudflare cho `/api/auth/*`. | Cấu hình ở Cloudflare hoặc `platform-infra`, không đụng code; gói miễn phí có ít rule. Bổ sung cho A, B hoặc C. |

## Đề xuất của agent

**A cho ngày ra mắt**, thêm **D** nếu gói Cloudflare cho phép. Trước khi chuyển đăng ký sang `open`, làm **C** sau một
công tắc trong console — hợp với cách Tò He giữ mọi thứ trong nhà (game không gọi mạng, CSP chặt). Nếu sau này C không
đủ, B vẫn thêm được sau cùng một công tắc.

## Câu hỏi cho owner

- **Q1** — Ra mắt với đăng ký `invite` (A) có được không, hay cần `open` ngay từ đầu?
- **Q2** — Khi mở `open`: C (tự host, yếu hơn) hay B (Turnstile, mạnh hơn, thêm Cloudflare vào CSP và chính sách)?
  Câu trả lời của E-02 Q2 (Resend Free hay Pro) ảnh hưởng ở đây: với Free, quota chung 100 thư/ngày làm rủi ro lớn hơn.

## Quyết định

**owner** (2026-10-18, chat): "ok như bạn đề xuất, làm đi, và deploy uat tuần tự + kiểm tra, sau khi hoàn thành thì báo tôi verify" — A cho ngày ra mắt; C xây ngay ("làm đi"), sau một công tắc trong console, tắt sẵn, để bật khi chuyển đăng ký
sang `open`. D (rule ở edge) là cấu hình Cloudflare, ngoài repo.

## Thảo luận

—
