# Brief — Bề mặt sản phẩm: từ người lạ tới người chơi

Status: **confirmed** — owner, chat: "tôi thấy cũng ổn r á" (2026-10-19), "ok r đó, chốt nha" (2026-10-20). Trích dẫn là
lời owner trong chat ngày 2026-10-19 (giữ nguyên văn, chỉ cắt bớt).

## Vì sao

Production chạy trên `toheplay.io.vn` từ 2026-10-19, nhưng vẫn là giai đoạn thử của owner:

> "lên prod này đơn giản là tôi muốn kiểm chứng sự hoạt động so với việc chỉ chạy uat local với chạy bằng domain thực tế
> luôn, nên dù nói là prod nhưng nó vẫn đang trong trạng thái kiểm thử bởi tôi th nên k có gì phải gấp gáp hay lo về dữ
> liệu người dùng nhé, tôi có thể sẽ cho enhance mạnh để nó sẳn sàng và hợp lý hơn"

> "đã ý nghĩa là ta đã có được 1 luồng triển khai từ đầu đến giao cho user r … tôi sẽ review và thay đổi mạnh để cho phù
> hợp sản phẩm public hơn"

Bảy hướng owner đặt:

1. **Rà việc dang dở** — "review lại tất cả cho tôi các công việc giang dỡ để đánh giá mức độ cần thiết tồn động".
2. **Nền trước** — "align chốt lại luồng phát triển, kiểm thử, môi trường 1 cách rõ ràng và phù hợp, k cần cầu kỳ, bám
   sát luồng ta đang làm tốt là đc … hãy đề xuất cái này trước để làm nền tảng".
3. **Subdomain** — "đề xuất thay đổi subdomain cho các thành phần để ổn định mở rộng cho tương lai, vì thay đổi bây giờ là
   siêu rẻ"; "chúng ta plan có domain riêng sau này"; "các trang landing docs portal api cũng nghiêm túc tổ chức tốt".
4. **SEO/GEO + thu hút** — "SEO GEO cho trang giới thiệu, hay mong muốn có 1 luồng thu hút user có thể dễ nhất giới thiệu
   hướng dẫn user dùng đc ToHe".
5. **Người mới + PWA** — "UIUX cho 1 người mới là thứ cần được quan tâm ngay (nhìu hướng tiếp cận từ web, mobile andoind
   ios,..., tiếp cận PWA dể, ... luồng khi PWA)".
6. **Phase sau** — "Phase sau sẽ đi sâu về hub và luồng game sau, khi đây là phân phía sau sau phần bề phóng".
7. **Mục tiêu Phase 1** — "phase 1 chúng ta muốn cải thiện bề mặt sản phẩm hoàn chỉnh, phù hợp".
8. **Vòng đời một người dùng, định danh theo game, lời mời** (2026-10-19, lượt hai) — "tất cả trước tiên đều là user,
   chúng ta tập trung vòng đời 1 user th nhé"; "case 1 game có thể cần user phải auth bằng account r, case 2 game cần user
   đặt username và có profile tạm th cũng được … user có thể login và liên kết nếu cần"; "link có thể giúp user và đúng
   lobby cần đó … link share sẽ giúp user tiếp cận game"; "hub phải đảm bảo luồng auth user hay profile sẳn sàng trước, các
   game cũng phải quan tâm luồng user khi vào game và đến nơi game muốn"; "brainstome ra 1 giải pháp hoàn chỉnh làm nền tảng
   … có tính kế thừa mở rộng hơn, ổn định level hệ thống và rõ ràng … cần spec rõ (mermain nữa nha)"; "phần auth sẽ phải
   thêm oauth để user vào nhanh chơi".

## Ràng buộc đang có hiệu lực

- **UAT giữ dữ liệu thật của gia đình**: chỉ `deploy/uat/deploy.sh`, migration chỉ tiến, không wipe (ADR 0010, `uat.md`).
- **Prod**: chỉ owner dùng; thay đổi đi qua PR ở `platform-infra` do owner merge (ADR 0021). Dữ liệu prod chưa quý, nhưng
  cùng chuỗi migration với UAT nên lịch sử migration vẫn không viết lại được (E-01 §5).
- **Một domain cho cả Tò He**, game ở `games.` (ADR 0040); một API instance (ADR 0016).
- **Lời hứa của vision**: không quảng cáo, không theo dõi, không mua trong app — đổi thì cần ADR (D-04).
- **Quy tắc repo**: spec trước, ADR cho quyết định đắt; đổi Game Contract = ADR + docs + conformance; không làm yếu check.
- Agent không bịa yêu cầu kinh doanh: đối tượng, chế độ đăng ký, domain lâu dài là quyết định của owner (D-02, D-03, D-05).
- **Đã chốt** (2026-10-19): `toheplay.io.vn` là domain duy nhất, chia subdomain theo vai (D-02); không chia đối tượng —
  mọi người là một user, theo vòng đời (D-03); `main` là nhánh chính, prod chỉ chạy commit đã lên UAT, tag `prod-…`,
  migration tạo ra là chốt (E-01).

## Xong khi

1. Luồng phát triển · kiểm thử · môi trường nằm trong spec ở một trang + một ADR; luật production có trong `AGENTS.md`;
   script kiểm UAT/prod nằm trong repo.
2. Spec (`vision`, `index`, roadmap, `uat.md`) nói đúng hướng public.
3. Mỗi thành phần có chỗ đã chốt trên domain (D-01); origin của hub và `id` của manifest chốt trước khi có người cài app.
4. Một người chưa biết Tò He, tới từ Google hoặc một link trong Zalo, hiểu nó là gì trong vài giây, **chơi được một game
   không cần tài khoản**, được dẫn cài app đúng cách cho máy mình (Android, iPhone, WebView của app chat) và tạo account
   đúng lúc — owner đã thử trên thiết bị thật.
5. Trang công khai là HTML tĩnh đọc được không cần JS, có trang cho từng game, qua kiểm SEO trong build, đã khai báo với
   Google Search Console và Bing.
6. Mỗi game khai báo bậc định danh nó cần; người được rủ vào bàn hay mở link chia sẻ **chơi được không cần account**; hồ
   sơ trên máy liên kết vào account (Google một chạm) **giữ nguyên tiến độ**; mọi lối vào đi qua một đường ống ở hub và game
   tới đúng chỗ — có spec và sơ đồ mermaid.
7. Danh sách Cổng (E-05) rõ ràng — mời người ngoài là quyết định riêng của owner.

## Không thuộc plan này

- **Phase 2 — hub**: quản lý account/hồ sơ, sảnh phòng, bảng xếp hạng, cài đặt.
- **Phase 3 — luồng game**: shell, menu, game mới (Lấp Ô…).
- App trên store (TWA cho Play Store — chỉ chừa `/.well-known/`), app native.
- Quảng cáo trả tiền, chiến dịch marketing; trang công khai tiếng Anh.
- Mời cộng đồng đầu tiên (Cổng E-05 chỉ liệt kê điều kiện).
