# Brief — Mở Tò He cho mọi người (public launch)

Status: **confirmed** — owner, 2026-10-17, chat: "ok on … còn lại ôn". Các trích dẫn là lời owner trong chat ngày
2026-10-17 (giữ nguyên văn, chỉ cắt bớt).

## Vì sao

Release là **kim chỉ nam, không gấp**; mục tiêu thật là sửa nền tảng tới mức sẵn sàng public:

> "hướng tiếp theo của ta là sẽ cho việc release nhưng k gấp đó là kim chỉ nam thôi, ta dựa vào đó đề giải quyết
> các vấn đề nền tảng đễ sẳn sàng cho việc public nè nên cứ từ từ"

> "uat là stage tôi lấy ý kiến từ tôi và người thân bạn bè, prod sắp tới sẽ là public cho vài cộng đồng nhỏ của tôi"

Sáu hướng owner đã đặt:

1. **User-first.** "tôi mong muốn tohe sẽ mở được với mọi người luôn, nên xoay ý chí sản phẩm sang user first".
   Nhu cầu chính là "user - user (1 user 1 account)". Thay cho cha–con hiện nay: "1 account sẽ có thể tạo nhìu
   profile chơi, lúc này mỗi profile sẽ được chủ account tạo và config cho nó (có 1 lóp auth lại khi config
   profile), các profile sẽ cần có username unique trên system để chúng có thể tham gia trên hệ thống luôn".
   Sau đó: "username cho đặt thoải mái tý cho vui … thêm định danh cho profile thêm bởi id xxxx xxxx xxxx … để mời
   đích dang profile luôn chẳng hạn (1 account tạo ra là có 1 profile mặc định r á)".
2. **Auth lấy email làm định danh.** "dùng email để định danh 1 user … oauth như google/github/register by
   email/forgot pass … quan tâm việc link email account"; "các phương pháp auth như oauth hay thủ công thì điều bật
   tắt và config được"; luồng "đầy đủ và kín", "spec mermaid rõ về các luồng để làm tài liệu maintain";
   "các cấu hình oauth đa số sẽ đc dùng ở prod … uat hay dev local ta cứ dùng thủ công".
3. **Platform admin** "để tôi có thể quản lý nền tảng, monitor, làm những việc ở cấp app owner"; lần đầu
   "chưa có admin thì cho đăng ký lần đầu".
4. **Song song có kế hoạch:** "planing spec và phụ thuộc với nhau tốt nhé r ta quản lý hay làm việc dễ luôn".
5. **Chart riêng cho prod** trên VPS cluster của `platform-infra`: "chart có thể tự vận hành dễ dàng từ đầu và
   hưởng mở custom đc, để platform có thể tích hợp secret/db/redis/.... dễ dàng mà k break chart của ta … còn ta
   gì đảm bảo chất lượng sản phẩm của ta"; "chuẩn bị nó luôn … trên platform-infra thì tạo 1 nhánh và PR sẳn".
6. **Engine độ tin** cho bảng xếp hạng: "chúng ta nên có 1 engine xịn để giúp nó (cố hết sức th, chứ tinh thần mọi
   người cũng legit nha haha, tương lai enhance thêm từ đây)".

## Ràng buộc đang có hiệu lực

- **UAT giữ dữ liệu thật của gia đình** (`tohe-uat`, 10.100.0.2): chỉ deploy bằng `deploy/uat/deploy.sh`, không
  wipe volume, migration chạy lúc API khởi động ([uat.md](../../docs/guides/uat.md), ADR 0010).
- **Quy tắc repo:** spec trước, ADR cho quyết định đắt; đổi `packages/contract` = ADR + docs + conformance cùng PR;
  game không gọi API, không có storage riêng; không làm yếu check nào ([AGENTS.md](../../AGENTS.md)).
- **Một API instance** (phòng chơi sống trong memory — ADR 0016, `docs/architecture/rooms.md:340`).
- **Quy ước `platform-infra`:** ArgoCD ApplicationSet theo cluster, secrets từ Infisical, Postgres dùng chung (CNPG,
  backup R2), Traefik + TLS ở Cloudflare, ngân sách connection của Postgres dùng chung ([R-05](research/R-05-platform-infra.md)).
- **OAuth chỉ chạy ở prod**; UAT và dev dùng đăng ký thủ công (email + mật khẩu).
- **Chưa có người dùng public**; người dùng thật duy nhất là gia đình/bạn bè trên UAT.

## Xong khi

1. Ai cũng đăng ký được bằng email đã xác minh, hoặc Google/GitHub trên prod; liên kết các cách đăng nhập an toàn;
   quên mật khẩu tự xử lý được; mỗi cách đăng nhập bật/tắt được — luồng nào cũng có sơ đồ mermaid trong spec.
2. Một account sở hữu nhiều hồ sơ chơi (có sẵn một hồ sơ mặc định), mỗi hồ sơ có tên đặt thoải mái và một ID duy
   nhất để mời đích danh; quản lý hồ sơ cần xác thực lại; hồ sơ trẻ em được bảo vệ bằng cài đặt của hồ sơ.
3. Owner tạo được admin đầu tiên khi cài mới, và quản lý nền tảng qua admin console (người dùng, cách đăng nhập,
   chế độ đăng ký, game, sức khoẻ thiết bị, nhật ký thao tác).
4. Bảng xếp hạng công khai chỉ chứa kết quả đáng tin, do một engine độ tin dùng chung quyết định; nghi ngờ thì ẩn
   chờ admin xem, không phạt oan.
5. Tò He chạy trên cluster `platform-infra` bằng chart của chính nó (image + chart trên GHCR); chart cũng tự cài
   được từ đầu ở nơi khác; UAT chạy đúng các image sẽ lên prod.
6. Checklist public xanh (điều khoản/quyền riêng tư, xoá tài khoản, kiểm duyệt tên, chống lạm dụng), rồi một cộng
   đồng dùng thử trên prod.

## Không thuộc plan này

- Nhiều API instance, Redis, SignalR backplane (ADR 0016 chốt một instance).
- App native, thanh toán, chat, hệ thống bạn bè đầy đủ (chỉ chừa đường cho nó).
- Hồ sơ có đăng nhập riêng, chia sẻ hồ sơ giữa hai account, giới hạn thời gian chơi — ghi nhận ở D-01, làm sau.
- Game mới, và thay đổi giao diện không phục vụ mục tiêu trên.
