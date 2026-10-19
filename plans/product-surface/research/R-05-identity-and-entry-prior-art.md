# R-05 — Định danh theo bậc, hồ sơ tạm → tài khoản, và link mời: người khác làm thế nào

- Date: 2026-10-19 · Feeds: D-05, D-06, D-07, D-08

## Question

Owner (2026-10-19) muốn một nền tảng bao quát: game cần **account** (case 1) hoặc chỉ cần **tên + hồ sơ tạm** giữ trên
thiết bị, đăng nhập và liên kết sau (case 2, gồm cả game offline); link mời đưa người vào **đúng lobby**, link chia sẻ đưa
người vào **game**; hub lo định danh sẵn sàng trước, game lo đưa người tới đúng chỗ trong game. Người khác đã giải các
mảnh này thế nào?

## Findings

### Hồ sơ ẩn danh → tài khoản thật

- **Firebase Auth**: đăng nhập ẩn danh tạo một user thật; `linkWithCredential` gắn email/Google vào **cùng UID**, dữ liệu
  đi theo. Nếu credential đã thuộc một user khác → lỗi `credential-already-in-use`, việc gộp dữ liệu là của ứng dụng
  ([Firebase account linking](https://firebase.google.com/docs/auth/flutter/account-linking),
  [anonymous auth](https://firebase.google.com/docs/auth/flutter/anonymous-auth)).
- **Supabase**: người ẩn danh đổi thành người dùng thật bằng cách liên kết email/điện thoại (`updateUser`) hoặc OAuth
  (`linkIdentity`); email đã có người dùng → lỗi, ứng dụng đăng nhập account có sẵn, **gán lại dữ liệu** của người ẩn danh
  và tự chọn: ghi đè bằng dữ liệu cũ, bằng dữ liệu ẩn danh, hay gộp. Khuyên mạnh bật CAPTCHA/Turnstile cho đăng nhập ẩn
  danh; giới hạn 30 lần/giờ mỗi IP; **không tự dọn** người ẩn danh — phải tự xoá (vd sau 30 ngày); phân quyền phải phân
  biệt người ẩn danh ([Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)).
- Rút ra: (1) giữ **cùng một id** khi nâng cấp thì mọi lịch sử tự đi theo; (2) xung đột khi account đã có là trường hợp
  bình thường, phải thiết kế luồng gộp; (3) danh tính ẩn danh rẻ → cần chống lạm dụng và dọn dẹp.

### Chơi không cần tài khoản

- **Kahoot**: người chơi không cần account — vào bằng PIN, link hoặc QR rồi gõ (hoặc quay ngẫu nhiên) một nickname. Chỉ khi
  **host bật "player identifier"** thì mới cần account
  ([Kahoot help](https://support.kahoot.com/hc/articles/360039890713)). → đúng case 2, và "yêu cầu account" là **lựa chọn
  của bàn/host**, không chỉ của game.
- **Lichess**: chơi ẩn danh được (ván thường); **ván tính điểm (rated) cần account**
  ([Wikipedia](https://en.wikipedia.com/wiki/Lichess)). → bậc định danh theo **tính năng** trong cùng một game.

### Link mời

- **Discord**: link mời có hạn dùng (30 phút → không hết hạn), số lần dùng tối đa, và "thành viên tạm" — tự bị gỡ khi ngắt
  kết nối nếu chưa được gán vai trò ([Discord support](https://support.discord.com/hc/articles/208866998)). → link là một
  **đối tượng có vòng đời** (hết hạn, giới hạn, thu hồi), không chỉ là một URL.
- Kahoot: cùng một lối vào bằng ba cách (PIN gõ tay, link, QR). Tò He đã có mã bàn 6 số + `/r/<code>` + QR (ADR 0016).

### Đăng nhập nhanh ở Việt Nam

- **Google**: đã xây (#50, ADR 0026), tắt ở prod.
- **Zalo**: OAuth v4 (`oauth.zaloapp.com/v4/permission`, PKCE), profile từ `graph.zalo.me/v2.0/me`; có sẵn provider cho
  ASP.NET Core (`AspNet.Security.OAuth.Zalo`) ([Logto](https://logto.io/oauth-providers-explorer/zalo),
  [NuGet](https://www.nuget.org/packages/AspNet.Security.OAuth.Zalo/)). Điều kiện đăng ký app ở developers.zalo.me chưa
  kiểm. **Giả định quan trọng**: Zalo không trả email theo mặc định → va với ADR 0024 ("email định danh account").
- **Facebook**: phổ biến; cần app Meta, URL chính sách quyền riêng tư và cách xoá dữ liệu (kiến thức chung, chưa kiểm lại).
- **Apple**: chỉ bắt buộc với app iOS trên App Store có đăng nhập bên thứ ba; web không bắt buộc (kiến thức chung).

### Tò He hôm nay (code, `main` = `d685547`)

- Khách = **một** hồ sơ local mỗi thiết bị, tên "Khách", không lên server; lần đầu chọn hồ sơ thật trên thiết bị đó thì hub
  đề nghị chuyển tiến độ (`docs/architecture/identity.md#guest-mode`).
- Account sở hữu 1–5 hồ sơ, ID 12 số, đăng ký tạo sẵn một hồ sơ mặc định (ADR 0023, 0024).
- Bàn online: chỉ account ("Anyone signed in on this server / my account's profiles only" — `rooms.md`); run xếp hạng, bảng
  công khai, mời bằng ID: chỉ account (ADR 0029–0033).
- Game nhận `init.profile`, `room?`, `replay?`, `rankedReplay?` — **không có khái niệm lối vào** (deep link vào một chỗ
  trong game); game không gọi mạng nên không tự tạo link chia sẻ được (Game Contract §3).
- `rememberNext` giữ link bàn qua đăng nhập và chọn hồ sơ (`JoinPage.tsx`) — mầm của "giữ ý định qua mọi bước".

## Assumptions

- Zalo không trả email nếu không xin quyền đặc biệt — cần kiểm ở developers.zalo.me trước khi đưa vào kế hoạch.
- Các con số của Discord/Kahoot có thể đã đổi; chỉ dùng làm mẫu thiết kế.

## So what

1. **Mọi người chơi đều là một hồ sơ** — có account hay không. Thêm **hồ sơ máy** (có tên, giữ trên thiết bị, lên server khi
   cần) thay cho "khách"; nâng lên account thì **giữ nguyên id** (Firebase/Supabase) → D-06, D-07.
2. **Yêu cầu định danh có ba nguồn**: game, tính năng (ranked, bảng công khai, mời bằng ID), và **bàn/người mời**
   (Kahoot) → lấy mức cao nhất → D-06.
3. **Link là một đối tượng** có loại, đích, hạn, giới hạn, người tạo; một **đường ống lối vào** duy nhất ở hub; game nhận
   `init.entry` và tự tới đúng chỗ → D-08.
4. OAuth: **Google trước** (đã xây), Zalo/Facebook là quyết định riêng vì đụng ADR 0024 → D-05.

## Sources

- https://firebase.google.com/docs/auth/flutter/account-linking
- https://firebase.google.com/docs/auth/flutter/anonymous-auth
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://support.kahoot.com/hc/articles/360039890713
- https://en.wikipedia.com/wiki/Lichess
- https://support.discord.com/hc/articles/208866998
- https://logto.io/oauth-providers-explorer/zalo
- https://www.nuget.org/packages/AspNet.Security.OAuth.Zalo/
