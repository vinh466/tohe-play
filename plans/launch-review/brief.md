# Brief — Review trước launch: nền tảng hoàn chỉnh trước khi mở cho mọi người

Status: **draft** — owner đọc, trả lời [câu hỏi](#câu-hỏi-cho-owner-trước-khi-chốt) và xác nhận; plan rời *Frame* khi owner
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

Bốn hướng, từ những lời trên:

1. **Rà toàn diện "về các mặt"** — agent ghi lại hôm 2026-10-20 là UI/UX, luồng, tính năng còn thiếu.
2. **Câu chữ "review all"** — gồm câu chữ agent tự chọn ở Phase 1 (I4 liệt kê trong
   [#104](https://github.com/vinh466/tohe-play/pull/104)).
3. **Điều khoản + Quyền riêng tư** — sync với những gì Tò He làm hôm nay, "chốt trước khi mở hẳn".
4. **Cổng trước khi mời người ngoài** — danh sách từ Phase 1, nay là [E-01](items/E-01-gate-before-outsiders.md).

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

1. Mỗi màn của hub, console, trang công khai và mỗi game đã được rà trên điện thoại và máy tính, sáng và tối; mỗi lỗi
   tìm được đã sửa, hoặc owner hoãn và có ghi lại.
2. Các luồng đầu–cuối đi được, không ngõ cụt: người mới → chơi → cài app → account; link mời, mã bàn, link "Thách bạn";
   chuyển máy; hồ sơ của trẻ em. Có e2e cho từng luồng, và owner đã thử.
3. Câu chữ toàn sản phẩm đã soát một lượt; owner duyệt giọng văn.
4. Điều khoản + Quyền riêng tư nói đúng những gì Tò He lưu và làm hôm nay (hồ sơ máy trên server, mã chuyển máy, link
   chia sẻ và payload của game, đăng nhập Google, câu tuổi/đồng ý); owner duyệt; `TERMS_VERSION` mới.
5. Danh sách "tính năng còn thiếu trước launch" do owner chốt — mỗi mục xong, hoặc hoãn có lý do.
6. Cổng ([E-01](items/E-01-gate-before-outsiders.md)) xong từng dòng — để owner quyết ngày launch chính thức.

## Không thuộc plan này *(agent đề xuất)*

- Ngày launch, mời cộng đồng đầu tiên — quyết định riêng của owner; plan chỉ làm cho Cổng qua được.
- Quảng cáo, marketing trả tiền; app trên store, app native.
- Phase 2 (hub) và Phase 3 (luồng game) ngoài phần owner chọn ở Q1 và Q2.

## Câu hỏi cho owner (trước khi chốt)

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | **Phạm vi.** Phase 1 đã hoãn Phase 2 (hub: quản lý account/hồ sơ, sảnh phòng, bảng xếp hạng, cài đặt) và Phase 3 (luồng game: shell, menu, game mới như Lấp Ô). Phase review có gộp chúng vào không, hay chỉ rà và sửa cái đang có rồi launch? | Rà và sửa cái đang có, cộng những gì owner coi là **thiếu để launch** (Q2); phần còn lại của Phase 2/3 làm sau launch |
| Q2 | **Tính năng còn thiếu.** Owner đã có danh sách chưa? | Nếu chưa, agent liệt kê ứng viên từ backlog (đăng nhập Zalo, telemetry crash/CSP, Lấp Ô, service worker cho origin của game…) và từ phần rà màn, owner chọn |
| Q3 | **Cách rà UI/UX.** Agent chụp từng màn rồi owner xem, hay owner tự đi và ghi lại? | Agent chụp mọi màn bằng Playwright (điện thoại + máy tính, sáng + tối, vi), gom vào `research/`, ghi lỗi thấy được; owner xem và thêm cảm nhận |
| Q4 | **Ngôn ngữ.** Hub có cả vi và en; trang công khai chỉ có vi. Soát câu chữ cả en hay chỉ vi? | Soát vi kỹ; en chỉ sửa chỗ sai nghĩa |
| Q5 | **Mốc thời gian.** Có ngày launch dự kiến không? | Không đặt ngày trong plan; thứ tự làm theo map, owner chốt ngày khi Cổng gần xong |
