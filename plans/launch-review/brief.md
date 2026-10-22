# Brief — Review trước launch: nền tảng hoàn chỉnh trước khi mở cho mọi người

Status: **draft** — owner đã trả lời Q1, Q4, Q5 (2026-10-22); còn Q2, Q3 và lời xác nhận; plan rời *Frame* khi owner
xác nhận. Trích dẫn là lời owner trong chat (giữ nguyên văn, chỉ cắt bớt; "…" ở câu 2026-10-20 là chỗ bản ghi đã cắt từ
trước). Phần *(agent đề xuất)* là của agent, owner sửa hay bỏ.

## Vì sao

Phase 1 ([`product-surface`](../product-surface/PLAN.md)) xong ngày 2026-10-21: mọi PR đã chạy trên prod
`prod-2026-10-21.2`, owner thử thiết bị thật ("K2 ok r nha"). Owner đặt bước sau Phase 1 từ trước:

> "làm nốt những cái bạn đề xuất cho xong đi, sau đó tôi để đến phase review … làm 1 nền tảng hoàn chỉnh về các mặt
> trước khi launch chính thức" (2026-10-20)

Trong lúc làm Phase 1, owner dời hai việc sang phase này:

> "câu chữ bạn cứ brainstome đề xuất và áp dụng đi tôi sẽ có 1 phase review all sau này nên cứ yolo" (2026-10-21)

> "Điều khoản và Quyền riêng tư tôi có đọc chi tiết r, cứ tập trung impl tính năng đi, ta sẽ có 1 phase review và sync
> nó, cái này chốt trước khi mở hẳn, yên tâm" (2026-10-21)

Khi trả lời câu hỏi của brief:

> "chua chot ngay launch, khi nao on thi launch ne  thoai mai nhe. review lai toan bo cai dang co, xem xet o cac goc
> do, san tien ket hop check ve i18n mong muon cua toi la duy tri tieng anh va tieng viet th (game sau nay muon them van
> dc) trang gioi thieu cung 2 ngon ngu nha (nho toi uu ve SEO) trang console thi chot la chi dung english nha (console se
> do admin co chuyen mon r nen english toan bo) dieu khoan va quyen cung 2 ngin ngu luon, ngoai ra rrview xem viec cac
> trang dang bo cuc hop ly chua (toi chua hinh dung dc trang gioi thieu vao tu dau)" (2026-10-22, gõ không dấu)

Sáu hướng, từ những lời trên:

1. **Rà toàn diện "về các mặt"** — agent ghi lại hôm 2026-10-20 là UI/UX, luồng, tính năng còn thiếu.
2. **Câu chữ "review all"** — gồm câu chữ agent tự chọn ở Phase 1 (I4 liệt kê trong
   [#104](https://github.com/vinh466/tohe-play/pull/104)).
3. **Điều khoản + Quyền riêng tư** — sync với những gì Tò He làm hôm nay, "chốt trước khi mở hẳn".
4. **Cổng trước khi mời người ngoài** — danh sách từ Phase 1, nay là [E-01](items/E-01-gate-before-outsiders.md).
5. **Hai ngôn ngữ, vi và en** — hub, game, trang giới thiệu (tối ưu SEO), Điều khoản + Quyền riêng tư; **console chỉ tiếng
   Anh**. Game sau này thêm ngôn ngữ khác vẫn được.
6. **Bố cục các trang** — hợp lý chưa, và người ta vào trang giới thiệu từ đâu ([R-01](research/R-01-pages-and-ways-in.md)).

### Thứ tự ưu tiên (owner, 2026-10-23)

> rất nhìu thứ hay cần làm, nhưng nó trải trên nhìu scope, hay tạo các backlog đến hợp hơp và tracking tốt để có thể pick ra làm từ từ phù hợp sau đó quay lại nhiệm vụ ưu tiên là chốt và nâng cấp bố cục sản phảm và các bề mặt tốt cho UX user, và bề mặt giới thiệu sản phẩm, SEO GEO, và scale bề mặt này tương lai nè, tôi muốn chốt được thiết kế này xong là có thể build tiếp chi tiết tiếp theo và sau đó có thể tập trung phát triển thêm đc game sau đó nè

- **Đợt 1 — bây giờ: thiết kế bề mặt.** Bố cục sản phẩm và UX của người chơi (hướng 6, D-02, D-04), bề mặt giới thiệu,
  SEO, GEO và cách nó mở rộng (D-06), hai ngôn ngữ (hướng 5, D-01), host và path (D-05). Xong khi thiết kế thành spec, để
  build chi tiết.
- **Đợt 2 — sau thiết kế, trước launch**: hướng 1–4 (rà màn, luồng, câu chữ, Điều khoản, Cổng).
- **Rồi**: tập trung làm thêm game.
- Ý hay ngoài scope (tính năng của D-03, console tiếng Anh, thông báo đẩy…) vào **backlog sản phẩm**
  (`docs/roadmap/product-backlog.md`), chọn ra làm dần.

## Ràng buộc đang có hiệu lực

- **UAT giữ dữ liệu thật của gia đình**: chỉ `deploy/uat/deploy.sh <tag uat->`, migration chỉ tiến, không wipe (ADR 0010,
  `docs/guides/uat.md`).
- **Prod đã có người dùng thật**: đăng ký đang mở, đăng nhập Google, có người ngoài owner đăng nhập từ 2026-10-20
  (`product-surface` log). Agent chỉ đọc prod từ ngoài; chỉ lên prod khi owner nói "lên prod" (ADR 0041); migration
  không viết lại.
- **Lời hứa của vision**: không quảng cáo, không theo dõi, không mua trong app — đổi thì cần ADR.
- **Quy tắc repo**: spec trước, ADR cho quyết định đắt; đổi Game Contract = ADR + docs + conformance; không làm yếu check;
  màu từ design token, mọi màn chạy được ở sáng và tối.
- **Chi phí agent**: master Opus 5.5 · xhigh; mọi worker Opus 5.5, effort tối đa high (owner 2026-10-21).
- **Agent không bịa yêu cầu**: "tính năng còn thiếu" là danh sách của owner — agent chỉ đề xuất ứng viên. Điều khoản +
  Quyền riêng tư: agent soạn, owner duyệt; agent không tư vấn pháp lý.

## Xong khi *(agent đề xuất)*

**Đợt 1 — thiết kế bề mặt** (8, 7, 9 trước; spec viết xong là đợt 1 xong):

9. Bề mặt giới thiệu có thiết kế cho SEO, GEO và cho lúc có hàng chục game: loại trang, URL hai ngôn ngữ, dữ liệu có cấu
   trúc, chính sách với crawler, cách thêm một game là có đủ trang (D-06).

**Đợt 2 — trước launch**: 1–4, 6. Mục 5 chuyển sang backlog sản phẩm (owner 2026-10-23).

1. Mỗi màn của hub, console, trang công khai và mỗi game đã được rà trên điện thoại và máy tính, sáng và tối; mỗi lỗi
   tìm được đã sửa, hoặc owner hoãn và có ghi lại.
2. Các luồng đầu–cuối đi được, không ngõ cụt: người mới → chơi → cài app → account; link mời, mã bàn, link "Thách bạn";
   chuyển máy; hồ sơ của trẻ em. Có e2e cho từng luồng, và owner đã thử.
3. Câu chữ toàn sản phẩm đã soát một lượt; owner duyệt giọng văn.
4. Điều khoản + Quyền riêng tư nói đúng những gì Tò He lưu và làm hôm nay (hồ sơ máy trên server, mã chuyển máy, link
   chia sẻ và payload của game, đăng nhập Google, câu tuổi/đồng ý); owner duyệt; `TERMS_VERSION` mới.
5. Danh sách "tính năng còn thiếu trước launch" do owner chốt — mỗi mục xong, hoặc hoãn có lý do.
6. Cổng ([E-01](items/E-01-gate-before-outsiders.md)) xong từng dòng — để owner quyết ngày launch chính thức.
7. Người chơi dùng được Tò He bằng vi hoặc en ở mọi chỗ của người chơi — hub, game có sẵn, trang công khai (mỗi ngôn ngữ
   có URL riêng, `hreflang`, sitemap, kiểm SEO trong build), Điều khoản + Quyền riêng tư; console toàn tiếng Anh.
8. Bố cục các trang và đường giữa chúng (trang giới thiệu ↔ app ↔ link mời ↔ docs) có sơ đồ trong spec; owner hình dung
   được và đã duyệt.

## Không thuộc plan này *(agent đề xuất)*

- Ngày launch, mời cộng đồng đầu tiên — quyết định riêng của owner; plan chỉ làm cho Cổng qua được.
- Quảng cáo, marketing trả tiền; app trên store, app native.
- Phase 2 (hub) và Phase 3 (luồng game) như tính năng mới — trừ những gì owner chọn ở Q2.
- Ngôn ngữ thứ ba cho hub và trang công khai (owner: "duy tri tieng anh va tieng viet th").

## Câu hỏi cho owner (trước khi chốt)

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | ~~Phạm vi so với Phase 2/3~~ | **Owner 2026-10-22:** "review lai toan bo cai dang co, xem xet o cac goc do" — rà mọi thứ đang có; tính năng mới chỉ khi owner chọn ở Q2 |
| Q2 | **Tính năng còn thiếu.** Owner đã có danh sách chưa? *(agent đưa ứng viên ở [D-03](items/D-03-features-before-launch.md), 2026-10-22)* | Nếu chưa, agent liệt kê ứng viên từ backlog (đăng nhập Zalo, telemetry crash/CSP, Lấp Ô, service worker cho origin của game…) và từ phần rà màn, owner chọn |
| Q3 | **Cách rà UI/UX.** Agent chụp từng màn rồi owner xem, hay owner tự đi và ghi lại? | Agent chụp mọi màn bằng Playwright (điện thoại + máy tính, sáng + tối, vi), gom vào `research/`, ghi lỗi thấy được; owner xem và thêm cảm nhận |
| Q4 | ~~Ngôn ngữ~~ | **Owner 2026-10-22:** vi + en cho hub, game, trang giới thiệu (SEO), Điều khoản + Quyền riêng tư; console chỉ tiếng Anh — soát câu chữ cả hai ngôn ngữ |
| Q5 | ~~Mốc thời gian~~ | **Owner 2026-10-22:** "chua chot ngay launch, khi nao on thi launch ne  thoai mai nhe" |
